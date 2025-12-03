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
    
    // 1. Core System Data
    context.systemData = this.actor.system; 
    context.system = this.actor.system; 
    
    // 2. Attribute & Group Handling (Legacy/Helper)
    EntitySheetHelper.getAttributeData(actorData);
    context.shorthand = !!game.settings.get("narequenta", "macroShorthand");
    context.dtypes = ATTRIBUTE_TYPES;

    // 3. Biography Enrichment
    context.biographyHTML = await TextEditor.enrichHTML(context.systemData.biography, {
      secrets: this.document.isOwner,
      async: true
    });

    // 4. Combat Items Dropdown (for Calculator)
    context.combatItems = this.actor.items.filter(i => ["weapon", "ability"].includes(i.type))
        .map(i => ({
            id: i.id,
            name: i.name,
            range: i.system.range || 5, // 5ft Default
            type: i.type.toUpperCase()
        }));

    // 5. [NEW] Combatant Lists (Allies vs Enemies)
    // Populates the sidebar lists if a combat is active
    context.allies = [];
    context.enemies = [];

    if (game.combat) {
        // Determine "My" disposition to filter who is friend or foe
        let myDisposition = 1; // Default: Friendly
        
        // Try to get the disposition from the specific token linked to this sheet
        if (this.token) {
            myDisposition = this.token.disposition;
        } else {
            // If sheet is opened from Sidebar, try to find an active token on the scene
            const activeTokens = this.actor.getActiveTokens();
            if (activeTokens.length > 0) {
                myDisposition = activeTokens[0].document.disposition;
            } else {
                // Fallback based on Actor Type (PC = Friendly, NPC = Hostile)
                myDisposition = (this.actor.type === "character") ? 1 : -1;
            }
        }

        // Iterate through combatants
        for (let c of game.combat.combatants) {
            if (c.actorId === this.actor.id) continue; // Skip self
            if (!c.token) continue; // Skip invalid tokens

            const targetDisp = c.token.disposition;
            
            // Prepare lightweight data object for the Handlebars loop
            const combatantData = {
                id: c.id,
                name: c.name,
                img: c.img,
                isDead: c.isDefeated
            };

            // Logic: Same disposition = Ally. Different = Enemy.
            // Note: Neutral (0) tokens will appear as Enemies to Friendly/Hostile actors here.
            if (targetDisp === myDisposition) {
                context.allies.push(combatantData);
            } else {
                context.enemies.push(combatantData);
            }
        }
    }

    return context;
  }

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    
    // Exit if sheet is not editable
    if (!this.isEditable) return;

    // -------------------------------------------------------------
    // 1. STANDARD ITEM & SHEET CONTROLS
    // -------------------------------------------------------------
    html.find(".item-control").click(this._onItemControl.bind(this));
    html.find(".items .rollable").on("click", this._onItemRoll.bind(this));
    html.find(".item-use").click(this._onItemUse.bind(this));

    // -------------------------------------------------------------
    // 2. CALCULATOR & COMBAT INPUTS
    // -------------------------------------------------------------
    html.find(".roll-calculation").click(this._onCalculate.bind(this));
    html.find(".execute-batch").click(this._onExecuteBatch.bind(this));
    html.find(".active-item-select").change(this._onSelectActiveItem.bind(this));
    
    // Dice Rolling Helpers for Calculator
    html.find(".roll-calc-btn").click(this._onRollSheetCalc.bind(this));    
    
    // Targeting Dialog (Updated Logic)
    html.find(".launch-contest").click(this._onLaunchContest.bind(this));

    // -------------------------------------------------------------
    // 3. RESOURCE & PHASE MANAGEMENT
    // -------------------------------------------------------------
    // Waning Phase Toggle
    html.find(".waning-toggle").change(ev => {
        const isChecked = ev.target.checked;
        if (isChecked) html.find(".waning-roll-btn").slideDown();
        else html.find(".waning-roll-btn").slideUp();
    });
    html.find(".waning-roll-btn").click(this._onWaningPhase.bind(this));

    // Standard Rests (Legacy/Utility)
    html.find(".short-rest").click(this._onShortRest.bind(this));
    html.find(".long-rest").click(this._onLongRest.bind(this));
    
    // Action Surge (PC Only)
    html.find(".use-action-surge").click(this._onUseActionSurge.bind(this));

    // -------------------------------------------------------------
    // 4. NEW UI ELEMENTS (NSA-v0.7 Updates)
    // -------------------------------------------------------------
    
    // End Turn (Footer Button)
    html.find(".end-turn").click(this._onEndTurn.bind(this));

    // Quick Breath (Header Button)
    // Performs a 1d10 recovery to all Essences and HP (Capped at Max)
    html.find('.quick-breath').click(async ev => {
        ev.preventDefault();
        
        // 1. Roll Recovery (1d10 per rules)
        const roll = await new Roll("1d10").evaluate();
        if (game.dice3d) game.dice3d.showForRoll(roll);
        const recovery = roll.total;

        // 2. Prepare Updates
        const updates = {};
        let restoredAny = false;

        // Recover Essences
        for (const [key, essence] of Object.entries(this.actor.system.essences)) {
            if (essence.value < 100) { // Assuming 100 is Peak
                const newVal = Math.min(100, essence.value + recovery);
                updates[`system.essences.${key}.value`] = newVal;
                restoredAny = true;
            }
        }

        // Recover HP
        const hp = this.actor.system.resources.hp;
        if (hp.value < hp.max) {
            const newHp = Math.min(hp.max, hp.value + recovery);
            updates[`system.resources.hp.value`] = newHp;
            restoredAny = true;
        }

        // 3. Apply & Chat
        if (restoredAny) {
            await this.actor.update(updates);
            ChatMessage.create({
                speaker: ChatMessage.getSpeaker({actor: this.actor}),
                content: `
                <div class="narequenta chat-card">
                    <h3 style="color:#2a423a; border-bottom:1px solid #2a423a">Quick Breath</h3>
                    <div style="text-align:center; font-size:1.2em; padding:5px;">
                        Recovered <strong>${recovery}</strong> Vigor
                    </div>
                    <div style="font-size:0.8em; color:#666; text-align:center;">(Active Vigor & HP)</div>
                </div>`
            });
        } else {
            ui.notifications.info("Active Vigor is already full.");
        }
    });
  }

  /* -------------------------------------------- */
  /* CALCULATOR: Item Selection Setup            */
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
      
      const weaponType = sys.weapon_type || "none"; 
      const damageTarget = sys.target_resource || "hp";

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
          "system.calculator.target_def_stat": motorKey, 
          "system.calculator.apply_to": damageTarget,
          "system.calculator.item_range": range,
          "system.calculator.weapon_type": weaponType, 
          "system.calculator.output": "", 
          "system.calculator.quick_breath_active": false 
      });
      ui.notifications.info(`Active: ${item.name} (${range}ft). Motor: ${motorKey.toUpperCase()}.`);
  }

  /* -------------------------------------------- */
  /* QUICK BREATH TOGGLE                         */
  /* -------------------------------------------- */
  async _onToggleQuickBreath(event) {
      event.preventDefault();
      const currentState = this.actor.system.calculator.quick_breath_active || false;
      const newState = !currentState; 

      const updates = { "system.calculator.quick_breath_active": newState };

      if (newState) {
          updates["system.calculator.target_ids"] = [];
          updates["system.calculator.target_name"] = "Self (Quick Breath)";
          updates["system.calculator.attack_roll"] = 0;
          updates["system.calculator.defense_roll"] = 0;
          
          updates["system.calculator.output"] = `<div style="color: #d4af37; font-weight: bold; text-align: center; padding: 10px; background: #333; border: 1px solid #d4af37;">
              <i class="fas fa-lungs"></i> QUICK BREATH PREPARED<br>
              <span style="font-size: 0.8em; font-weight: normal; color: #ccc;">
                  Recovers Vigor (Sum of D_prof).<br>
                  <strong style="color: #ff6666;">⚠️ ENDS TURN IMMEDIATELY</strong>
              </span>
          </div>`;
          updates["system.calculator.batch_data"] = JSON.stringify({ mode: "quick_breath" });
      } else {
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

      // Validation
      const rawAttack = calc.attack_roll;
      if (!rawAttack && rawAttack !== 0) { ui.notifications.warn("Please roll Attack (d100)."); return; }
      if (Number(rawAttack) === 0) { ui.notifications.warn("Attack cannot be 0."); return; }
      if (!Array.isArray(targetIds) || targetIds.length === 0) { ui.notifications.warn("No targets selected."); return; }

      // Gather Data (Updated for v0.9.73)
      const context = {
          Attacker_d100: Number(calc.attack_roll),
          R_prof: Number(calc.prof_roll) || 0,
          itemBonus: Number(calc.item_bonus) || 0,
          itemWeight: (typeof calc.item_weight !== "undefined") ? Number(calc.item_weight) : 15,
          weaponType: calc.weapon_type || "none",
          motorKey: calc.active_motor || "vitalis",
          defStat: calc.target_def_stat || "vitalis",
          targetResource: calc.apply_to || "hp",
          
          // New Context for Integrity & Range
          itemId: calc.selected_item_id,
          attackRange: Number(calc.item_range) || 5,
          
          E_max: this.actor.system.essences[calc.active_motor]?.max || 100,
          E_cur: this.actor.system.essences[calc.active_motor]?.value || 100,
          
          Attacker_Tier: (this.actor.type === 'character') 
              ? (this.actor.system.resources.action_surges.max || 0) 
              : (this.actor.system.tier || 0),
          
          targetIds: targetIds,
          defenseRolls: {} 
      };

      const Manual_Def = Number(calc.defense_roll) || 0;

      // AoE vs Single Logic
      if (targetIds.length > 1 && Manual_Def === 0) {
          // A. Multi-Target AoE -> Dialog
          await this._showAoEDefenseDialog(context);
      } else {
          // B. Single or Manual Override
          for (const tid of targetIds) {
              context.defenseRolls[tid] = (Manual_Def > 0) ? Manual_Def : Math.floor(Math.random() * 100) + 1;
          }
          await this._processAttackComputation(context);
      }
  }

  /* --- Helper: AoE Dialog --- */
  async _showAoEDefenseDialog(context) {
      let rows = "";
      context.targetIds.forEach(tid => {
          const tToken = canvas.tokens.get(tid);
          const name = tToken ? tToken.name : "Unknown";
          const rnd = Math.floor(Math.random() * 100) + 1;
          rows += `<tr><td style="padding: 4px;">${name}</td><td style="text-align: right;"><input type="number" name="def_${tid}" value="${rnd}" style="width: 50px; text-align: center;"></td></tr>`;
      });

      const content = `<div class="narequenta"><p style="font-size:0.9em; margin-bottom:5px;"><strong>AoE Defense Resolution</strong></p><p style="font-size:0.8em; color:#555;">Verify or enter specific defense rolls.</p><table style="width:100%; border-collapse: collapse; font-size: 0.9em;"><thead style="background: #ddd;"><tr><th style="text-align:left; padding:4px;">Target</th><th>Def Roll</th></tr></thead><tbody>${rows}</tbody></table></div>`;

      new Dialog({
          title: "Defense Rolls", content: content,
          buttons: {
              calc: { label: "Calculate Outcomes", icon: "<i class='fas fa-calculator'></i>", callback: async (html) => {
                      context.targetIds.forEach(tid => {
                          const val = html.find(`input[name="def_${tid}"]`).val();
                          context.defenseRolls[tid] = Number(val);
                      });
                      await this._processAttackComputation(context);
                  }}
          }, default: "calc"
      }).render(true);
  }

  /* --- Helper: Final Computation (v0.9.73 Logic) --- */
  async _processAttackComputation(ctx) {
      const { Attacker_d100, R_prof, itemBonus, itemWeight, weaponType, motorKey, defStat, targetResource, E_max, E_cur, Attacker_Tier, targetIds, defenseRolls, itemId, attackRange } = ctx;

      const isHealing = itemBonus < 0;
      const isPotion = isHealing && (itemWeight === 0);

      // --- 1. WEAPON INTEGRITY LOGIC ---
      let integrityMsg = "";
      const weapon = this.actor.items.get(itemId);
      
      if (weapon && weapon.type === "weapon") {
          const currentInt = weapon.system.integrity?.value ?? 3;
          
          // Broken Weapon? (Optional: Could reduce damage here, strictly handling Integrity updates for now)
          if (currentInt <= 0 && !isHealing) {
              integrityMsg += `<div style="color:red; font-size:0.8em;">⚠️ BROKEN WEAPON</div>`;
          }
          
          // Crit Fail Check (96-100) - Apply Damage to Weapon
          if (Attacker_d100 >= 96 && currentInt > 0) {
              const newInt = currentInt - 1;
              await weapon.update({"system.integrity.value": newInt});
              integrityMsg = `<div style="color:darkred; font-weight:bold; margin-top:5px; border-top:1px dashed #ccc; padding-top:2px;">⚠️ WEAPON CHIPPED! (Int: ${newInt})</div>`;
              if (newInt === 0) integrityMsg += `<div style="color:red; font-weight:bold;">💥 WEAPON SHATTERED!</div>`;
          }
      }

      // --- 2. HIT LOGIC ---
      const effectiveRoll = Attacker_d100 - R_prof;
      let zonePenalty = 0;
      if (E_cur <= 25) zonePenalty = 30; else if (E_cur <= 50) zonePenalty = 20; else if (E_cur <= 75) zonePenalty = 10;
      const successThreshold = E_max - zonePenalty;
      
      let attackerSuccess = true;
      let hitLabel = "SUCCESS";
      if (Attacker_d100 >= 96) { attackerSuccess = false; hitLabel = "CRIT FAIL"; }
      else if (Attacker_d100 <= 5) { attackerSuccess = true; hitLabel = "CRIT SUCCESS"; }
      else if (effectiveRoll > successThreshold) { attackerSuccess = false; hitLabel = "MISS"; }

      let sheetListHtml = `<div style="font-size:0.85em; color:#555; margin-bottom:5px; border-bottom:1px solid #ccc;">Attack: <strong>${effectiveRoll}</strong> vs <strong>${successThreshold}</strong> (${hitLabel})</div>`;
      let chatTableRows = ""; 
      let payloadTargets = [];

      // --- 3. TARGET LOOP ---
      for (const tid of targetIds) {
          const tToken = canvas.tokens.get(tid);
          if (!tToken) continue;
          
          const tActor = tToken.actor;
          const Def_Ecur = tActor.system.essences[defStat]?.value || 50;
          const Def_Tier = (tActor.type==='character') ? (tActor.system.resources.action_surges.max||0) : (tActor.system.tier||0);
          
          const Def_Roll = defenseRolls[tid];
          const D_Margin = Def_Roll - Def_Ecur; 
          let finalDamage = 0;
          let details = "";
          let resultColor = "#333";
          
          // --- SPLIT MITIGATION CALCULATION ---
          const defData = tActor.system.mitigation || { base: 0, static: 0, parry: 0 };
          let activeMitigation = defData.base + defData.static;
          let shieldIcon = '<i class="fas fa-shield-alt"></i>'; // Default Shield

          // Rule: Parry only applies if attack is within 5ft (Melee)
          if (attackRange <= 5) {
              activeMitigation += defData.parry;
              if (defData.parry > 0) shieldIcon = '<i class="fas fa-swords"></i>'; // Parry Active
          }

          if (attackerSuccess) {
              if (isHealing) {
                  let healAmount = Math.abs(itemBonus);
                  if (!isPotion) healAmount += R_prof;
                  finalDamage = -Math.max(1, healAmount);
                  resultColor = "#006400";
              } else {
                  // Damage Formula: D_Final = max(R_prof, (A_FP - M_Total + D_Margin + R_prof)) * TierMult
                  let A_FP = 100 - effectiveRoll;
                  if (Attacker_d100 <= 5) A_FP = 100 - (1 - R_prof);
                  if (weaponType === "slashing") { const slashBonus = Math.floor(Math.random() * 4) + 1; A_FP += slashBonus; details += ` (Slash +${slashBonus})`; }

                  // Use calculated activeMitigation instead of simple Tier formula
                  let rawCalc = (A_FP - activeMitigation + D_Margin + R_prof + itemBonus);
                  let baseDamage = Math.max(R_prof, rawCalc);
                  if (baseDamage < 1) baseDamage = 1;

                  let mult = 1.0;
                  const diff = Attacker_Tier - Def_Tier;
                  if (diff >= 1) mult = 1.25; if (diff >= 2) mult = 1.50; if (diff === 0) mult = 1.00; if (diff === -1) mult = 0.75; if (diff <= -2) mult = 0.50;

                  finalDamage = Math.max(1, Math.floor(baseDamage * mult));
                  resultColor = "#8b0000";
              }
              
              payloadTargets.push({ id: tid, damage: finalDamage, name: tToken.name });
              if (!details.includes("Slash")) details += ` (Def:${Def_Roll})`; else details += ` / (Def:${Def_Roll})`;
              
              chatTableRows += `<tr>
                  <td style="text-align:left;">${tToken.name}</td>
                  <td style="text-align:center;">${Def_Roll}</td>
                  <td style="text-align:center; font-size:0.8em; color:#555;">-${activeMitigation.toFixed(1)} ${shieldIcon}</td>
                  <td style="text-align:right; font-weight:bold; color:${resultColor};">${finalDamage > 0 ? finalDamage : '+' + Math.abs(finalDamage)}</td>
              </tr>`;
          } else {
              details = `(Missed)`;
              chatTableRows += `<tr><td style="text-align:left; color:#999;">${tToken.name}</td><td colspan="3" style="text-align:center; color:#999;">Evaded</td></tr>`;
          }
          sheetListHtml += `<div style="display:flex; justify-content:space-between; align-items:center; padding:2px 0;"><div><strong>${tToken.name}</strong> <span style="font-size:0.8em; color:#555;">${details}</span></div><div style="font-weight:bold; color:${resultColor}; font-size:1.1em;">${finalDamage > 0 ? finalDamage : '+' + Math.abs(finalDamage)}</div></div>`;
      }

      // Attrition (Min 5%)
      let rawCost = Math.max(0, itemWeight - Math.floor(R_prof / 2));
      if (weaponType === "piercing") rawCost = Math.max(0, rawCost - 1);
      let attritionCost = Math.max(5, rawCost); 

      if (Attacker_d100 <= 5) attritionCost = Math.floor(attritionCost / 2);
      if (Attacker_d100 >= 96) attritionCost = attritionCost * 2;
      
      sheetListHtml += `<div style="text-align:right; margin-top:5px; font-size:0.8em; color:#333; font-weight:bold;">Self Attrition: -${attritionCost}% <span style="font-weight:normal; color:#777;">(Min 5%)</span></div>`;
      if (integrityMsg) sheetListHtml += integrityMsg;

      const resolutionPayload = { essenceKey: motorKey, attritionCost: attritionCost, targets: payloadTargets, targetResource: targetResource, mode: "attack" };
      await this.actor.update({
          "system.calculator.output": sheetListHtml,
          "system.calculator.batch_data": JSON.stringify(resolutionPayload) 
      });

      ChatMessage.create({ 
          speaker: ChatMessage.getSpeaker({ actor: this.actor }), 
          content: `<div class="narequenta chat-card">
              <h3>${isHealing ? "Restoration" : "Attack Resolution"}</h3>
              <div><strong>Status:</strong> ${hitLabel} ${weaponType !== "none" ? `(${weaponType.toUpperCase()})` : ""}</div>
              <div style="font-size:0.9em; border-top:1px dashed #ccc; margin-top:5px; padding-top:2px;">Cost: <span style="color:#a00; font-weight:bold;">-${attritionCost}%</span> ${motorKey.toUpperCase()}</div>
              ${integrityMsg}
              <hr><table style="width:100%; font-size:0.9em; border-collapse:collapse;"><thead><tr style="background:#eee;"><th style="text-align:left;">Target</th><th>Def</th><th>Mit</th><th>Effect</th></tr></thead><tbody>${chatTableRows}</tbody></table>
              <div style="margin-top:5px; font-style:italic; font-size:0.8em; text-align:center;">Apply results via Sheet.</div>
          </div>` 
      });
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
      if (tokens.length === 0) { 
          ui.notifications.warn("Place token on scene."); 
          return;
      }
      const sourceToken = tokens[0];
      
      // 2. Build Target Lists (No Distance Limit)
      let pcHtml = "";
      let npcHtml = ""; 
      let count = 0;
      
      canvas.tokens.placeables.forEach(t => {
          if (t.id === sourceToken.id) return; // Skip self
          
          // Basic validation: Must have an actor and be alive (HP > 0)
          if (t.actor && t.actor.system.resources?.hp?.value > 0) {
              
              // Measure distance purely for display context
              const dist = canvas.grid.measureDistance(sourceToken, t);
              const isOutOfRange = dist > range;
              
              // Style: Gray out text if out of range, but keep checkbox active
              const entryStyle = isOutOfRange ? "color: #888; font-style: italic;" : "color: #000;";
              const distLabel = isOutOfRange ? `(${Math.round(dist)}ft - Far)` : `(${Math.round(dist)}ft)`;

              const entry = `
              <div style="padding:2px; ${entryStyle}">
                   <input type="checkbox" name="target" value="${t.id}" class="target-checkbox" data-type="${t.actor.type}"> 
                  <strong>${t.name}</strong> <span style="font-size:0.85em;">${distLabel}</span>
              </div>`;
              
              if (t.actor.type === "character") {
                  pcHtml += entry;
              } else {
                  npcHtml += entry;
              }
              count++;
          }
      });

      if (count === 0) { 
          ui.notifications.warn(`No valid targets on scene.`); 
          return;
      }

      // 3. Build Selection Logic Scripts
      // Note: We use the existing safeguards to auto-check boxes, but users can now manually check distant targets
      let autoSelectScript = "";
      if (isHealing) {
          // HEALING: Auto-select PCs (Allies)
          autoSelectScript = `$('input[data-type="character"]').prop('checked', true);`;
      } else {
          const itemId = calc.selected_item_id;
          const item = attacker.items.get(itemId);
          const targetType = item?.system.target_type || "one"; 
          
          if (targetType === "aoe") {
              // DAMAGE AoE: Check Tier
              if (tier >= 3) {
                  // Mastery: Safe Casting (Select NPCs only)
                  autoSelectScript = `$('input[data-type="npc"]').prop('checked', true);`;
              } else {
                  // Wild: Dangerous Casting (Select ALL)
                  autoSelectScript = `$('input.target-checkbox').prop('checked', true);`;
              }
          }
      }

      // 4. Render Dialog
      const essences = ["vitalis", "motus", "sensus", "verbum", "anima", "hp"];
      let options = "";
      essences.forEach(k => { options += `<option value="${k}" ${k===defaultDef?"selected":""}>${k.toUpperCase()}</option>`; });
      
      const content = `
      <form>
          <div style="text-align:center; margin-bottom:5px; font-size: 0.9em; color:#555;">
              Item Range: <strong>${range}ft</strong> (Distant targets marked in gray)
          </div>
          
          <div style="display:flex; gap:5px; margin-bottom:10px; max-height: 400px; overflow-y: auto;">
              <div style="flex:1; background:#eef; padding:5px; border:1px solid #ccc;">
                  <strong style="color: #004d00;">Allies (PCs)</strong><br>${pcHtml || "-"}
              </div>
              <div style="flex:1; background:#fee; padding:5px; border:1px solid #ccc;">
                  <strong style="color: #8b0000;">Enemies (NPCs)</strong><br>${npcHtml || "-"}
              </div>
          </div>

          <div style="text-align:center; margin-bottom:10px;">
              <button type="button" id="auto-select-btn" style="font-size:0.8em; width:100%;">
                  ${isHealing ? "Auto-Target Allies (Healing)" : "Auto-Select (Contextual)"}
              </button>
          </div>

          <label>Defensive Stat:</label>
          <select id="target-essence" style="width:100%;">${options}</select>
      </form>
      <script>
          $("#auto-select-btn").click(function() {
              const anyChecked = $("input:checkbox:checked").length > 0;
              if (anyChecked) {
                 $("input:checkbox").prop('checked', false); // Toggle Off
              } else {
                 ${autoSelectScript || ""} // Toggle On based on logic
              }
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

  /* -------------------------------------------- */
  /* EXECUTE BATCH (Flow Control & Dialogs)      */
  /* -------------------------------------------- */
  async _onExecuteBatch(event) {
      event.preventDefault();
      const rawData = this.actor.system.calculator.batch_data;
      if (!rawData) return;
      const payload = JSON.parse(rawData);

      // CASE A: QUICK BREATH (Manual Roll Input)
      if (payload.mode === "quick_breath") {
          const isChar = this.actor.type === "character";
          const tier = isChar ? (this.actor.system.resources.action_surges.max || 0) : (this.actor.system.tier || 0);
          const formula = `${Math.max(1, tier)}d10`;

          new Dialog({
              title: "Quick Breath",
              content: `
              <div class="narequenta">
                  <div style="background:#f0f0f0; padding:8px; border-radius:4px; font-size:0.9em; margin-bottom:5px;">
                      <div><strong>Formula:</strong> ${formula}</div>
                      <div style="color:#a00; font-weight:bold; margin-top:3px;">⚠️ Costs Entire Turn</div>
                  </div>
                  <div class="form-group" style="margin: 10px 0;">
                      <label>Manual Result:</label>
                      <input type="number" id="manual-qb-roll" placeholder="Leave empty to roll" style="text-align:center; width: 60%;">
                  </div>
                  <p style="font-size:0.9em;">Center your spirit to regain Active Vigor.</p>
              </div>`,
              buttons: {
                  confirm: {
                      label: "Recover",
                      icon: '<i class="fas fa-lungs"></i>',
                      callback: async (html) => {
                          const manualVal = html.find("#manual-qb-roll").val();
                          let total = 0;

                          if (manualVal !== "") {
                              total = Number(manualVal);
                          } else {
                              const r = new Roll(formula);
                              await r.evaluate();
                              if (game.dice3d) game.dice3d.showForRoll(r);
                              total = r.total;
                          }

                          const updates = {};
                          for (const [key, essence] of Object.entries(this.actor.system.essences)) {
                              if (essence.value < 100) updates[`system.essences.${key}.value`] = Math.min(100, essence.value + total);
                          }
                          updates["system.calculator.quick_breath_active"] = false;
                          updates["system.calculator.batch_data"] = "";
                          updates["system.calculator.output"] = "Quick Breath Complete.";
                          updates["system.calculator.target_name"] = "None";

                          await this.actor.update(updates);
                          ChatMessage.create({ 
                              speaker: ChatMessage.getSpeaker({ actor: this.actor }), 
                              content: `<div class="narequenta chat-card"><h3 style="color:#8b0000; border-bottom:1px solid #8b0000">Quick Breath</h3><div style="text-align:center;">Recovered <strong>${total}%</strong> Vigor</div></div>` 
                          });
                          this._onEndTurn(event);
                      }
                  }
              }, default: "confirm"
          }).render(true);
          return;
      }

      // CASE B: STANDARD ATTACK
      const { essenceKey, attritionCost, targets, targetResource } = payload;
      const currentVal = this.actor.system.essences[essenceKey].value;
      const newVal = Math.max(0, currentVal - attritionCost);
      await this.actor.update({ [`system.essences.${essenceKey}.value`]: newVal });

      if (targets && targets.length > 0) {
          for (const tData of targets) {
              const token = canvas.tokens.get(tData.id);
              if (token && token.actor) {
                  const applyTo = targetResource || "hp";
                  let currentTVal, maxTVal, updatePath;
                  if (applyTo === "hp") {
                      currentTVal = token.actor.system.resources.hp.value; maxTVal = token.actor.system.resources.hp.max; updatePath = "system.resources.hp.value";
                  } else {
                      currentTVal = token.actor.system.essences[applyTo]?.value || 0; maxTVal = token.actor.system.essences[applyTo]?.max || 100; updatePath = `system.essences.${applyTo}.value`;
                  }
                  let finalVal = currentTVal - tData.damage;
                  if (finalVal < 0) finalVal = 0; if (finalVal > maxTVal) finalVal = maxTVal;
                  await token.actor.update({ [updatePath]: finalVal });
                  if (applyTo === "hp" && finalVal <= 0 && tData.damage > 0) {
                       const isDead = token.actor.effects.some(e => e.statusId === "dead" || (e.statuses && e.statuses.has("dead")));
                       if (!isDead) await token.actor.toggleStatusEffect("dead", { overlay: true });
                  }
              }
          }
      }

      await this.actor.update({ "system.calculator.attack_roll": 0, "system.calculator.prof_roll": 0, "system.calculator.defense_roll": 0, "system.calculator.batch_data": "", "system.calculator.output": `Applied. -${attritionCost}% Attrition.` });
      ui.notifications.info("Resolution Complete.");

      // CASE C: ACTION SURGE
      if (this.actor.type === "character") {
          const surges = this.actor.system.resources.action_surges.value;
          if (surges > 0) {
              new Dialog({
                  title: "End of Action", content: `<div style="text-align:center;"><p>Action Complete.</p><p>Spend Surge to <strong>Keep Turn</strong>?</p></div>`,
                  buttons: {
                      yes: { label: "Yes (Surge!)", icon: "<i class='fas fa-bolt'></i>", callback: async () => {
                              await this.actor.update({"system.resources.action_surges.value": surges - 1});
                              ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `<div class="narequenta chat-card"><h3 style="color:#d4af37">Action Surge!</h3></div>` });
                          }},
                      no: { label: "No (End Turn)", icon: "<i class='fas fa-step-forward'></i>", callback: () => { this._onEndTurn(event); } }
                  }, default: "no"
              }).render(true);
          } else { this._onEndTurn(event); }
      } else { this._onEndTurn(event); }
  }

  /* -------------------------------------------- */
  /* WANING PHASE (Dialog Configuration)          */
  /* -------------------------------------------- */
  async _onWaningPhase(event) {
      event.preventDefault();
      const essences = this.actor.system.essences;
      let rows = "";
      for (const [key, ess] of Object.entries(essences)) {
          const isFloor = ess.max <= 50;
          const style = isFloor ? "opacity: 0.5;" : "";
          const disabled = isFloor ? "disabled" : "";
          const checked = (!isFloor && key === "vitalis") ? "checked" : ""; 
          rows += `<tr style="${style}"><td style="text-align:center;"><input type="radio" name="focus_selection" value="${key}" ${checked} ${disabled}></td><td style="font-weight:bold; padding: 5px;">${ess.label}</td><td style="text-align:center;">${ess.max}%</td><td style="text-align:center;"><input type="number" name="loss_${key}" placeholder="Auto" style="width: 60px; text-align:center;" ${disabled}></td></tr>`;
      }
      const content = `<div class="narequenta"><div style="background:#f0f0f0; padding:10px; border-radius:4px; margin-bottom:10px; font-size: 0.9em;"><ul style="margin:0; padding-left:20px;"><li>Select one <strong>Focus</strong> (Rolls <strong>2d6</strong>). Others roll <strong>1d6</strong>.</li><li>Enter number in <strong>"Loss"</strong> for manual roll. Leave empty for Auto.</li></ul></div><table style="width:100%; border-collapse: collapse;"><thead style="background: #333; color: #fff;"><tr><th style="padding: 5px;">Focus</th><th style="text-align:left; padding: 5px;">Essence</th><th>Max</th><th>Loss Input</th></tr></thead><tbody>${rows}</tbody></table><p style="color: #8b0000; font-weight: bold; text-align: center; margin-top: 10px;">⚠️ PERMANENTLY REDUCES SOUL'S PEAK</p></div>`;

      new Dialog({
          title: "The Waning Roll", content: content,
          buttons: {
              cancel: { label: "Cancel", icon: "<i class='fas fa-times'></i>" },
              commit: { label: "Commit to Loss", icon: "<i class='fas fa-skull'></i>", callback: async (html) => {
                      const focusKey = html.find("input[name='focus_selection']:checked").val();
                      if (!focusKey) { ui.notifications.warn("Select Focus."); return; }
                      const updates = {};
                      let chatContent = `<h3 style="border-bottom: 2px solid #8b0000; color: #8b0000;">The Waning</h3><table style="width:100%; font-size: 0.9em; border-collapse: collapse;"><tr style="background: #eee;"><th style="text-align:left">Essence</th><th>Formula</th><th>Loss</th><th>New Max</th></tr>`;
                      for (const [key, ess] of Object.entries(essences)) {
                          if (ess.max <= 50) continue; 
                          const isFocus = (key === focusKey);
                          const manualInput = html.find(`input[name='loss_${key}']`).val();
                          let loss = 0; let formulaLabel = "";
                          if (manualInput !== "") { loss = Number(manualInput); formulaLabel = "Manual"; } 
                          else { const r = new Roll(isFocus ? "2d6" : "1d6"); await r.evaluate(); loss = r.total; formulaLabel = isFocus ? "2d6" : "1d6"; }
                          const newMax = Math.max(50, ess.max - loss); const actualLoss = ess.max - newMax;
                          updates[`system.essences.${key}.max`] = newMax;
                          const rowStyle = isFocus ? "font-weight:bold; color:#8b0000;" : "color:#555;"; const icon = isFocus ? "🔥" : "🍂";
                          chatContent += `<tr style="${rowStyle}"><td style="padding:2px;">${icon} ${ess.label}</td><td style="text-align:center;">${formulaLabel}</td><td style="text-align:center;">-${actualLoss}%</td><td style="text-align:right;"><strong>${newMax}%</strong></td></tr>`;
                      }
                      chatContent += `</table>`;
                      await this.actor.update(updates);
                      ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `<div class="narequenta chat-card">${chatContent}</div>` });
                  }
              }
          }, default: "commit"
      }).render(true);
  }

  async _onEndTurn(event) {
      if(event) event.preventDefault();
      const combat = game.combat;
      if (!combat) return;
      await combat.nextTurn();
      this.close();
      if (combat.combatant?.actor) combat.combatant.actor.sheet.render(true);
  }

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
                  currentPath = "system.resources.hp.value"; maxPath = "system.resources.hp.max";
                  currentVal = targetActor.system.resources.hp.value; maxVal = targetActor.system.resources.hp.max;
                  label = "HP";
              } else {
                  currentPath = `system.essences.${resourceKey}.value`; maxPath = `system.essences.${resourceKey}.max`;
                  currentVal = targetActor.system.essences[resourceKey]?.value || 0; maxVal = targetActor.system.essences[resourceKey]?.max || 100;
                  label = resourceKey.toUpperCase();
              }
              let change = 0, newVal = 0;
              if (r.total < 0) { 
                  change = Math.abs(r.total); newVal = Math.min(maxVal, currentVal + change);
                  ui.notifications.info(`${targetActor.name}: Recovered ${change} ${label}.`);
              } else { 
                  change = r.total; newVal = Math.max(0, currentVal - change);
                  ui.notifications.info(`${targetActor.name}: Lost ${change} ${label}.`);
              }
              await targetActor.update({ [currentPath]: newVal });
              r.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), flavor: `Consumed: ${item.name} (${label})` });
          } catch (e) { console.error(e); }
      };

      if (type === "self") executeConsume(this.actor);
      else {
          new Dialog({
              title: `Use ${item.name}`, content: `<p>Target: <strong>${resourceKey.toUpperCase()}</strong></p>`,
              buttons: {
                  self: { label: "Self", icon: "<i class='fas fa-user'></i>", callback: () => executeConsume(this.actor) },
                  target: { label: "Target", icon: "<i class='fas fa-bullseye'></i>", callback: () => {
                          const targets = Array.from(game.user.targets);
                          if (targets.length !== 1) { ui.notifications.warn("Select 1 target."); return; }
                          executeConsume(targets[0].actor);
                      }}
              }, default: "self"
          }).render(true);
      }
  }

  async _onLongRest(event) {
    event.preventDefault();
    const confirmed = await Dialog.confirm({ title: "Renewal", content: "<p>Restore HP/Essences to 100%?</p>" });
    if (confirmed) {
      const updates = {};
      for (const [key, essence] of Object.entries(this.actor.system.essences)) { updates[`system.essences.${key}.value`] = 100; }
      if (this.actor.type === "character") updates[`system.resources.action_surges.value`] = this.actor.system.resources.action_surges.max;
      updates[`system.resources.hp.value`] = this.actor.system.resources.hp.max;
      await this.actor.update(updates);
      ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `<div class="narequenta chat-card"><h3>Renewal</h3><p>Restored to 100%.</p></div>` });
    }
  }

  async _onShortRest(event) {
    event.preventDefault();
    const isChar = this.actor.type === "character";
    const tier = isChar ? (this.actor.system.resources.action_surges.max || 0) : (this.actor.system.tier || 0);
    const formula = `${Math.max(1, tier)}d10`;
    new Dialog({
      title: "Short Rest",
      content: `<p>Roll ${formula} to recover Vigor.</p>`,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: "Roll",
          callback: async () => {
            const r = new Roll(formula);
            await r.evaluate();
            if (game.dice3d) game.dice3d.showForRoll(r);
            const updates = {};
            for (const [key, essence] of Object.entries(this.actor.system.essences)) {
                if (essence.value < 100) updates[`system.essences.${key}.value`] = Math.min(100, essence.value + r.total);
            }
            const hp = this.actor.system.resources.hp;
            if (hp.value < hp.max) updates[`system.resources.hp.value`] = Math.min(hp.max, hp.value + r.total);
            await this.actor.update(updates);
            ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `<div class="narequenta chat-card"><h3>Short Rest</h3><p>+${r.total}% Vigor</p></div>` });
          }
        }
      }
    }).render(true);
  }

  async _onUseActionSurge(event) {
      event.preventDefault();
      const current = this.actor.system.resources.action_surges.value;
      if (current > 0) {
          await this.actor.update({"system.resources.action_surges.value": current - 1});
          ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `<div class="narequenta chat-card"><h3 style="color:#d4af37">Action Surge!</h3></div>` });
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
}