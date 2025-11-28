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

    // NEW: Prepare Combat Items List for Dropdown
    context.combatItems = this.actor.items.filter(i => ["weapon", "ability"].includes(i.type))
        .map(i => ({
            id: i.id,
            name: i.name,
            range: i.system.range || 2,
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
    
    // CALCULATOR LISTENERS
    html.find(".roll-calculation").click(this._onCalculate.bind(this));
    html.find(".execute-batch").click(this._onExecuteBatch.bind(this));
    
    // NEW: Active Item Dropdown Listener
    html.find(".active-item-select").change(this._onSelectActiveItem.bind(this));

    // Targeting & Dice
    html.find(".launch-contest").click(this._onLaunchContest.bind(this));
    html.find(".roll-calc-btn").click(this._onRollSheetCalc.bind(this));    

    // Phase & Rest
    html.find(".waning-toggle").change(ev => {
        const isChecked = ev.target.checked;
        if (isChecked) html.find(".waning-roll-btn").slideDown();
        else html.find(".waning-roll-btn").slideUp();
    });
    html.find(".waning-roll-btn").click(this._onWaningPhase.bind(this));
    html.find(".short-rest").click(this._onShortRest.bind(this));
    html.find(".long-rest").click(this._onLongRest.bind(this));
  }

  /* -------------------------------------------- */
  /* NEW: DROPDOWN ITEM SELECTION                 */
  /* -------------------------------------------- */
  async _onSelectActiveItem(event) {
      event.preventDefault();
      const itemId = event.target.value;
      const item = this.actor.items.get(itemId);

      if (!item) return;

      const sys = item.system;
      const motorKey = sys.cost?.motor || "vitalis";
      
      // Get Values
      const motorVal = this.actor.system.essences[motorKey]?.value || 0;
      const weight = Number(sys.weight) || 15; 
      const dmgBonus = Number(sys.damage_bonus) || 0;
      const range = Number(sys.range) || 2; 

      // Update Calculator State
      await this.actor.update({
          "system.calculator.selected_item_id": itemId, // Persist selection
          "system.calculator.item_name": item.name,
          "system.calculator.item_weight": weight,
          "system.calculator.item_bonus": dmgBonus,
          "system.calculator.active_motor": motorKey,
          "system.calculator.active_motor_val": motorVal,
          "system.calculator.item_range": range,
          "system.calculator.output": "" // Reset results
      });

      ui.notifications.info(`Active: ${item.name} (${range}m). Motor: ${motorKey.toUpperCase()}.`);
  }

  /* -------------------------------------------- */
  /* LEGACY: ITEM ROLL (Kept for Click-to-Load)   */
  /* -------------------------------------------- */
  async _onItemRoll(event) {
    event.preventDefault();
    const button = $(event.currentTarget);
    const li = button.parents(".item");
    const itemId = li.data("itemId");
    
    // Simulate selection event
    // We update the dropdown visually and trigger logic
    const dropdown = this.element.find(".active-item-select");
    if(dropdown.length) {
        dropdown.val(itemId).change(); 
    } else {
        // Fallback if sheet not rendered
        const dummyEvent = { target: { value: itemId }, preventDefault: () => {} };
        this._onSelectActiveItem(dummyEvent);
    }
  }

  /* -------------------------------------------- */
  /* TACTICAL TARGETING UI                        */
  /* -------------------------------------------- */
  _onLaunchContest(event) {
      if(event) event.preventDefault();
      const attacker = this.actor;
      
      // Use currently loaded range
      let maxDist = this.actor.system.calculator.item_range || 2;
      
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
                  icon: '<i class="fas fa-crosshairs"></i>',
                  label: "Lock Targets",
                  callback: async (html) => {
                      const selectedIds = [];
                      html.find("input[name='target']:checked").each(function() {
                          selectedIds.push($(this).val());
                      });

                      if (selectedIds.length === 0) return;

                      const essenceKey = html.find("#target-essence").val();
                      const essenceLabel = essenceKey.toUpperCase();

                      await attacker.update({
                          "system.calculator.target_ids": selectedIds, 
                          "system.calculator.target_name": `${selectedIds.length} Target(s) (${essenceLabel})`,
                          "system.calculator.target_def_stat": essenceKey,
                          "system.calculator.batch_data": "",
                          "system.calculator.output": ""
                      });
                  }
              }
          },
          default: "confirm"
      }).render(true);
  }

  // ... [RETAIN ALL OTHER EXISTING METHODS: _onCalculate, _onExecuteBatch, _onRollSheetCalc, Rest Logic] ...
  // (Paste previous versions of _onCalculate, _onExecuteBatch, _onLongRest, _onShortRest, _onWaningPhase here)
  
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
      const Manual_Def = Number(calc.defense_roll) || 0;
      const itemBonus = Number(calc.item_bonus) || 0;
      const itemWeight = Number(calc.item_weight) || 15; 
      
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
          
          let Def_Roll = 0;
          let isAuto = false;
          
          // Use manual if single target and value > 0
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

      let attritionCost = Math.max(0, itemWeight - Math.floor(R_prof / 2));
      if (Attacker_d100 <= 5) attritionCost = Math.floor(attritionCost / 2);
      if (Attacker_d100 >= 96) attritionCost = attritionCost * 2;

      sheetListHtml += `<div style="text-align:right; margin-top:5px; font-size:0.8em; color:#333; font-weight:bold;">Self Attrition: -${attritionCost}%</div>`;

      const resolutionPayload = { essenceKey: motorKey, attritionCost: attritionCost, targets: payloadTargets };
      
      await this.actor.update({
          "system.calculator.output": sheetListHtml,
          "system.calculator.batch_data": JSON.stringify(resolutionPayload) 
      });
  }

  async _onExecuteBatch(event) {
      event.preventDefault();
      const rawData = this.actor.system.calculator.batch_data;
      if (!rawData) return;

      const { essenceKey, attritionCost, targets } = JSON.parse(rawData);

      // 1. Attrition
      const currentVal = this.actor.system.essences[essenceKey].value;
      const newVal = Math.max(0, currentVal - attritionCost);
      await this.actor.update({ [`system.essences.${essenceKey}.value`]: newVal });

      // 2. Damage
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
  
  // Waning, Rest, etc... (ensure they are present from previous files)
  async _onLongRest(event) { /* ... Same as previous ... */ }
  async _onShortRest(event) { /* ... Same as previous ... */ }
  async _onWaningPhase(event) { /* ... Same as previous ... */ }
  async _onApplySheetDamage(event) { /* ... Same as previous ... */ }
}
