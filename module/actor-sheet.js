import { EntitySheetHelper } from "./helper.js";
import { ATTRIBUTE_TYPES } from "./constants.js";

/**
 * Nárëquenta Actor Sheet
 * Handles the logic for Character and NPC sheets, including:
 * - Essence Management (E_max / E_cur)
 * - The Combat Calculator (Attacks, Damage, Attrition)
 * - Quick Breath & Recovery Logic
 * - Inventory & Item Management
 */
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
    
    // Pass system data to the template
    context.systemData = this.actor.system; 
    context.system = this.actor.system; 
    
    // Legacy Worldbuilding Helpers (Attributes tab)
    EntitySheetHelper.getAttributeData(actorData);
    context.shorthand = !!game.settings.get("narequenta", "macroShorthand");
    context.dtypes = ATTRIBUTE_TYPES;
    
    // Enrich Biography Text (HTML)
    context.biographyHTML = await TextEditor.enrichHTML(context.systemData.biography, {
      secrets: this.document.isOwner,
      async: true
    });

    // Combat Items Dropdown (Populates the Calculator Selection)
    // Filters for Weapons/Abilities and maps them for the select box
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

    // --- Standard Item Management ---
    html.find(".item-control").click(this._onItemControl.bind(this));
    html.find(".items .rollable").on("click", this._onItemRoll.bind(this));
    html.find(".item-use").click(this._onItemUse.bind(this)); // Consumables logic

    // --- Combat Calculator & Targeting ---
    html.find(".roll-calculation").click(this._onCalculate.bind(this));
    html.find(".execute-batch").click(this._onExecuteBatch.bind(this));
    html.find(".active-item-select").change(this._onSelectActiveItem.bind(this));
    html.find(".launch-contest").click(this._onLaunchContest.bind(this)); // Targeting Dialog
    html.find(".roll-calc-btn").click(this._onRollSheetCalc.bind(this));   // Inline dice rollers

    // --- Quick Breath Logic (NEW) ---
    html.find(".toggle-quick-breath").click(this._onToggleQuickBreath.bind(this));

    // --- Phase & Rest Utilities ---
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
  /* CALCULATOR: Item Selection Setup             */
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
    
    // [ADD THIS LINE HERE] Define the variable before using it below
    const weaponType = sys.weapon_type || "none"; 

    // Determine where damage applies (HP vs Essence)
    const damageTarget = sys.target_resource || "hp";

    // Evaluate Damage/Healing Formula (if static or simple math)
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

    // Update Actor Flags for Calculator State
    await this.actor.update({
        "system.calculator.selected_item_id": itemId,
        "system.calculator.item_name": item.name,
        "system.calculator.item_weight": weight,
        "system.calculator.item_bonus": bonusVal,
        "system.calculator.active_motor": motorKey,
        "system.calculator.active_motor_val": motorVal,
        "system.calculator.target_def_stat": motorKey, // Default: Defense matches Attack Essence
        "system.calculator.apply_to": damageTarget,
        "system.calculator.item_range": range,
        
        // [YOUR CODE GOES HERE]
        "system.calculator.weapon_type": weaponType, 
        
        "system.calculator.output": "", // Clear previous results
        "system.calculator.quick_breath_active": false // Selecting an item cancels Quick Breath
    });
    
    ui.notifications.info(`Active: ${item.name} (${range}ft). Motor: ${motorKey.toUpperCase()}.`);
}

  /* -------------------------------------------- */
  /* QUICK BREATH TOGGLE (New Logic)             */
  /* -------------------------------------------- */
  async _onToggleQuickBreath(event) {
      event.preventDefault();
      const currentState = this.actor.system.calculator.quick_breath_active || false;
      const newState = !currentState; // Toggle

      const updates = {
          "system.calculator.quick_breath_active": newState
      };

      if (newState) {
          // ACTIVATING: Prepare for recovery
          // 1. Clear Targets (Self-only action)
          updates["system.calculator.target_ids"] = [];
          updates["system.calculator.target_name"] = "Self (Quick Breath)";
          
          // 2. Reset Rolls to 0 to avoid confusion
          updates["system.calculator.attack_roll"] = 0;
          updates["system.calculator.defense_roll"] = 0;
          
          // 3. Set Visual Output explaining the action
          updates["system.calculator.output"] = `<div style="color: #d4af37; font-weight: bold; text-align: center; padding: 10px; background: #333; border: 1px solid #d4af37;">
              <i class="fas fa-lungs"></i> QUICK BREATH PREPARED<br>
              <span style="font-size: 0.8em; font-weight: normal; color: #ccc;">
                  Recovers Vigor (Sum of D_prof).<br>
                  <strong style="color: #ff6666;">⚠️ ENDS TURN IMMEDIATELY</strong>
              </span>
          </div>`;
          
          // 4. Create dummy batch data to enable the "EXECUTE" button
          updates["system.calculator.batch_data"] = JSON.stringify({ mode: "quick_breath" });
          
      } else {
          // DEACTIVATING: Reset to neutral state
          updates["system.calculator.target_name"] = "None";
          updates["system.calculator.output"] = "";
          updates["system.calculator.batch_data"] = "";
      }

      await this.actor.update(updates);
  }

  /* -------------------------------------------- */
  /* CALCULATE ATTACK (Pre-computation)          */
  /* -------------------------------------------- */
  async _onCalculate(event) {
      event.preventDefault();
      const calc = this.actor.system.calculator;
      const targetIds = calc.target_ids || [];

      // --- Safety Checks ---
      const rawAttack = calc.attack_roll;
      if (!rawAttack && rawAttack !== 0) { ui.notifications.warn("Please roll Attack (d100)."); return; }
      if (Number(rawAttack) === 0) { ui.notifications.warn("Attack cannot be 0."); return; }
      if (!Array.isArray(targetIds) || targetIds.length === 0) { ui.notifications.warn("No targets selected."); return; }

      // --- Gather Inputs ---
      const Attacker_d100 = Number(calc.attack_roll);
      const R_prof = Number(calc.prof_roll) || 0;
      const Manual_Def = Number(calc.defense_roll) || 0;
      const itemBonus = Number(calc.item_bonus) || 0;
      const itemWeight = (typeof calc.item_weight !== "undefined") ? Number(calc.item_weight) : 15; 
      
      // [NEW] Get Weapon Type to apply specific rules
      const weaponType = calc.weapon_type || "none";

      const motorKey = calc.active_motor || "vitalis";
      const E_max = this.actor.system.essences[motorKey]?.max || 100;
      const E_cur = this.actor.system.essences[motorKey]?.value || 100;
      const defStat = calc.target_def_stat || "vitalis";
      const targetResource = calc.apply_to || "hp";

      let Attacker_Tier = (this.actor.type === 'character') 
          ? (this.actor.system.resources.action_surges.max || 0) 
          : (this.actor.system.tier || 0);

      // --- Determine Mode (Healing vs Damage) ---
      const isHealing = itemBonus < 0;
      const isPotion = isHealing && (itemWeight === 0);

      // --- Hit Check (Zone Logic) ---
      const effectiveRoll = Attacker_d100 - R_prof;
      let zonePenalty = 0;
      // Zone Thresholds
      if (E_cur <= 25) zonePenalty = 30;      // Hollow
      else if (E_cur <= 50) zonePenalty = 20; // Fading
      else if (E_cur <= 75) zonePenalty = 10; // Waning

      const successThreshold = E_max - zonePenalty;
      let attackerSuccess = true;
      let hitLabel = "SUCCESS";

      // Criticals & Failures
      if (Attacker_d100 >= 96) { attackerSuccess = false; hitLabel = "CRIT FAIL"; }
      else if (Attacker_d100 <= 5) { attackerSuccess = true; hitLabel = "CRIT SUCCESS"; }
      else if (effectiveRoll > successThreshold) { attackerSuccess = false; hitLabel = "MISS"; }

      // --- Build Output HTML ---
      let sheetListHtml = `<div style="font-size:0.85em; color:#555; margin-bottom:5px; border-bottom:1px solid #ccc;">
          Attack: <strong>${effectiveRoll}</strong> vs <strong>${successThreshold}</strong> (${hitLabel})
      </div>`;
      
      let chatTableRows = ""; 
      let payloadTargets = [];

      // Loop through targets to calculate damage individually
      for (const tid of targetIds) {
          const tToken = canvas.tokens.get(tid);
          if (!tToken) continue;
          
          const tActor = tToken.actor;
          const Def_Ecur = tActor.system.essences[defStat]?.value || 50;
          const Def_Tier = (tActor.type==='character') 
              ? (tActor.system.resources.action_surges.max||0) 
              : (tActor.system.tier||0);
          
          // Defense Roll
          let Def_Roll = (targetIds.length === 1 && Manual_Def > 0) 
              ? Manual_Def 
              : Math.floor(Math.random() * 100) + 1;
              
          const D_Margin = Def_Roll - Def_Ecur; 
          
          let finalDamage = 0;
          let details = "";
          let resultColor = "#333";
          
          if (attackerSuccess) {
              if (isHealing) {
                  // HEALING FORMULA
                  let healAmount = Math.abs(itemBonus);
                  if (!isPotion) healAmount += R_prof;
                  finalDamage = -Math.max(1, healAmount); 
                  resultColor = "#006400"; 
              } else {
                  // DAMAGE FORMULA
                  // 1. Calculate Full Potential (A_FP)
                  let A_FP = 100 - effectiveRoll;
                  if (Attacker_d100 <= 5) A_FP = 100 - (1 - R_prof); 
                  
                  // [NEW] RULE: Slashing Weapons add 1d4 to A_FP (Force & Will)
                  if (weaponType === "slashing") {
                      const slashBonus = Math.floor(Math.random() * 4) + 1;
                      A_FP += slashBonus;
                      details += ` (Slash +${slashBonus})`;
                  }

                  // 2. Mitigation
                  const M_Defense = Def_Tier * 5.5;
                  
                  // 3. Raw Calc
                  let rawCalc = (A_FP - M_Defense + D_Margin + R_prof + itemBonus);
                  
                  // 4. Hard Floor (Proficiency)
                  let baseDamage = Math.max(R_prof, rawCalc);
                  if (baseDamage < 1) baseDamage = 1;

                  // 5. Tier Advantage Multiplier
                  let mult = 1.0;
                  const diff = Attacker_Tier - Def_Tier;
                  if (diff >= 1) mult = 1.25; 
                  if (diff >= 2) mult = 1.50;
                  if (diff === 0) mult = 1.00; 
                  if (diff === -1) mult = 0.75;
                  if (diff <= -2) mult = 0.50;

                  finalDamage = Math.max(1, Math.floor(baseDamage * mult));
                  resultColor = "#8b0000"; 
              }
              
              payloadTargets.push({ id: tid, damage: finalDamage, name: tToken.name });
              if (!details.includes("Slash")) details += ` (Def:${Def_Roll})`;
              else details += ` / (Def:${Def_Roll})`;
              
              // Chat Log Row
              chatTableRows += `<tr>
                  <td style="text-align:left;">${tToken.name}</td>
                  <td style="text-align:center;">${Def_Roll}</td>
                  <td style="text-align:right; font-weight:bold; color:${resultColor};">
                      ${finalDamage > 0 ? finalDamage : '+' + Math.abs(finalDamage)}
                  </td>
              </tr>`;
          } else {
              // Missed
              details = `(Missed)`;
              chatTableRows += `<tr><td style="text-align:left; color:#999;">${tToken.name}</td><td colspan="2" style="text-align:center; color:#999;">Evaded</td></tr>`;
          }

          // Sheet Preview Row
          sheetListHtml += `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:2px 0;">
              <div><strong>${tToken.name}</strong> <span style="font-size:0.8em; color:#555;">${details}</span></div>
              <div style="font-weight:bold; color:${resultColor}; font-size:1.1em;">
                  ${finalDamage > 0 ? finalDamage : '+' + Math.abs(finalDamage)}
              </div>
          </div>`;
      }

      // --- Calculate Self Attrition ---
      let attritionCost = Math.max(0, itemWeight - Math.floor(R_prof / 2));
      
      // [NEW] RULE: Piercing Weapons ignore 1% Attrition Cost (Precision)
      if (weaponType === "piercing") {
          attritionCost = Math.max(0, attritionCost - 1);
      }

      if (Attacker_d100 <= 5) attritionCost = Math.floor(attritionCost / 2); // Crit success reduces cost
      if (Attacker_d100 >= 96) attritionCost = attritionCost * 2;            // Crit fail doubles cost
      
      sheetListHtml += `<div style="text-align:right; margin-top:5px; font-size:0.8em; color:#333; font-weight:bold;">Self Attrition: -${attritionCost}%</div>`;

      // --- Save Results for Batch Execution ---
      const resolutionPayload = { essenceKey: motorKey, attritionCost: attritionCost, targets: payloadTargets, targetResource: targetResource, mode: "attack" };
      await this.actor.update({
          "system.calculator.output": sheetListHtml,
          "system.calculator.batch_data": JSON.stringify(resolutionPayload) 
      });

      // --- Send to Chat ---
      ChatMessage.create({ 
          speaker: ChatMessage.getSpeaker({ actor: this.actor }), 
          content: `
          <div class="narequenta chat-card">
              <h3>${isHealing ? "Restoration" : "Attack Resolution"}</h3>
              <div><strong>Status:</strong> ${hitLabel} ${weaponType !== "none" ? `(${weaponType.toUpperCase()})` : ""}</div>
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
  /* TARGETING DIALOG (AoE & Selection)          */
  /* -------------------------------------------- */
  _onLaunchContest(event) {
      if(event) event.preventDefault();
      
      const attacker = this.actor;
      const calc = attacker.system.calculator;
      const range = calc.item_range || 5;
      const defaultDef = calc.active_motor || "vitalis";
      
      const itemId = calc.selected_item_id;
      const item = attacker.items.get(itemId);
      const targetType = item?.system.target_type || "one"; 
      
      const isHealing = (Number(calc.item_bonus) || 0) < 0;
      const tier = (attacker.type === 'character') 
          ? (attacker.system.resources.action_surges.max || 0) 
          : (attacker.system.tier || 0);

      const tokens = attacker.getActiveTokens();
      if (tokens.length === 0) { ui.notifications.warn("Place token on scene."); return; }
      
      // Build Target List
      let pcHtml = "";
      let npcHtml = ""; 
      let count = 0;
      
      canvas.tokens.placeables.forEach(t => {
          if (t.id === tokens[0].id) return; // Don't target self
          const dist = canvas.grid.measureDistance(tokens[0], t);
          
          if (dist <= range && t.actor?.system.resources?.hp?.value > 0) {
              const entry = `<div style="padding:2px;"><input type="checkbox" name="target" value="${t.id}" class="target-checkbox" data-type="${t.actor.type}"> <strong>${t.name}</strong> (${Math.round(dist)}ft)</div>`;
              if (t.actor.type === "character") pcHtml += entry; else npcHtml += entry;
              count++;
          }
      });

      if (count === 0) { ui.notifications.warn(`No targets within ${range}ft.`); return; }

      // Auto-Select Logic
      let autoSelectScript = "";
      if (targetType === "aoe") {
          if (isHealing) {
              autoSelectScript = `$('input[data-type="character"]').prop('checked', true);`;
          } else {
              if (tier >= 3) autoSelectScript = `$('input[data-type="npc"]').prop('checked', true);`; // Mastery
              else autoSelectScript = `$('input.target-checkbox').prop('checked', true);`; // Wild
          }
      } else {
          autoSelectScript = ""; // Manual
      }

      // Defensive Options
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
          ${autoSelectScript}
          $("#auto-select-btn").click(function() { 
              const anyChecked = $("input:checkbox:checked").length > 0;
              if (anyChecked) { $("input:checkbox").prop('checked', false); } else { ${autoSelectScript || `$('input.target-checkbox').prop('checked', true);`} }
          });
      </script>`;

      new Dialog({ 
          title: `Targeting (${targetType.toUpperCase()})`, 
          content: content, 
          buttons: { 
              confirm: { 
                  label: "Lock", 
                  icon: "<i class='fas fa-crosshairs'></i>",
                  callback: async (html) => {
                      const ids = []; 
                      const names = [];
                      
                      html.find("input:checked").each(function(){ 
                          ids.push($(this).val());
                          const t = canvas.tokens.get($(this).val());
                          if (t) names.push(t.name);
                      });
                      
                      if(ids.length) {
                          // Display Names logic
                          let nameString = names.join(", ");
                          if (nameString.length > 25) nameString = names.length + " Targets Selected";

                          await attacker.update({ 
                              "system.calculator.target_ids": ids, 
                              "system.calculator.target_def_stat": html.find("#target-essence").val(), 
                              "system.calculator.target_name": nameString,
                              
                              // [NEW] Reset Rolls to 0 on new selection
                              "system.calculator.attack_roll": 0,
                              "system.calculator.defense_roll": 0,
                              
                              // [NEW] Disable Quick Breath if targeting manually
                              "system.calculator.quick_breath_active": false
                          });
                      }
                  }
              }
          }
      }).render(true);
  }

  /* -------------------------------------------- */
  /* EXECUTE BATCH (Apply Damage & Flow Control) */
  /* -------------------------------------------- */
  async _onExecuteBatch(event) {
      event.preventDefault();
      const rawData = this.actor.system.calculator.batch_data;
      if (!rawData) return;
      const payload = JSON.parse(rawData);

      // ==========================================
      // CASE A: QUICK BREATH (Combat Recovery)
      // ==========================================
      if (payload.mode === "quick_breath") {
          // 1. Calculate Dice (Based on Tier)
          const isChar = this.actor.type === "character";
          const tier = isChar ? (this.actor.system.resources.action_surges.max || 0) : (this.actor.system.tier || 0);
          const diceCount = Math.max(1, tier);
          const formula = `${diceCount}d10`;

          const r = new Roll(formula);
          await r.evaluate();
          if (game.dice3d) game.dice3d.showForRoll(r);

          // 2. Apply Recovery to Essences (Cap at 100)
          const updates = {};
          for (const [key, essence] of Object.entries(this.actor.system.essences)) {
              if (essence.value < 100) {
                  updates[`system.essences.${key}.value`] = Math.min(100, essence.value + r.total);
              }
          }
          
          // 3. Reset State
          updates["system.calculator.quick_breath_active"] = false;
          updates["system.calculator.batch_data"] = "";
          updates["system.calculator.output"] = "Quick Breath Complete.";
          updates["system.calculator.target_name"] = "None";

          await this.actor.update(updates);

          // 4. Chat Message
          ChatMessage.create({ 
              speaker: ChatMessage.getSpeaker({ actor: this.actor }), 
              content: `<div class="narequenta chat-card">
                  <h3 style="color:#8b0000; border-bottom:1px solid #8b0000">Quick Breath</h3>
                  <div style="font-weight:bold; color:#a00; font-size:0.85em;">⚠️ ENDS TURN</div>
                  <div style="text-align:center; font-size:1.2em; margin-top:5px;">Recovered <strong>${r.total}%</strong> Vigor</div>
              </div>` 
          });

          // 5. FORCE END TURN
          this._onEndTurn(event);
          return;
      }

      // ==========================================
      // CASE B: STANDARD ATTACK / ACTION
      // ==========================================
      
      const { essenceKey, attritionCost, targets, targetResource } = payload;
      
      // 1. Apply Self Attrition
      const currentVal = this.actor.system.essences[essenceKey].value;
      const newVal = Math.max(0, currentVal - attritionCost);
      await this.actor.update({ [`system.essences.${essenceKey}.value`]: newVal });

      // 2. Apply Damage/Healing to Targets
      if (targets && targets.length > 0) {
          for (const tData of targets) {
              const token = canvas.tokens.get(tData.id);
              if (token && token.actor) {
                  // Determine Destination
                  const applyTo = targetResource || "hp";
                  let currentTVal = 0;
                  let maxTVal = 100;
                  let updatePath = "";

                  if (applyTo === "hp") {
                      currentTVal = token.actor.system.resources.hp.value;
                      maxTVal = token.actor.system.resources.hp.max;
                      updatePath = "system.resources.hp.value";
                  } else {
                      currentTVal = token.actor.system.essences[applyTo]?.value || 0;
                      maxTVal = token.actor.system.essences[applyTo]?.max || 100;
                      updatePath = `system.essences.${applyTo}.value`;
                  }

                  let finalVal = currentTVal - tData.damage;
                  if (finalVal < 0) finalVal = 0;
                  if (finalVal > maxTVal) finalVal = maxTVal;

                  await token.actor.update({ [updatePath]: finalVal });
                  
                  // Dead Status Check (Only for HP)
                  if (applyTo === "hp" && finalVal <= 0 && tData.damage > 0) {
                       const isDead = token.actor.effects.some(e => e.statusId === "dead" || (e.statuses && e.statuses.has("dead")));
                       if (!isDead) await token.actor.toggleStatusEffect("dead", { overlay: true });
                  }
              }
          }
      }

      // 3. Reset Calculator
      await this.actor.update({
          "system.calculator.attack_roll": 0,
          "system.calculator.prof_roll": 0,
          "system.calculator.defense_roll": 0,
          "system.calculator.batch_data": "",
          "system.calculator.output": `Applied. -${attritionCost}% Attrition.`
      });
      ui.notifications.info("Resolution Complete.");

      // ==========================================
      // CASE C: ACTION SURGE CHECK (Flow Control)
      // ==========================================
      if (this.actor.type === "character") {
          const surges = this.actor.system.resources.action_surges.value;
          if (surges > 0) {
              // Prompt to Spend Surge or End Turn
              new Dialog({
                  title: "End of Action",
                  content: `<div style="text-align:center;">
                      <p>Your action is complete.</p>
                      <p>You have <strong>${surges}</strong> Surge(s) remaining.</p>
                      <p>Spend one to <strong>Act Again</strong>?</p>
                  </div>`,
                  buttons: {
                      yes: {
                          label: "Yes (Surge!)",
                          icon: "<i class='fas fa-bolt'></i>",
                          callback: async () => {
                              // Spend Surge, Keep Turn
                              await this.actor.update({"system.resources.action_surges.value": surges - 1});
                              ChatMessage.create({ 
                                  speaker: ChatMessage.getSpeaker({ actor: this.actor }), 
                                  content: `<div class="narequenta chat-card"><h3 style="color:#d4af37">Action Surge!</h3><p>The turn continues...</p></div>` 
                              });
                          }
                      },
                      no: {
                          label: "No (End Turn)",
                          icon: "<i class='fas fa-step-forward'></i>",
                          callback: () => {
                              // Standard End Turn
                              this._onEndTurn(event);
                          }
                      }
                  },
                  default: "no"
              }).render(true);
          } else {
              // No surges = Auto End
              this._onEndTurn(event);
          }
      } else {
          // NPCs = Auto End
          this._onEndTurn(event);
      }
  }

  /* -------------------------------------------- */
  /* UTILITY: End Turn                           */
  /* -------------------------------------------- */
  async _onEndTurn(event) {
      if(event) event.preventDefault();
      const combat = game.combat;
      if (!combat) return;
      
      await combat.nextTurn();
      // Close current sheet, open next
      this.close();
      if (combat.combatant?.actor) combat.combatant.actor.sheet.render(true);
  }

  /* -------------------------------------------- */
  /* UTILITY: Consumables (Use Button)           */
  /* -------------------------------------------- */
  async _onItemUse(event) {
      event.preventDefault();
      const li = $(event.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      if (!item) return;

      const sys = item.system;
      const qty = sys.quantity || 0;
      const type = sys.target_type || "one"; 
      const resourceKey = sys.target_resource || "hp"; 

      if (qty <= 0) { ui.notifications.warn("Item Depleted."); return; }

      const executeConsume = async (targetActor) => {
          await item.update({ "system.quantity": qty - 1 });
          const formula = sys.damage_bonus || "0";
          try {
              const r = new Roll(formula);
              await r.evaluate();
              if (game.dice3d) game.dice3d.showForRoll(r);
              
              let currentPath, maxPath, label, currentVal, maxVal;

              if (resourceKey === "hp") {
                  currentPath = "system.resources.hp.value";
                  maxPath = "system.resources.hp.max";
                  currentVal = targetActor.system.resources.hp.value;
                  maxVal = targetActor.system.resources.hp.max;
                  label = "HP";
              } else {
                  currentPath = `system.essences.${resourceKey}.value`;
                  maxPath = `system.essences.${resourceKey}.max`;
                  currentVal = targetActor.system.essences[resourceKey]?.value || 0;
                  maxVal = targetActor.system.essences[resourceKey]?.max || 100;
                  label = resourceKey.toUpperCase();
              }

              let change = 0;
              let newVal = 0;

              if (r.total < 0) { // Healing
                  change = Math.abs(r.total);
                  newVal = Math.min(maxVal, currentVal + change);
                  ui.notifications.info(`${targetActor.name}: Recovered ${change} ${label}.`);
              } else { // Damage
                  change = r.total;
                  newVal = Math.max(0, currentVal - change);
                  ui.notifications.info(`${targetActor.name}: Lost ${change} ${label}.`);
              }

              await targetActor.update({ [currentPath]: newVal });
              r.toMessage({ 
                  speaker: ChatMessage.getSpeaker({ actor: this.actor }), 
                  flavor: `Consumed: ${item.name} (${label} ${r.total < 0 ? "+" : "-"}${change})` 
              });
          } catch (e) { console.error(e); }
      };

      if (type === "self") {
          executeConsume(this.actor);
      } else {
          new Dialog({
              title: `Use ${item.name}`,
              content: `<p>Target: <strong>${resourceKey.toUpperCase()}</strong></p>`,
              buttons: {
                  self: { label: "Self", icon: "<i class='fas fa-user'></i>", callback: () => executeConsume(this.actor) },
                  target: { label: "Target", icon: "<i class='fas fa-bullseye'></i>", callback: () => {
                          const targets = Array.from(game.user.targets);
                          if (targets.length !== 1) { ui.notifications.warn("Select exactly 1 target."); return; }
                          executeConsume(targets[0].actor);
                      }
                  }
              },
              default: "self"
          }).render(true);
      }
  }

  /* -------------------------------------------- */
  /* REST & RECOVERY (Manual Buttons)            */
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
      await this.actor.update(updates);
      ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `<div class="narequenta chat-card"><h3>Renewal</h3><p>Restored to 100%.</p></div>` });
    }
  }

  async _onShortRest(event) {
    event.preventDefault();
    // 1. Determine Dice
    const isChar = this.actor.type === "character";
    const tier = isChar ? (this.actor.system.resources.action_surges.max || 0) : (this.actor.system.tier || 0);
    const diceCount = Math.max(1, tier);
    const formula = `${diceCount}d10`;

    const content = `
    <div class="narequenta">
        <div style="background:#f0f0f0; padding:8px; border-radius:4px; font-size:0.9em;">
            <div><strong>Proficiency Tier:</strong> ${tier}</div>
            <div><strong>Recovery Formula:</strong> ${formula}</div>
        </div>
        <p style="font-size:0.8em; margin-top:5px; color:#555;">Restores Active Vigor ($E_{cur}$) to all Essences.</p>
    </div>`;
    new Dialog({
      title: "Short Rest (Respite)",
      content: content,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: "Roll Recovery",
          callback: async (html) => {
            const rollObj = new Roll(formula);
            await rollObj.evaluate();
            if (game.dice3d) game.dice3d.showForRoll(rollObj);
            
            const updates = {};
            for (const [key, essence] of Object.entries(this.actor.system.essences)) {
                if (essence.value < 100) updates[`system.essences.${key}.value`] = Math.min(100, essence.value + rollObj.total);
            }
            const hp = this.actor.system.resources.hp;
            if (hp.value < hp.max) updates[`system.resources.hp.value`] = Math.min(hp.max, hp.value + rollObj.total);

            await this.actor.update(updates);
            
            ChatMessage.create({ 
                speaker: ChatMessage.getSpeaker({ actor: this.actor }), 
                content: `<div class="narequenta chat-card"><h3 style="color:#2e8b57;">Short Rest</h3><div style="text-align:center;">Recovered <strong>${rollObj.total}%</strong> Vigor</div></div>` 
            });
          }
        }
      }
    }).render(true);
  }

  /* -------------------------------------------- */
  /* LEGACY / MISC HANDLERS                      */
  /* -------------------------------------------- */
  async _onUseActionSurge(event) {
      event.preventDefault();
      const current = this.actor.system.resources.action_surges.value;
      if (current > 0) {
          await this.actor.update({"system.resources.action_surges.value": current - 1});
          ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `<div class="narequenta chat-card"><h3 style="color:#d4af37">Action Surge!</h3><p>Remaining: ${current - 1}</p></div>` });
      } else { ui.notifications.warn("No Action Surges left."); }
  }

  _onItemControl(event) { 
    event.preventDefault(); const btn = event.currentTarget;
    const li = btn.closest(".item"); const item = this.actor.items.get(li?.dataset.itemId);
    if(btn.dataset.action === "create") return getDocumentClass("Item").create({name: game.i18n.localize("NAREQUENTA.ItemNew"), type: "item"}, {parent: this.actor});
    if(btn.dataset.action === "edit") return item.sheet.render(true);
    if(btn.dataset.action === "delete") return item.delete();
  }
  
  _onItemRoll(event) { 
    event.preventDefault(); const li = $(event.currentTarget).parents(".item");
    const id = li.data("itemId");
    const dropdown = this.element.find(".active-item-select");
    if(dropdown.length) dropdown.val(id).change(); else this._onSelectActiveItem({target:{value:id}, preventDefault:()=>{}});
  }

  _onRollSheetCalc(event) { 
      event.preventDefault();
      const btn = $(event.currentTarget);
      const type = btn.data("type"); const target = btn.data("target");
      let formula = "1d100";
      if (type === "prof") {
          let tier = (this.actor.type === 'character') ? (this.actor.system.resources.action_surges.max||0) : (this.actor.system.tier||0);
          if(tier===0) { this.actor.update({[target]:0}); return; }
          formula = `${tier}d10`;
      }
      new Roll(formula).evaluate().then(r => { if(game.dice3d) game.dice3d.showForRoll(r); this.actor.update({[target]: r.total}); });
  }

  async _onWaningPhase(event) { /* Placeholder for Waning Roll logic if implemented elsewhere */ }
}
