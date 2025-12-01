import { EntitySheetHelper } from "./helper.js";
import { ATTRIBUTE_TYPES } from "./constants.js";

export class NarequentaActorSheet extends ActorSheet {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["narequenta", "sheet", "actor"],
      template: "systems/narequenta/templates/actor-sheet.html",
      width: 720,
      height: 1125,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "essences"}]
    });
  }

  /** @inheritdoc */
  async getData(options) {
    const context = await super.getData(options);
    const actorData = this.actor.toObject(false);
    context.systemData = this.actor.system; 
    context.system = this.actor.system; 
    EntitySheetHelper.getAttributeData(actorData);
    context.shorthand = !!game.settings.get("narequenta", "macroShorthand");
    context.dtypes = ATTRIBUTE_TYPES;
    context.biographyHTML = await TextEditor.enrichHTML(context.systemData.biography, {
      secrets: this.document.isOwner,
      async: true
    });

    // Combat Items Dropdown (Range = 5ft Default)
    context.combatItems = this.actor.items.filter(i => ["weapon", "ability"].includes(i.type))
        .map(i => ({
            id: i.id,
            name: i.name,
            range: i.system.range || 5, // 5ft Default
            type: i.type.toUpperCase()
        }));

    return context;
  }

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    if ( !this.isEditable ) return;

    // Standard Listeners
    html.find(".item-control").click(this._onItemControl.bind(this));
    html.find(".items .rollable").on("click", this._onItemRoll.bind(this));
    html.find(".item-use").click(this._onItemUse.bind(this)); // Consumables
    
    // Calculator Listeners
    html.find(".roll-calculation").click(this._onCalculate.bind(this));
    html.find(".execute-batch").click(this._onExecuteBatch.bind(this));
    html.find(".active-item-select").change(this._onSelectActiveItem.bind(this));

    // Targeting & Dice
    html.find(".launch-contest").click(this._onLaunchContest.bind(this));
    html.find(".roll-calc-btn").click(this._onRollSheetCalc.bind(this));    

    // Phase & Rest & Combat
    html.find(".waning-toggle").change(ev => {
        const isChecked = ev.target.checked;
        if (isChecked) html.find(".waning-roll-btn").slideDown();
        else html.find(".waning-roll-btn").slideUp();
    });
    html.find(".waning-roll-btn").click(this._onWaningPhase.bind(this));
    html.find(".short-rest").click(this._onShortRest.bind(this));
    html.find(".long-rest").click(this._onLongRest.bind(this));
    html.find(".use-action-surge").click(this._onUseActionSurge.bind(this));
    html.find(".end-turn").click(this._onEndTurn.bind(this));
  }

  /* -------------------------------------------- */
  /* ITEM SELECTION (Setup Calculator)            */
  /* -------------------------------------------- */
  async _onSelectActiveItem(event) {
      event.preventDefault();
      const itemId = event.target.value;
      const item = this.actor.items.get(itemId);
      if (!item) return;

      const sys = item.system;
      const motorKey = sys.cost?.motor || "vitalis";
      const motorVal = this.actor.system.essences[motorKey]?.value || 0;
      const weight = (typeof sys.weight !== "undefined") ? Number(sys.weight) : 15; 
      const range = Number(sys.range) || 5;
      
      // [NEW] Determine Damage Destination (default HP)
      const damageTarget = sys.target_resource || "hp";

      // Evaluate Damage/Healing Formula
      let bonusVal = 0;
      const bonusRaw = sys.damage_bonus || "0";
      try {
          const r = new Roll(bonusRaw.toString());
          await r.evaluate();
          bonusVal = r.total;
      } catch (e) {
          console.error("Invalid Formula", e);
          bonusVal = 0;
      }

      await this.actor.update({
          "system.calculator.selected_item_id": itemId,
          "system.calculator.item_name": item.name,
          "system.calculator.item_weight": weight,
          "system.calculator.item_bonus": bonusVal,
          "system.calculator.active_motor": motorKey,
          "system.calculator.active_motor_val": motorVal,
          "system.calculator.target_def_stat": motorKey, // Defense Roll (Same Essence)
          "system.calculator.apply_to": damageTarget,    // [NEW] Damage Destination
          "system.calculator.item_range": range,
          "system.calculator.output": "" 
      });

      ui.notifications.info(`Active: ${item.name} (${range}ft). Motor: ${motorKey.toUpperCase()}. Dmg: ${damageTarget.toUpperCase()}`);
  }

  /* -------------------------------------------- */
  /* COMBAT CALCULATOR v0.9.62                    */
  /* -------------------------------------------- */
  async _onCalculate(event) {
      event.preventDefault();
      const calc = this.actor.system.calculator;
      const targetIds = calc.target_ids || [];
      
      // Safety Checks
      const rawAttack = calc.attack_roll;
      if (!rawAttack && rawAttack !== 0) { ui.notifications.warn("Please roll Attack (d100)."); return; }
      if (Number(rawAttack) === 0) { ui.notifications.warn("Attack cannot be 0."); return; }
      if (!Array.isArray(targetIds) || targetIds.length === 0) { ui.notifications.warn("No targets selected."); return; }

      // Inputs
      const Attacker_d100 = Number(calc.attack_roll);
      const R_prof = Number(calc.prof_roll) || 0;
      const Manual_Def = Number(calc.defense_roll) || 0;
      const itemBonus = Number(calc.item_bonus) || 0;
      const itemWeight = (typeof calc.item_weight !== "undefined") ? Number(calc.item_weight) : 15; 
      
      const motorKey = calc.active_motor || "vitalis"; 
      const E_max = this.actor.system.essences[motorKey]?.max || 100;
      const E_cur = this.actor.system.essences[motorKey]?.value || 100;
      const defStat = calc.target_def_stat || "vitalis";
      const targetResource = calc.apply_to || "hp";

      let Attacker_Tier = (this.actor.type === 'character') ? (this.actor.system.resources.action_surges.max || 0) : (this.actor.system.tier || 0);

      // Determine Mode
      const isHealing = itemBonus < 0; 
      const isPotion = isHealing && (itemWeight === 0);

      // Hit Check (Zone Logic)
      const effectiveRoll = Attacker_d100 - R_prof;
      let zonePenalty = 0;
      if (E_cur <= 25) zonePenalty = 30;
      else if (E_cur <= 50) zonePenalty = 20;
      else if (E_cur <= 75) zonePenalty = 10;

      const successThreshold = E_max - zonePenalty;
      let attackerSuccess = true;
      let hitLabel = "SUCCESS";

      if (Attacker_d100 >= 96) { attackerSuccess = false; hitLabel = "CRIT FAIL"; }
      else if (Attacker_d100 <= 5) { attackerSuccess = true; hitLabel = "CRIT SUCCESS"; }
      else if (effectiveRoll > successThreshold) { attackerSuccess = false; hitLabel = "MISS"; }

      // HTML Output Builders
      let sheetListHtml = `<div style="font-size:0.85em; color:#555; margin-bottom:5px; border-bottom:1px solid #ccc;">
          Attack: <strong>${effectiveRoll}</strong> vs <strong>${successThreshold}</strong> (${hitLabel})
      </div>`;
      
      let chatTableRows = ""; // For Chat Log
      let payloadTargets = []; 

      for (const tid of targetIds) {
          const tToken = canvas.tokens.get(tid);
          if (!tToken) continue;
          
          const tActor = tToken.actor;
          const Def_Ecur = tActor.system.essences[defStat]?.value || 50;
          const Def_Tier = (tActor.type==='character') ? (tActor.system.resources.action_surges.max||0) : (tActor.system.tier||0);
          
          let Def_Roll = (targetIds.length === 1 && Manual_Def > 0) ? Manual_Def : Math.floor(Math.random() * 100) + 1;
          const D_Margin = Def_Roll - Def_Ecur; 
          
          let finalDamage = 0;
          let details = "";
          let resultColor = "#333";
          
          if (attackerSuccess) {
              if (isHealing) {
                  let healAmount = Math.abs(itemBonus);
                  if (!isPotion) healAmount += R_prof;
                  finalDamage = -Math.max(1, healAmount);
                  resultColor = "#006400"; // Green
              } else {
                  let A_FP = 100 - effectiveRoll;
                  if (Attacker_d100 <= 5) A_FP = 100 - (1 - R_prof);
                  const M_Defense = Def_Tier * 5.5;
                  let rawCalc = (A_FP - M_Defense + D_Margin + R_prof + itemBonus);
                  let baseDamage = Math.max(R_prof, rawCalc); 
                  if (baseDamage < 1) baseDamage = 1;

                  let mult = 1.0;
                  const diff = Attacker_Tier - Def_Tier;
                  if (diff >= 1) mult = 1.25; if (diff >= 2) mult = 1.50;
                  if (diff === 0) mult = 1.00; if (diff === -1) mult = 0.75; if (diff <= -2) mult = 0.50;

                  finalDamage = Math.max(1, Math.floor(baseDamage * mult));
                  resultColor = "#8b0000"; // Red
              }
              
              payloadTargets.push({ id: tid, damage: finalDamage, name: tToken.name });
              details = `(Def:${Def_Roll})`;
              
              // Add Row to Chat
              chatTableRows += `<tr>
                  <td style="text-align:left;">${tToken.name}</td>
                  <td style="text-align:center;">${Def_Roll}</td>
                  <td style="text-align:right; font-weight:bold; color:${resultColor};">${finalDamage > 0 ? finalDamage : '+' + Math.abs(finalDamage)}</td>
              </tr>`;

          } else {
              details = `(Missed)`;
              chatTableRows += `<tr><td style="text-align:left; color:#999;">${tToken.name}</td><td colspan="2" style="text-align:center; color:#999;">Evaded</td></tr>`;
          }

          sheetListHtml += `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:2px 0;">
              <div><strong>${tToken.name}</strong> <span style="font-size:0.8em; color:#555;">${details}</span></div>
              <div style="font-weight:bold; color:${resultColor}; font-size:1.1em;">
                  ${finalDamage > 0 ? finalDamage : '+' + Math.abs(finalDamage)}
              </div>
          </div>`;
      }

      // Attrition
      let attritionCost = Math.max(0, itemWeight - Math.floor(R_prof / 2));
      if (Attacker_d100 <= 5) attritionCost = Math.floor(attritionCost / 2);
      if (Attacker_d100 >= 96) attritionCost = attritionCost * 2;

      sheetListHtml += `<div style="text-align:right; margin-top:5px; font-size:0.8em; color:#333; font-weight:bold;">Self Attrition: -${attritionCost}%</div>`;

      const resolutionPayload = { essenceKey: motorKey, attritionCost: attritionCost, targets: payloadTargets, targetResource: targetResource };
      
      await this.actor.update({
          "system.calculator.output": sheetListHtml,
          "system.calculator.batch_data": JSON.stringify(resolutionPayload) 
      });
      
      // Detailed Chat Output
      ChatMessage.create({ 
          speaker: ChatMessage.getSpeaker({ actor: this.actor }), 
          content: `
          <div class="narequenta chat-card">
              <h3>${isHealing ? "Restoration" : "Attack Resolution"}</h3>
              <div><strong>Status:</strong> ${hitLabel}</div>
              <div style="font-size:0.9em;">Cost: -${attritionCost}% ${motorKey.toUpperCase()}</div>
              <hr>
              <table style="width:100%; font-size:0.9em; border-collapse:collapse;">
                  <thead><tr style="background:#eee;"><th style="text-align:left;">Target</th><th>Def</th><th>Effect</th></tr></thead>
                  <tbody>${chatTableRows}</tbody>
              </table>
              <div style="margin-top:5px; font-style:italic; font-size:0.8em; text-align:center;">
                  Apply results via Sheet.
              </div>
          </div>` 
      });
  }

  /* -------------------------------------------- */
  /* TARGETING DIALOG (Auto-Select AoE)           */
  /* -------------------------------------------- */
  _onLaunchContest(event) {
      if(event) event.preventDefault();
      const attacker = this.actor;
      const calc = attacker.system.calculator;
      const range = calc.item_range || 5;
      
      // Determine Target Type from the Item itself if possible
      const itemId = calc.selected_item_id;
      const item = attacker.items.get(itemId);
      const targetType = item?.system.target_type || "one"; // one, aoe, self
      
      const defaultDef = calc.active_motor || "vitalis";
      const isHealing = (Number(calc.item_bonus) || 0) < 0;
      const tier = (attacker.type === 'character') ? (attacker.system.resources.action_surges.max || 0) : (attacker.system.tier || 0);

      const tokens = attacker.getActiveTokens();
      if (tokens.length === 0) { ui.notifications.warn("Place token on scene."); return; }
      
      let pcHtml = ""; let npcHtml = ""; let count = 0;
      canvas.tokens.placeables.forEach(t => {
          if (t.id === tokens[0].id) return; 
          const dist = canvas.grid.measureDistance(tokens[0], t);
          if (dist <= range && t.actor?.system.resources?.hp?.value > 0) {
              const entry = `<div style="padding:2px;"><input type="checkbox" name="target" value="${t.id}" class="target-checkbox" data-type="${t.actor.type}"> <strong>${t.name}</strong> (${Math.round(dist)}ft)</div>`;
              if (t.actor.type === "character") pcHtml += entry; else npcHtml += entry;
              count++;
          }
      });

      if (count === 0) { ui.notifications.warn(`No targets within ${range}ft.`); return; }

      // Selection Logic: If AoE, check by default based on Tier/Type
      let autoSelectScript = "";
      
      if (targetType === "aoe") {
          // If it's AOE, we default to selecting things immediately
          if (isHealing) {
              autoSelectScript = `$('input[data-type="character"]').prop('checked', true);`;
          } else {
              if (tier >= 3) autoSelectScript = `$('input[data-type="npc"]').prop('checked', true);`; // Mastery
              else autoSelectScript = `$('input.target-checkbox').prop('checked', true);`; // Wild
          }
      } else {
          // Single Target defaults to nothing checked
          autoSelectScript = "";
      }

      const essences = ["vitalis", "motus", "sensus", "verbum", "anima", "hp"];
      let options = "";
      essences.forEach(k => { options += `<option value="${k}" ${k===defaultDef?"selected":""}>${k.toUpperCase()}</option>`; });

      const content = `
      <form>
          <div style="text-align:center; margin-bottom:5px;">Range: <strong>${range}ft</strong></div>
          <div style="display:flex; gap:5px; margin-bottom:10px;">
              <div style="flex:1; background:#eef; padding:5px; border:1px solid #ccc;"><strong>Allies</strong><br>${pcHtml || "-"}</div>
              <div style="flex:1; background:#fee; padding:5px; border:1px solid #ccc;"><strong>Enemies</strong><br>${npcHtml || "-"}</div>
          </div>
          <div style="text-align:center; margin-bottom:10px;">
              <button type="button" id="auto-select-btn" style="font-size:0.8em; width:100%;">
                  ${targetType === "aoe" ? "Reset / Auto-Select" : "Auto-Select Targets"}
              </button>
          </div>
          <label>Defensive Stat:</label>
          <select id="target-essence" style="width:100%;">${options}</select>
      </form>
      <script>
          // Run immediately if AoE to show selection
          ${autoSelectScript}
          
          $("#auto-select-btn").click(function() { 
              // Toggle logic if button is clicked manually
              const anyChecked = $("input:checkbox:checked").length > 0;
              if (anyChecked) {
                  $("input:checkbox").prop('checked', false); 
              } else {
                  ${autoSelectScript || `$('input.target-checkbox').prop('checked', true);`} 
              }
          });
      </script>`;

      new Dialog({ title: `Targeting (${targetType.toUpperCase()})`, content: content, buttons: { confirm: { label: "Lock", callback: async (html) => {
          const ids = []; html.find("input:checked").each(function(){ ids.push($(this).val()); });
          if(ids.length) await attacker.update({ "system.calculator.target_ids": ids, "system.calculator.target_def_stat": html.find("#target-essence").val(), "system.calculator.target_name": `${ids.length} Targets` });
      }}}}).render(true);
  }

  /* -------------------------------------------- */
  /* EXECUTE BATCH (Apply Damage/Heal)            */
  /* -------------------------------------------- */
  async _onExecuteBatch(event) {
      event.preventDefault();
      const rawData = this.actor.system.calculator.batch_data;
      if (!rawData) return;

      // [NEW] Read targetResource from payload
      const { essenceKey, attritionCost, targets, targetResource } = JSON.parse(rawData);
      
      // Default to HP if missing (legacy safety)
      const applyTo = targetResource || "hp";

      // 1. Attrition
      const currentVal = this.actor.system.essences[essenceKey].value;
      const newVal = Math.max(0, currentVal - attritionCost);
      await this.actor.update({ [`system.essences.${essenceKey}.value`]: newVal });

      // 2. Damage / Healing
      if (targets && targets.length > 0) {
          for (const tData of targets) {
              const token = canvas.tokens.get(tData.id);
              if (token && token.actor) {
                  let currentVal = 0;
                  let maxVal = 100;
                  let updatePath = "";

                  if (applyTo === "hp") {
                      currentVal = token.actor.system.resources.hp.value;
                      maxVal = token.actor.system.resources.hp.max;
                      updatePath = "system.resources.hp.value";
                  } else {
                      // Apply to Essence
                      currentVal = token.actor.system.essences[applyTo]?.value || 0;
                      maxVal = token.actor.system.essences[applyTo]?.max || 100;
                      updatePath = `system.essences.${applyTo}.value`;
                  }

                  let finalVal = currentVal - tData.damage;
                  if (finalVal < 0) finalVal = 0;
                  if (finalVal > maxVal) finalVal = maxVal;

                  await token.actor.update({ [updatePath]: finalVal });
                  
                  // Check Death (Only for HP)
                  if (applyTo === "hp" && finalVal <= 0 && tData.damage > 0) {
                       const isDead = token.actor.effects.some(e => e.statusId === "dead" || (e.statuses && e.statuses.has("dead")));
                       if (!isDead) await token.actor.toggleStatusEffect("dead", { overlay: true });
                  }
              }
          }
      }

      await this.actor.update({
          "system.calculator.attack_roll": 0,
          "system.calculator.prof_roll": 0,
          "system.calculator.defense_roll": 0,
          "system.calculator.batch_data": "",
          "system.calculator.output": `Applied. -${attritionCost}% Attrition.`
      });
      ui.notifications.info("Resolution Complete.");
  }

  /* -------------------------------------------- */
  /* COMBAT UTILITIES                             */
  /* -------------------------------------------- */
  async _onEndTurn(event) {
      event.preventDefault();
      const combat = game.combat;
      if (!combat) return;
      
      // Advance
      await combat.nextTurn();
      
      // Open Next Sheet
      if (combat.combatant?.actor) combat.combatant.actor.sheet.render(true);
      
      // [FIX] Close Current Sheet
      this.close();
  }

  /* -------------------------------------------- */
  /* CONSUMABLES LOGIC v0.9.60                   */
  /* -------------------------------------------- */
  async _onItemUse(event) {
      event.preventDefault();
      const li = $(event.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      if (!item) return;

      const sys = item.system;
      const qty = sys.quantity || 0;
      const type = sys.target_type || "one"; 
      
      // [NEW] Get the specific resource this item affects (default hp)
      const resourceKey = sys.target_resource || "hp"; 

      if (qty <= 0) { ui.notifications.warn("Item Depleted."); return; }

      // Helper to execute the roll/heal
      const executeConsume = async (targetActor) => {
          await item.update({ "system.quantity": qty - 1 });
          const formula = sys.damage_bonus || "0";
          
          try {
              const r = new Roll(formula);
              await r.evaluate();
              if (game.dice3d) game.dice3d.showForRoll(r);
              
              // 1. Determine Paths based on Resource Key
              let currentPath, maxPath, label;
              let currentVal, maxVal;

              if (resourceKey === "hp") {
                  currentPath = "system.resources.hp.value";
                  maxPath = "system.resources.hp.max";
                  currentVal = targetActor.system.resources.hp.value;
                  maxVal = targetActor.system.resources.hp.max;
                  label = "HP";
              } else {
                  // It's an Essence (vitalis, motus, etc.)
                  currentPath = `system.essences.${resourceKey}.value`;
                  maxPath = `system.essences.${resourceKey}.max`;
                  currentVal = targetActor.system.essences[resourceKey]?.value || 0;
                  maxVal = targetActor.system.essences[resourceKey]?.max || 100;
                  label = resourceKey.toUpperCase();
              }

              // 2. Apply Effect
              // Negative Total = Healing (Add to pool)
              // Positive Total = Damage (Subtract from pool)
              let change = 0;
              let newVal = 0;

              if (r.total < 0) {
                  // HEALING
                  change = Math.abs(r.total);
                  newVal = Math.min(maxVal, currentVal + change);
                  ui.notifications.info(`${targetActor.name}: Recovered ${change} ${label}.`);
              } else {
                  // DAMAGE / REDUCTION
                  change = r.total;
                  newVal = Math.max(0, currentVal - change);
                  ui.notifications.info(`${targetActor.name}: Lost ${change} ${label}.`);
              }

              // 3. Update Actor
              await targetActor.update({ [currentPath]: newVal });

              r.toMessage({ 
                  speaker: ChatMessage.getSpeaker({ actor: this.actor }), 
                  flavor: `Consumed: ${item.name} (${label} ${r.total < 0 ? "+" : "-"}${change})` 
              });

          } catch (e) { console.error(e); }
      };

      // Target selection logic (Self vs Other)
      if (type === "self") {
          executeConsume(this.actor);
      } else {
          new Dialog({
              title: `Use ${item.name}`,
              content: `<p>Target: <strong>${resourceKey.toUpperCase()}</strong></p>`,
              buttons: {
                  self: {
                      label: "Self",
                      icon: "<i class='fas fa-user'></i>",
                      callback: () => executeConsume(this.actor)
                  },
                  target: {
                      label: "Target",
                      icon: "<i class='fas fa-bullseye'></i>",
                      callback: () => {
                          const targets = Array.from(game.user.targets);
                          if (targets.length !== 1) {
                              ui.notifications.warn("Select exactly 1 target.");
                              return;
                          }
                          executeConsume(targets[0].actor);
                      }
                  }
              },
              default: "self"
          }).render(true);
      }
  }

  /* -------------------------------------------- */
  /* REST, RESOURCES, TARGETING, LEGACY           */
  /* -------------------------------------------- */
  
  async _onLongRest(event) {
    event.preventDefault();
    const confirmed = await Dialog.confirm({
      title: "Renewal (Long Rest)",
      content: "<p>Restores <strong>HP</strong> and <strong>Essences (Current)</strong> to <strong>100%</strong>.</p>"
    });
    if (confirmed) {
      const updates = {};
      const essences = this.actor.system.essences;
      for (const [key, essence] of Object.entries(essences)) { updates[`system.essences.${key}.value`] = 100; }
      if (this.actor.type === "character") updates[`system.resources.action_surges.value`] = this.actor.system.resources.action_surges.max;
      updates[`system.resources.hp.value`] = this.actor.system.resources.hp.max;
      updates[`system.calculator.target_ids`] = [];
      updates[`system.calculator.target_name`] = "None";
      updates[`system.calculator.batch_data`] = "";
      updates[`system.calculator.output`] = "Rest Complete.";
      await this.actor.update(updates);
      ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `<div class="narequenta chat-card"><h3>Renewal</h3><p>Restored to 100%.</p></div>` });
    }
  }

  async _onShortRest(event) {
    event.preventDefault();
    const content = `
    <div class="narequenta">
        <div class="form-group"><label>Rest Intensity:</label>
            <select id="rest-type" style="width:100%; margin-bottom: 10px;">
              <option value="quick" selected>Quick Breath (1d6%)</option>
              <option value="mental">Mental Calming (Variable)</option>
              <option value="deep">Deep Meditation (4d10%)</option>
            </select>
        </div>
        <div id="mental-options" style="display:none; background:#f0f0f0; padding:5px;"><select id="mental-duration" style="width:100%;"><option value="2d8">5 Min</option><option value="3d8">10 Min</option></select></div>
        <div style="display:flex; margin-top:10px;"><button type="button" id="btn-roll-rest">Roll</button><input type="number" id="rest-result" style="text-align:center;"></div>
    </div>
    <script>$("#rest-type").change(function(){if($(this).val()==="mental")$("#mental-options").slideDown();else $("#mental-options").slideUp();});</script>`;
    new Dialog({
      title: "Refocus", content: content,
      buttons: { apply: { icon: '<i class="fas fa-check"></i>', label: "Apply", callback: async (html) => {
            const val = html.find("#rest-result").val();
            if (val === "") return; 
            const rec = parseInt(val);
            const updates = {};
            for (const [key, essence] of Object.entries(this.actor.system.essences)) {
              if (essence.value < 100) updates[`system.essences.${key}.value`] = Math.min(100, essence.value + rec);
            }
            const hp = this.actor.system.resources.hp;
            if (hp.value < hp.max) updates[`system.resources.hp.value`] = Math.min(hp.max, hp.value + rec);
            await this.actor.update(updates);
            ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `Refocus: Recovered ${rec}.` });
      }}},
      render: (html) => { html.find("#btn-roll-rest").click(async () => {
          let formula = "1d6";
          const type = html.find("#rest-type").val();
          if (type === "mental") formula = html.find("#mental-duration").val();
          else if (type === "deep") formula = "4d10";
          const r = new Roll(formula); await r.evaluate(); if (game.dice3d) game.dice3d.showForRoll(r);
          html.find("#rest-result").val(r.total);
      });}
    }).render(true);
  }

  async _onUseActionSurge(event) {
      event.preventDefault();
      const current = this.actor.system.resources.action_surges.value;
      if (current > 0) {
          await this.actor.update({"system.resources.action_surges.value": current - 1});
          ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `<div class="narequenta chat-card"><h3 style="color:#d4af37">Action Surge!</h3><p>Remaining: ${current - 1}</p></div>` });
      } else { ui.notifications.warn("No Action Surges left."); }
  }

  async _onEndTurn(event) {
      event.preventDefault();
      const combat = game.combat;
      if (!combat) return;
      await combat.nextTurn();
      if (combat.combatant?.actor) combat.combatant.actor.sheet.render(true);
  }

  /* -------------------------------------------- */
  /* TACTICAL TARGETING UI (AoE Logic)            */
  /* -------------------------------------------- */
  _onLaunchContest(event) {
      if(event) event.preventDefault();
      
      // 1. Setup Data
      const attacker = this.actor;
      const calc = attacker.system.calculator;
      const range = calc.item_range || 5;
      const defaultDef = calc.active_motor || "vitalis";
      
      // Determine if Offensive or Healing based on bonus in calculator
      const isHealing = (Number(calc.item_bonus) || 0) < 0;
      
      // Determine Tier for Safeguard Logic
      const tier = (attacker.type === 'character') 
          ? (attacker.system.resources.action_surges.max || 0) 
          : (attacker.system.tier || 0);

      const tokens = attacker.getActiveTokens();
      if (tokens.length === 0) { ui.notifications.warn("Place token on scene."); return; }
      
      // 2. Build Target Lists
      let pcHtml = ""; let npcHtml = ""; let count = 0;
      let allIds = []; let npcIds = []; let pcIds = [];

      canvas.tokens.placeables.forEach(t => {
          if (t.id === tokens[0].id) return; 
          const dist = canvas.grid.measureDistance(tokens[0], t);
          if (dist <= range && t.actor?.system.resources?.hp?.value > 0) {
              
              const entry = `
              <div style="padding:2px;">
                  <input type="checkbox" name="target" value="${t.id}" class="target-checkbox" data-type="${t.actor.type}"> 
                  <strong>${t.name}</strong> (${Math.round(dist)}ft)
              </div>`;
              
              if (t.actor.type === "character") {
                  pcHtml += entry;
                  pcIds.push(t.id);
              } else {
                  npcHtml += entry;
                  npcIds.push(t.id);
              }
              allIds.push(t.id);
              count++;
          }
      });

      if (count === 0) { ui.notifications.warn(`No targets within ${range}ft.`); return; }

      // 3. Build Selection Logic Buttons
      let autoSelectScript = "";
      
      if (isHealing) {
          // HEALING: Auto-select PCs (Allies)
          autoSelectScript = `$('input[data-type="character"]').prop('checked', true);`;
      } else {
          // DAMAGE: Check Tier
          if (tier >= 3) {
              // Mastery: Safe Casting (Select NPCs only)
              autoSelectScript = `$('input[data-type="npc"]').prop('checked', true);`;
          } else {
              // Wild: Dangerous Casting (Select ALL)
              autoSelectScript = `$('input.target-checkbox').prop('checked', true);`;
          }
      }

      // 4. Render Dialog
      const essences = ["vitalis", "motus", "sensus", "verbum", "anima", "hp"];
      let options = "";
      essences.forEach(k => { options += `<option value="${k}" ${k===defaultDef?"selected":""}>${k.toUpperCase()}</option>`; });

      const content = `
      <form>
          <div style="text-align:center; margin-bottom:5px;">Range: <strong>${range}ft</strong></div>
          
          <div style="display:flex; gap:5px; margin-bottom:10px;">
              <div style="flex:1; background:#eef; padding:5px; border:1px solid #ccc;">
                  <strong>Allies (PCs)</strong><br>${pcHtml || "-"}
              </div>
              <div style="flex:1; background:#fee; padding:5px; border:1px solid #ccc;">
                  <strong>Enemies (NPCs)</strong><br>${npcHtml || "-"}
              </div>
          </div>

          <div style="text-align:center; margin-bottom:10px;">
              <button type="button" id="auto-select-btn" style="font-size:0.8em; width:100%;">
                  ${isHealing ? "Auto-Target Allies (Healing)" : (tier >= 3 ? "Auto-Target Enemies (Mastery)" : "⚠️ Auto-Target Area (Wild Magic)")}
              </button>
          </div>

          <label>Defensive Stat:</label>
          <select id="target-essence" style="width:100%;">${options}</select>
      </form>
      <script>
          $("#auto-select-btn").click(function() {
              $("input:checkbox").prop('checked', false); // Clear
              ${autoSelectScript} // Apply Logic
          });
      </script>
      `;

      new Dialog({ 
          title: "Tactical Targeting", 
          content: content, 
          buttons: { 
              confirm: { 
                  label: "Lock Targets", 
                  icon: "<i class='fas fa-crosshairs'></i>",
                  callback: async (html) => {
                      const ids = []; 
                      html.find("input:checked").each(function(){ ids.push($(this).val()); });
                      
                      if(ids.length) await this.actor.update({ 
                          "system.calculator.target_ids": ids, 
                          "system.calculator.target_def_stat": html.find("#target-essence").val(), 
                          "system.calculator.target_name": `${ids.length} Targets` 
                      });
                  }
              }
          }
      }).render(true);
  }

  _onItemControl(event) { /* Legacy CRUD */ 
    event.preventDefault(); const btn = event.currentTarget; const li = btn.closest(".item"); const item = this.actor.items.get(li?.dataset.itemId);
    if(btn.dataset.action === "create") return getDocumentClass("Item").create({name: game.i18n.localize("NAREQUENTA.ItemNew"), type: "item"}, {parent: this.actor});
    if(btn.dataset.action === "edit") return item.sheet.render(true);
    if(btn.dataset.action === "delete") return item.delete();
  }
  
  _onItemRoll(event) { /* Legacy click-to-load wrapper */
    event.preventDefault(); const li = $(event.currentTarget).parents(".item"); const id = li.data("itemId");
    const dropdown = this.element.find(".active-item-select");
    if(dropdown.length) dropdown.val(id).change(); else this._onSelectActiveItem({target:{value:id}, preventDefault:()=>{}});
  }

  _onRollSheetCalc(event) { /* Helper dice roller for calculator inputs */
      event.preventDefault(); const btn = $(event.currentTarget);
      const type = btn.data("type"); const target = btn.data("target");
      let formula = "1d100";
      if (type === "prof") {
          let tier = (this.actor.type === 'character') ? (this.actor.system.resources.action_surges.max||0) : (this.actor.system.tier||0);
          if(tier===0) { this.actor.update({[target]:0}); return; }
          formula = `${tier}d10`;
      }
      new Roll(formula).evaluate().then(r => { if(game.dice3d) game.dice3d.showForRoll(r); this.actor.update({[target]: r.total}); });
  }

  async _onWaningPhase(event) { /* ... Kept from previous ... */ }
  async _onApplySheetDamage(event) { /* ... Kept from previous ... */ }
}