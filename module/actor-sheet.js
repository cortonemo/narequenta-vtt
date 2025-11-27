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
    return context;
  }

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    if ( !this.isEditable ) return;

    html.find(".item-control").click(this._onItemControl.bind(this));
    html.find(".items .rollable").on("click", this._onItemRoll.bind(this));
    html.find(".roll-calculation").click(this._onCalculate.bind(this));
    html.find(".execute-batch").click(this._onExecuteBatch.bind(this)); // NEW: Sheet-based Execute

    html.find(".waning-toggle").change(ev => {
        const isChecked = ev.target.checked;
        if (isChecked) html.find(".waning-roll-btn").slideDown();
        else html.find(".waning-roll-btn").slideUp();
    });
    html.find(".waning-roll-btn").click(this._onWaningPhase.bind(this));
    html.find(".short-rest").click(this._onShortRest.bind(this));
    html.find(".long-rest").click(this._onLongRest.bind(this));
    html.find(".launch-contest").click(this._onLaunchContest.bind(this));
    html.find(".roll-calc-btn").click(this._onRollSheetCalc.bind(this));    
  }

  /* -------------------------------------------- */
  /* REST & RECOVERY LOGIC                        */
  /* -------------------------------------------- */
  async _onLongRest(event) {
    event.preventDefault();
    const actor = this.actor;
    const confirmed = await Dialog.confirm({
      title: "Renewal (Long Rest)",
      content: "<p>Perform a <strong>Long Rest (6h+)</strong>?<br>This will restore <strong>Active Vigor (HP)</strong> and all <strong>Essences</strong> to <strong>100%</strong>.<br><strong>Targets will be cleared.</strong></p>"
    });
    if (confirmed) {
      const updates = {};
      const essences = actor.system.essences;
      for (const [key, essence] of Object.entries(essences)) {
        updates[`system.essences.${key}.value`] = 100;
      }
      if (actor.type === "character") {
        updates[`system.resources.action_surges.value`] = actor.system.resources.action_surges.max;
      }
      updates[`system.resources.hp.value`] = actor.system.resources.hp.max;

      // CLEAR CALCULATOR STATE
      updates[`system.calculator.target_ids`] = [];
      updates[`system.calculator.target_name`] = "None";
      updates[`system.calculator.batch_data`] = "";
      updates[`system.calculator.output`] = "";
      updates[`system.calculator.attack_roll`] = 0;
      updates[`system.calculator.defense_roll`] = 0;

      await actor.update(updates);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: actor }),
        content: `<div class="narequenta chat-card"><h3>Renewal</h3><p>Fully Restored.</p></div>`
      });
    }
  }

  async _onShortRest(event) {
    event.preventDefault();
    const actor = this.actor;
    const content = `
    <div class="narequenta">
        <div class="form-group">
            <label style="font-weight:bold;">Rest Intensity:</label>
            <select id="rest-type" style="width:100%; margin-bottom: 10px;">
              <option value="quick">Quick Breath (1d6%) - Momentary</option>
              <option value="mental" selected>Mental Calming (Variable)</option>
              <option value="deep">Deep Meditation (4d10%) - 1 Hour</option>
            </select>
        </div>
        <div id="mental-options" style="display:block; background:#f0f0f0; padding:5px; border:1px solid #ccc; margin-bottom:10px;">
             <label>Calming Duration:</label>
             <select id="mental-duration" style="width:100%;">
                <option value="2d8">5 Minutes (2d8%)</option>
                <option value="3d8">10 Minutes (3d8%)</option>
                <option value="4d8">15 Minutes (4d8%)</option>
                <option value="5d8">20 Minutes (5d8%)</option>
             </select>
        </div>
        <div style="display:flex; gap:5px; align-items:center; margin-top:10px; border-top:1px solid #ccc; padding-top:10px;">
            <button type="button" id="btn-roll-rest" style="flex:0 0 40px;"><i class="fas fa-dice"></i></button>
            <input type="number" id="rest-result" placeholder="Roll" style="text-align:center; font-weight:bold;">
        </div>
    </div>
    <script>$("#rest-type").change(function(){if($(this).val()==="mental")$("#mental-options").slideDown();else $("#mental-options").slideUp();});</script>`;

    const d = new Dialog({
      title: "Refocus",
      content: content,
      buttons: {
        apply: {
          icon: '<i class="fas fa-check"></i>',
          label: "Apply",
          callback: async (html) => {
            const val = html.find("#rest-result").val();
            if (val === "") return; 
            const recoveredAmount = parseInt(val);
            const updates = {};
            const essences = actor.system.essences;
            const hp = actor.system.resources.hp;
            let outputList = "";
            for (const [key, essence] of Object.entries(essences)) {
              let newValue = essence.value + recoveredAmount;
              if (newValue > 100) newValue = 100; 
              updates[`system.essences.${key}.value`] = newValue;
              if (essence.value < 100) outputList += `<li><strong>${essence.label}:</strong> +${recoveredAmount}% (${newValue}%)</li>`;
            }
            let newHP = hp.value + recoveredAmount;
            if (newHP > hp.max) newHP = hp.max;
            updates[`system.resources.hp.value`] = newHP;
            if (hp.value < hp.max) outputList += `<li><strong>Active Vigor:</strong> +${recoveredAmount} (${newHP})</li>`;
            await actor.update(updates);
            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: actor }),
              content: `<div class="narequenta chat-card"><h3>Refocus Applied</h3><div><strong>Recovered:</strong> +${recoveredAmount}%</div><hr><ul>${outputList || "<li>At 100%.</li>"}</ul></div>`
            });
          }
        }
      },
      render: (html) => {
          html.find("#btn-roll-rest").click(async () => {
              const type = html.find("#rest-type").val();
              let formula = "1d6"; 
              if (type === "mental") formula = html.find("#mental-duration").val();
              else if (type === "deep") formula = "4d10";
              const roll = new Roll(formula);
              await roll.evaluate();
              if (game.dice3d) game.dice3d.showForRoll(roll);
              html.find("#rest-result").val(roll.total);
          });
      }
    });
    d.render(true);
  }

  async _onWaningPhase(event) {
      event.preventDefault();
      const actor = this.actor;
      const essenceKeys = ["vitalis", "motus", "sensus", "verbum", "anima"];
      const essenceLabels = { "vitalis": "VITALIS", "motus": "MOTUS", "sensus": "SENSUS", "verbum": "VERBUM", "anima": "ANIMA" };
      let essenceDropdown = "";
      essenceKeys.forEach(key => { essenceDropdown += `<option value="${key}">${essenceLabels[key]}</option>`; });
      let rowsHTML = "";
      essenceKeys.forEach(key => {
          rowsHTML += `
          <tr id="row-${key}" class="essence-row-calc">
              <td style="font-weight:bold;">${essenceLabels[key]}</td>
              <td id="formula-${key}" class="formula-cell" style="color:#555; text-align:center;">1d6</td>
              <td><button class="roll-individual-btn" data-key="${key}" style="padding:2px 8px;"><i class="fas fa-dice"></i></button></td>
              <td><input type="number" id="result-${key}" class="nq-manual" style="width:50px; text-align:center;" readonly></td>
              <td id="display-${key}" style="font-size:0.8em; color:#666;">-</td>
          </tr>`;
      });
      const content = `<div class="narequenta">
      <div class="form-group" style="margin-bottom:10px;">
          <label style="font-weight:bold;">Select Refinement Focus (Higher Risk/Reward):</label>
          <select id="focus-select" style="width:100%">${essenceDropdown}</select>
          <p style="font-size:0.8em; margin-top:5px;">The Focus Essence rolls <strong>2d6</strong>. Others roll <strong>1d6</strong>.</p>
      </div>
      <hr>
      <table class="nq-table" style="width:100%">
          <thead><tr><th>Essence</th><th>Dice</th><th>Roll</th><th>Loss</th><th>Info</th></tr></thead>
          <tbody>${rowsHTML}</tbody>
      </table>
      </div>`;
      
      const performWaning = async (html, dialogInstance) => {
          const focusKey = html.find("#focus-select").val();
          const updates = {};
          let chatOutput = "";
          for (const key of essenceKeys) {
              const resultVal = html.find(`#result-${key}`).val();
              if (resultVal === "") continue; 
              const loss = parseInt(resultVal);
              const currentMax = actor.system.essences[key].max;
              let newMax = currentMax - loss;
              if (newMax < 50) newMax = 50;
              updates[`system.essences.${key}.max`] = newMax;
              const isFocus = (key === focusKey);
              chatOutput += `<div style="display:flex; justify-content:space-between; font-size:0.9em; ${isFocus ? 'font-weight:bold; color:#006400;' : ''}"><span>${essenceLabels[key]}:</span><span>-${loss}% (${newMax}%)</span></div>`;
          }
          if (Object.keys(updates).length > 0) {
              await actor.update(updates);
              ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actor }), content: `<div class="narequenta chat-card"><h3>The Waning</h3><div style="margin-bottom:5px;"><strong>Focus:</strong> ${essenceLabels[focusKey]}</div><hr>${chatOutput}<hr><div style="text-align:center; font-style:italic;">Sheet Updated.</div></div>` });
          }
          dialogInstance.close();
      };

      const d = new Dialog({ title: `The Waning: ${actor.name}`, content: content, buttons: { apply: { icon: '<i class="fas fa-check"></i>', label: "Apply All Changes", callback: (html) => performWaning(html, d) } },
          render: (html) => {
              const updateHighlights = () => {
                  const focusKey = html.find("#focus-select").val();
                  essenceKeys.forEach(k => { html.find(`#row-${k}`).removeClass("nq-focus-highlight"); html.find(`#formula-${k}`).text("1d6"); });
                  html.find(`#row-${focusKey}`).addClass("nq-focus-highlight"); html.find(`#formula-${focusKey}`).html("<b>2d6</b>");
              };
              updateHighlights(); html.find("#focus-select").change(updateHighlights);
              html.find(".roll-individual-btn").click(async (ev) => {
                  ev.preventDefault(); const btn = $(ev.currentTarget); const key = btn.data("key"); const focusKey = html.find("#focus-select").val(); const isFocus = (key === focusKey);
                  const formula = isFocus ? "2d6" : "1d6";
                  const r = new Roll(formula); await r.evaluate(); if (game.dice3d) game.dice3d.showForRoll(r);
                  let loss = r.total; let displayInfo = `Rolled ${loss}`;
                  const currentMax = actor.system.essences[key].max;
                  if (isFocus && currentMax === 100) { const potentialMax = currentMax - loss; if (potentialMax > 90) { loss = 10; displayInfo = `Rolled ${r.total} -> Set 10 (Tier I Guarantee)`; } }
                  html.find(`#result-${key}`).val(loss); html.find(`#display-${key}`).text(displayInfo);
                  r.toMessage({ speaker: ChatMessage.getSpeaker({ actor: actor }), flavor: `Waning Roll (${essenceLabels[key]})` });
              });
          }
      });
      d.render(true);
  }


  /* -------------------------------------------- */
  /* ITEM ROLL -> LOAD CONTEXT & OPEN TARGETING   */
  /* -------------------------------------------- */
  async _onItemRoll(event) {
    event.preventDefault();
    const button = $(event.currentTarget);
    const li = button.parents(".item");
    const item = this.actor.items.get(li.data("itemId"));

    if (item.type === "item") return item.roll();

    const sys = item.system;
    const motorKey = sys.cost?.motor || "vitalis";
    
    // 1. Get Values
    const motorVal = this.actor.system.essences[motorKey]?.value || 0;
    const weight = Number(sys.weight) || 15; 
    const dmgBonus = Number(sys.damage_bonus) || 0;
    const range = Number(sys.range) || 2; 

    // 2. Update Calculator (Context)
    await this.actor.update({
        "system.calculator.item_name": item.name,
        "system.calculator.item_weight": weight,
        "system.calculator.item_bonus": dmgBonus,
        "system.calculator.active_motor": motorKey,
        "system.calculator.active_motor_val": motorVal,
        "system.calculator.item_range": range,
        "system.calculator.output": "" // Clear old results
    });

    ui.notifications.info(`Weapon Loaded: ${item.name} (${range}m). Opening Target List.`);
    
    // 3. Open Targeting
    this._onLaunchContest(event, range);
  }

  /* -------------------------------------------- */
  /* TACTICAL TARGETING UI                        */
  /* -------------------------------------------- */
  _onLaunchContest(event, overrideRange = null) {
      if(event) event.preventDefault();
      const attacker = this.actor;
      let maxDist = overrideRange || this.actor.system.calculator.item_range || 100;
      
      const tokens = attacker.getActiveTokens();
      const attackerToken = tokens.length > 0 ? tokens[0] : null;

      if (!attackerToken) {
          ui.notifications.warn("Place character on scene to calculate range.");
          return;
      }

      let pcHtml = "";
      let npcHtml = "";
      let count = 0;

      canvas.tokens.placeables.forEach(t => {
          if (t.id === attackerToken.id) return; 
          
          const dist = canvas.grid.measureDistance(attackerToken, t);
          const hp = t.actor?.system.resources?.hp?.value || 0;
          
          if (dist <= maxDist && hp > 0) {
              const isPC = t.actor.type === "character";
              const entry = `
              <div style="margin-bottom:4px; padding:4px; background:rgba(0,0,0,0.05); border-radius:4px; display:flex; align-items:center;">
                  <input type="checkbox" name="target" value="${t.id}" id="chk_${t.id}" style="margin-right:8px;">
                  <label for="chk_${t.id}" style="cursor:pointer; flex:1;">
                      <strong>${t.name}</strong> <span style="font-size:0.8em; color:#555;">(${Math.round(dist)}m)</span>
                  </label>
              </div>`;
              
              if (isPC) pcHtml += entry;
              else npcHtml += entry;
              count++;
          }
      });

      if (count === 0) {
          ui.notifications.warn(`No targets within ${maxDist}m.`);
          return;
      }

      const essenceOptions = `
          <option value="vitalis">VITALIS (Force)</option>
          <option value="motus">MOTUS (Reflex)</option>
          <option value="sensus">SENSUS (Instinct)</option>
          <option value="verbum">VERBUM (Logic)</option>
          <option value="anima">ANIMA (Will)</option>
      `;

      const content = `
      <form id="targeting-form">
          <div style="text-align:center; margin-bottom:10px; font-style:italic;">
             Range: <strong>${maxDist}m</strong>
          </div>
          <div style="display:flex; gap:10px; margin-bottom:10px;">
              <div style="flex:1; border:1px solid #ccc; padding:5px; background:#eef;">
                  <h4 style="text-align:center; border-bottom:1px solid #999;">PCs</h4>
                  ${pcHtml || "<em style='font-size:0.8em'>None</em>"}
              </div>
              <div style="flex:1; border:1px solid #ccc; padding:5px; background:#fee;">
                  <h4 style="text-align:center; border-bottom:1px solid #999;">NPCs</h4>
                  ${npcHtml || "<em style='font-size:0.8em'>None</em>"}
              </div>
          </div>
          <div class="form-group">
              <label><strong>Defensive Stat:</strong></label>
              <select id="target-essence" style="width:100%;">${essenceOptions}</select>
          </div>
      </form>
      `;

      new Dialog({
          title: `Select Targets`,
          content: content,
          buttons: {
              confirm: {
                  icon: '<i class="fas fa-check"></i>',
                  label: "Confirm",
                  callback: async (html) => {
                      const selectedIds = [];
                      html.find("input[name='target']:checked").each(function() {
                          selectedIds.push($(this).val());
                      });

                      if (selectedIds.length === 0) return;

                      const essenceKey = html.find("#target-essence").val();
                      const essenceLabel = essenceKey.toUpperCase();

                      // Update Context in Calculator
                      await attacker.update({
                          "system.calculator.target_ids": selectedIds, 
                          "system.calculator.target_name": `${selectedIds.length} Target(s) (${essenceLabel})`,
                          "system.calculator.target_def_stat": essenceKey,
                          "system.calculator.batch_data": "", // Clear pending execution
                          "system.calculator.output": "" // Clear output
                      });
                  }
              }
          },
          default: "confirm"
      }).render(true);
  }

  /* -------------------------------------------- */
  /* BATCH CALCULATE LOGIC (Sheet-Based)          */
  /* -------------------------------------------- */
  async _onCalculate(event) {
      event.preventDefault();
      const calc = this.actor.system.calculator;
      const targetIds = calc.target_ids || [];
      
      if (!Array.isArray(targetIds) || targetIds.length === 0) {
          ui.notifications.warn("No targets selected.");
          return;
      }

      // Inputs
      const Attacker_d100 = Number(calc.attack_roll) || 0;
      const R_prof = Number(calc.prof_roll) || 0;
      const Manual_Def = Number(calc.defense_roll) || 0; // Manual Override
      const itemBonus = Number(calc.item_bonus) || 0;
      const itemWeight = Number(calc.item_weight) || 15; 
      
      // Attacker Stat
      const motorKey = calc.active_motor || "vitalis"; 
      const motorData = this.actor.system.essences[motorKey] || { max: 100, value: 100 };
      const E_max = motorData.max;
      const E_cur = motorData.value;
      const defStat = calc.target_def_stat || "vitalis";

      let Attacker_Tier = (this.actor.type === 'character') 
          ? (this.actor.system.resources.action_surges.max || 0) 
          : (this.actor.system.tier || 0);

      // --- 1. ATTACKER HIT CHECK ---
      const effectiveRoll = Attacker_d100 - R_prof;
      let zonePenalty = 0;
      if (E_cur <= 75) zonePenalty = 10;
      if (E_cur <= 50) zonePenalty = 20;
      if (E_cur <= 25) zonePenalty = 30;

      const successThreshold = E_max - zonePenalty;
      let attackerSuccess = true;
      let hitLabel = "SUCCESS";

      if (Attacker_d100 >= 96) { attackerSuccess = false; hitLabel = "CRIT FAIL"; }
      else if (Attacker_d100 <= 5) { attackerSuccess = true; hitLabel = "CRIT SUCCESS"; }
      else if (effectiveRoll > successThreshold) { attackerSuccess = false; hitLabel = "MISS"; }

      // --- 2. LOOP TARGETS ---
      let sheetListHtml = `<div style="font-size:0.85em; color:#555; margin-bottom:5px; border-bottom:1px solid #ccc;">
          Attack Roll: <strong>${effectiveRoll}</strong> vs <strong>${successThreshold}</strong> (${hitLabel})
      </div>`;
      
      let payloadTargets = []; 

      for (const tid of targetIds) {
          const tToken = canvas.tokens.get(tid);
          if (!tToken) continue;
          
          const tActor = tToken.actor;
          const Def_Ecur = tActor.system.essences[defStat]?.value || 50;
          const Def_Tier = (tActor.type==='character') ? (tActor.system.resources.action_surges.max||0) : (tActor.system.tier||0);
          
          // DETERMINE DEFENSE ROLL
          // If Manual Def > 0 AND Single Target -> Use Manual
          // Else -> Auto Roll
          let Def_Roll = 0;
          let isAuto = false;
          
          if (targetIds.length === 1 && Manual_Def > 0) {
              Def_Roll = Manual_Def;
          } else {
              Def_Roll = Math.floor(Math.random() * 100) + 1;
              isAuto = true;
          }

          const D_Margin = Def_Roll - Def_Ecur; 
          let finalDamage = 0;
          let details = "";
          
          if (attackerSuccess) {
              let A_FP = 100 - effectiveRoll;
              if (Attacker_d100 <= 5) A_FP = 100 - (1 - R_prof);

              const M_Defense = Def_Tier * 5.5;
              let rawCalc = (A_FP - M_Defense + D_Margin + R_prof + itemBonus);
              let baseDamage = Math.max(R_prof, rawCalc); 
              if (baseDamage < 1) baseDamage = 1;

              // Tier Logic
              let mult = 1.0;
              const diff = Attacker_Tier - Def_Tier;
              if (diff >= 1) mult = 1.25; if (diff >= 2) mult = 1.50;
              if (diff === 0) mult = 1.00; if (diff === -1) mult = 0.75; if (diff <= -2) mult = 0.50;

              finalDamage = Math.max(1, Math.floor(baseDamage * mult));
              
              payloadTargets.push({ id: tid, damage: finalDamage, name: tToken.name });
              
              details = `<span style="font-size:0.8em; color:#555;">(Def:${Def_Roll}${isAuto?"A":""} | Tier ${Def_Tier} [x${mult}])</span>`;
          } else {
              details = `<span style="font-size:0.8em; color:#999;">(Missed)</span>`;
          }

          sheetListHtml += `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:2px 0;">
              <div><strong>${tToken.name}</strong> ${details}</div>
              <div style="font-weight:bold; color:#8b0000; font-size:1.1em;">${finalDamage}</div>
          </div>`;
      }

      // --- 3. ATTRITION ---
      let attritionCost = Math.max(0, itemWeight - Math.floor(R_prof / 2));
      if (Attacker_d100 <= 5) attritionCost = Math.floor(attritionCost / 2);
      if (Attacker_d100 >= 96) attritionCost = attritionCost * 2;

      sheetListHtml += `<div style="text-align:right; margin-top:5px; font-size:0.8em; color:#333; font-weight:bold;">Self Attrition: -${attritionCost}%</div>`;

      // --- 4. SAVE & RENDER ---
      const resolutionPayload = {
          essenceKey: motorKey,
          attritionCost: attritionCost,
          targets: payloadTargets 
      };
      
      await this.actor.update({
          "system.calculator.output": sheetListHtml,
          "system.calculator.batch_data": JSON.stringify(resolutionPayload) // Shows Execute Button
      });
  }

  /* -------------------------------------------- */
  /* EXECUTE BATCH (From Sheet Button)            */
  /* -------------------------------------------- */
  async _onExecuteBatch(event) {
      event.preventDefault();
      
      const rawData = this.actor.system.calculator.batch_data;
      if (!rawData) return;

      const { essenceKey, attritionCost, targets } = JSON.parse(rawData);

      // 1. Apply Attrition
      const currentVal = this.actor.system.essences[essenceKey].value;
      const newVal = Math.max(0, currentVal - attritionCost);
      await this.actor.update({ [`system.essences.${essenceKey}.value`]: newVal });

      // 2. Apply Damage
      let dmgCount = 0;
      if (targets && targets.length > 0) {
          for (const tData of targets) {
              const token = canvas.tokens.get(tData.id);
              if (token && token.actor) {
                  const currentHP = Number(token.actor.system.resources.hp.value) || 0;
                  const newHP = Math.max(0, currentHP - tData.damage);
                  await token.actor.update({ "system.resources.hp.value": newHP });
                  
                  if (newHP <= 0) {
                       const isDead = token.actor.effects.some(e => e.statusId === "dead" || (e.statuses && e.statuses.has("dead")));
                       if (!isDead) await token.actor.toggleStatusEffect("dead", { overlay: true });
                  }
                  dmgCount++;
              }
          }
      }

      // 3. Reset
      await this.actor.update({
          "system.calculator.attack_roll": 0,
          "system.calculator.prof_roll": 0,
          "system.calculator.defense_roll": 0,
          "system.calculator.batch_data": "",
          "system.calculator.output": `Resolution Complete. -${attritionCost}% Attrition.`
      });

      ui.notifications.info("Combat Resolution Complete.");
  }

  // Legacy
  _onItemControl(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const li = button.closest(".item");
    const item = this.actor.items.get(li?.dataset.itemId);
    switch ( button.dataset.action ) {
      case "create": const cls = getDocumentClass("Item"); return cls.create({name: game.i18n.localize("NAREQUENTA.ItemNew"), type: "item"}, {parent: this.actor});
      case "edit": return item.sheet.render(true);
      case "delete": return item.delete();
    }
  }
  
  _onRollSheetCalc(event) {
      event.preventDefault();
      const btn = $(event.currentTarget);
      const targetField = btn.data("target");
      const type = btn.data("type");
      const label = btn.data("label") || "Calculator Roll"; 
      let formula = "1d100";
      if (type === "prof") {
          let tier = (this.actor.type === 'character') ? (this.actor.system.resources.action_surges.max || 0) : (this.actor.system.tier || 0);
          if (tier === 0) {
              this.actor.update({ [targetField]: 0 });
              return;
          }
          formula = `${tier}d10`;
      }
      const roll = new Roll(formula);
      roll.evaluate().then(r => {
        if (game.dice3d) game.dice3d.showForRoll(r);
        r.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), flavor: label });
        this.actor.update({ [targetField]: r.total });
      });
  }

  async _onApplySheetDamage(event) {
     ui.notifications.info("Use the Batch Resolution workflow.");
  }
}
