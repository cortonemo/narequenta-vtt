import { EntitySheetHelper } from "./helper.js";
import { ATTRIBUTE_TYPES } from "./constants.js";

export class NarequentaActorSheet extends ActorSheet {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["narequenta", "sheet", "actor"],
      template: "systems/narequenta/templates/actor-sheet.html",
      width: 665,
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

    // Items
    html.find(".item-control").click(this._onItemControl.bind(this));
    html.find(".items .rollable").on("click", this._onItemRoll.bind(this));

    // Calculator
    html.find(".roll-calculation").click(this._onCalculate.bind(this));
    html.find(".apply-sheet-damage").click(this._onApplySheetDamage.bind(this));

    // Waning Toggle & Button
    html.find(".waning-toggle").change(ev => {
        const isChecked = ev.target.checked;
        if (isChecked) html.find(".waning-roll-btn").slideDown();
        else html.find(".waning-roll-btn").slideUp();
    });
    html.find(".waning-roll-btn").click(this._onWaningPhase.bind(this));
    
    // Rest Buttons
    html.find(".short-rest").click(this._onShortRest.bind(this));
    html.find(".long-rest").click(this._onLongRest.bind(this));

    // Contested Roll Launcher
    html.find(".launch-contest").click(this._onLaunchContest.bind(this));
    
    // Sheet Calculator Roll Buttons
    html.find(".roll-calc-btn").click(this._onRollSheetCalc.bind(this));    
  }

  /* -------------------------------------------- */
  /* REST & RECOVERY LOGIC (UPDATED: Unlocks Target) */
  /* -------------------------------------------- */
  
  async _onLongRest(event) {
    event.preventDefault();
    const actor = this.actor;
    const confirmed = await Dialog.confirm({
      title: "Renewal (Long Rest)",
      content: "<p>Perform a <strong>Long Rest (6h+)</strong>?<br>This will restore <strong>Active Vigor (HP)</strong> and all <strong>Essences</strong> to <strong>100%</strong>.<br><strong>Target Lock will be cleared.</strong></p>"
    });
    if (confirmed) {
      const updates = {};
      const essences = actor.system.essences;
      
      // 1. Restore Essences
      for (const [key, essence] of Object.entries(essences)) {
        updates[`system.essences.${key}.value`] = 100;
      }
      
      // 2. Restore Action Surges (PC Only)
      if (actor.type === "character") {
        updates[`system.resources.action_surges.value`] = actor.system.resources.action_surges.max;
      }
      
      // 3. Restore HP
      updates[`system.resources.hp.value`] = actor.system.resources.hp.max;

      // 4. CLEAR TARGET LOCK (Debug/Reset)
      updates[`system.calculator.target_id`] = "";
      updates[`system.calculator.target_name`] = "None";
      updates[`system.calculator.target_tier`] = 0;
      updates[`system.calculator.target_ecur`] = 0;
      updates[`system.calculator.defense_roll`] = 0;
      updates[`system.calculator.output`] = "Rest Complete. Target Unlocked.";

      await actor.update(updates);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: actor }),
        content: `<div class="narequenta chat-card"><h3>Renewal</h3><p>Fully Restored & Targets Cleared.</p></div>`
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
              <option value="mental" selected>Mental Calming (Variable) - 5 to 30 Mins</option>
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
                <option value="6d8">25 Minutes (6d8%)</option>
                <option value="7d8">30 Minutes (7d8%)</option>
             </select>
        </div>
        <div style="display:flex; gap:5px; align-items:center; margin-top:10px; border-top:1px solid #ccc; padding-top:10px;">
            <button type="button" id="btn-roll-rest" style="flex:0 0 40px;"><i class="fas fa-dice"></i></button>
            <input type="number" id="rest-result" placeholder="Roll or Type %" style="text-align:center; font-weight:bold;">
        </div>
    </div>
    <script>$("#rest-type").change(function(){if($(this).val()==="mental")$("#mental-options").slideDown();else $("#mental-options").slideUp();});</script>`;

    const d = new Dialog({
      title: "Refocus (Short Rest)",
      content: content,
      buttons: {
        apply: {
          icon: '<i class="fas fa-check"></i>',
          label: "Apply Recovery",
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
              if (newValue > 100) newValue = 100; // Cap at 100%
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
              roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: actor }), flavor: `Refocus Roll (${formula})` });
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
  /* CONTESTED ROLL SUITE                         */
  /* -------------------------------------------- */

  _onLaunchContest(event) {
      event.preventDefault();
      const attacker = this.actor;
      
      let pcOptions = "";
      let npcOptions = "";
      let count = 0;

      canvas.tokens.placeables.forEach(t => {
          if (!t.actor || t.actor.id === attacker.id) return; 
          
          // FILTER: Skip dead targets (HP <= 0)
          const hp = t.actor.system.resources?.hp?.value || 0;
          if (hp <= 0) return;

          const opt = `<option value="${t.id}">${t.name}</option>`;
          if (t.actor.type === "character") pcOptions += opt;
          else npcOptions += opt;
          count++;
      });

      if (count === 0) {
          ui.notifications.warn("No valid (alive) targets found on the current scene.");
          return;
      }

      const targetList = `
          <optgroup label="Adversaries (NPCs)">${npcOptions}</optgroup>
          <optgroup label="Characters (PCs)">${pcOptions}</optgroup>
      `;

      const essenceOptions = `
          <option value="vitalis">VITALIS (Force/Body)</option>
          <option value="motus">MOTUS (Agility/Reflex)</option>
          <option value="sensus">SENSUS (Instinct/Perception)</option>
          <option value="verbum">VERBUM (Logic/Magic)</option>
          <option value="anima">ANIMA (Will/Soul)</option>
      `;

      new Dialog({
          title: `⚔️ Select Target`,
          content: `
          <form style="margin-bottom:10px;">
              <div class="form-group">
                  <label style="font-weight:bold;">Target (Alive):</label>
                  <select id="contest-target" style="width:100%; margin-bottom:10px;">${targetList}</select>
              </div>
              <div class="form-group">
                  <label style="font-weight:bold;">Target Defends With:</label>
                  <select id="target-essence" style="width:100%;">${essenceOptions}</select>
                  <p class="notes" style="font-size:0.8em; margin-top:2px;">Select the Essence the enemy uses to resist.</p>
              </div>
          </form>
          `,
          buttons: {
              select: {
                  icon: '<i class="fas fa-crosshairs"></i>',
                  label: "Lock Target",
                  callback: async (html) => {
                      const targetId = html.find("#contest-target").val();
                      const essenceKey = html.find("#target-essence").val();
                      
                      const targetToken = canvas.tokens.get(targetId);
                      if(!targetToken) return;
                      
                      const target = targetToken.actor;
                      
                      let dTier = 0;
                      if (target.type === 'character') {
                           dTier = target.system.resources?.action_surges?.max || 0;
                      } else {
                           dTier = target.system.tier || 0;
                      }

                      const dEcur = target.system.essences[essenceKey]?.value || 0; 
                      const essenceLabel = essenceKey.charAt(0).toUpperCase() + essenceKey.slice(1);

                      await attacker.update({
                          "system.calculator.target_name": `${target.name} (${essenceLabel})`,
                          "system.calculator.target_id": targetId, 
                          "system.calculator.target_tier": dTier,
                          "system.calculator.target_ecur": dEcur,
                          "system.calculator.defense_roll": 0, 
                          "system.calculator.output": `Targeting ${essenceLabel}. Roll when ready.`
                      });
                  }
              }
          },
          default: "select"
      }).render(true);
  }

  /* -------------------------------------------- */
  /* SHEET CALCULATOR ROLLS                       */
  /* -------------------------------------------- */
  
  async _onRollSheetCalc(event) {
      event.preventDefault();
      const btn = $(event.currentTarget);
      const targetField = btn.data("target");
      const type = btn.data("type");
      const label = btn.data("label") || "Calculator Roll"; 
      let formula = "1d100";
      if (type === "prof") {
          let tier = 0;
          if (this.actor.type === 'character') {
              tier = this.actor.system.resources.action_surges.max || 0;
          } else {
              tier = this.actor.system.tier || 0;
          }
          if (tier === 0) {
              await this.actor.update({ [targetField]: 0 });
              await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `${label}: <strong>0</strong> (No Proficiency)` });
              return;
          }
          formula = `${tier}d10`;
      }
      const roll = new Roll(formula);
      await roll.evaluate();
      if (game.dice3d) game.dice3d.showForRoll(roll);
      await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), flavor: label });
      await this.actor.update({ [targetField]: roll.total });
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

  /* -------------------------------------------- */
  /* ITEM ROLL -> CALCULATOR LOADER               */
  /* -------------------------------------------- */
  async _onItemRoll(event) {
    event.preventDefault();
    const button = $(event.currentTarget);
    const li = button.parents(".item");
    const item = this.actor.items.get(li.data("itemId"));

    // If it's a generic item (Loot), just show description in chat
    if (item.type === "item") return item.roll();

    // FOR WEAPONS & ABILITIES: Load into Calculator
    const sys = item.system;
    const motorKey = sys.cost?.motor || "vitalis";
    const qualityKey = sys.cost?.quality || "motus";
    
    // 1. Get Actor's Values for these Essences
    // We fetch the E_cur to check against Success Limit
    const motorVal = this.actor.system.essences[motorKey]?.value || 0;
    
    // 2. Get Item Modifiers
    const weight = Number(sys.weight) || 15; // Default to Medium (15%) if undefined
    const dmgBonus = Number(sys.damage_bonus) || 0;

    // 3. Format Labels
    const motorLabel = motorKey.charAt(0).toUpperCase() + motorKey.slice(1);
    
    // 4. Update the Calculator State
    // We store the Item Modifiers & The Active Motor Limit in the calculator
    await this.actor.update({
        "system.calculator.output": `Prepared: ${item.name}`,
        "system.calculator.item_name": item.name,
        "system.calculator.item_weight": weight,
        "system.calculator.item_bonus": dmgBonus,
        "system.calculator.active_motor": motorKey,
        "system.calculator.active_motor_val": motorVal
    });

    // 5. Notify User
    ui.notifications.info(`Loaded ${item.name}. Motor: ${motorLabel} (${motorVal}%) | Base Cost: ${weight}%`);
  }

  /* -------------------------------------------- */
  /* CALCULATE LOGIC (UPDATED: DEBUG LOG)         */
  /* -------------------------------------------- */
  async _onCalculate(event) {
      event.preventDefault();
      const calc = this.actor.system.calculator;
      
      const targetName = calc.target_name || "Target";
      const targetId = calc.target_id || ""; 
      const Attacker_d100 = Number(calc.attack_roll) || 0;
      const R_prof = Number(calc.prof_roll) || 0;
      const Defender_d100 = Number(calc.defense_roll) || 0;
      const Defender_Ecur = Number(calc.target_ecur) || 0;
      const Defender_Tier = Number(calc.target_tier) || 0;
      
      // ITEM MODIFIERS (from _onItemRoll)
      const itemBonus = Number(calc.item_bonus) || 0;
      const itemWeight = Number(calc.item_weight) || 15; 
      const itemName = calc.item_name || "Improvised Action";
      const activeMotorVal = (calc.active_motor_val !== undefined) ? Number(calc.active_motor_val) : 100;

      let Attacker_Tier = 0;
      if (this.actor.type === 'character') {
          Attacker_Tier = this.actor.system.resources.action_surges.max || 0;
      } else {
          Attacker_Tier = this.actor.system.tier || 0;
      }

      // --- 1. SUCCESS CHECK (The Hit) ---
      // Rule: (d100 - R_prof) <= E_cur (Active Essence)
      // Exception: Nat 1-5 is Auto-Hit. Nat 96-100 is Auto-Fail.
      
      const effectiveRoll = Attacker_d100 - R_prof;
      
      let isHit = true;
      let hitLabel = "HIT";
      let hitColor = "green";

      // Auto Fail
      if (Attacker_d100 >= 96) {
          isHit = false;
          hitLabel = "CRITICAL FAILURE";
          hitColor = "red";
      }
      // Auto Hit
      else if (Attacker_d100 <= 5) {
          isHit = true;
          hitLabel = "CRITICAL SUCCESS";
          hitColor = "gold";
      }
      // Standard Threshold Check
      else if (effectiveRoll > activeMotorVal) {
          isHit = false;
          hitLabel = "MISS";
          hitColor = "red";
      }

      // --- 2. DAMAGE CALCULATION ---
      let finalDamage = 0;
      let multiplier = 1.0;
      let baseDamage = 0;
      // Debug Variables
      let A_FP = 0;
      let D_Margin = 0;
      let M_Defense = 0;
      let rawCalc = 0;
      let diff = 0;
      
      if (isHit) {
          // A_FP (Half-Potential)
          A_FP = 100 - effectiveRoll;
          if (Attacker_d100 <= 5) A_FP = 100 - (1 - R_prof); // Crit treats d100 as 1

          D_Margin = Defender_d100 - Defender_Ecur;
          M_Defense = Defender_Tier * 5.5;

          // Raw Calculation + ITEM BONUS
          rawCalc = (A_FP - M_Defense + D_Margin + R_prof + itemBonus);

          // Hard Floor (v0.9.4): Damage cannot be lower than Proficiency Roll
          baseDamage = Math.max(R_prof, rawCalc);
          if (baseDamage < 1) baseDamage = 1;

          // Tier Multiplier
          diff = Attacker_Tier - Defender_Tier;
          if (diff >= 1) multiplier = 1.25;      
          if (diff >= 2) multiplier = 1.50;      
          if (diff === 0) multiplier = 1.00;     
          if (diff === -1) multiplier = 0.75;    
          if (diff <= -2) multiplier = 0.50;     

          finalDamage = Math.max(1, Math.floor(baseDamage * multiplier));
      }

      // --- 3. ATTRITION CALCULATION ---
      // v0.9 Rule: Base Cost (Weight) - floor(R_prof / 2)
      let attritionCost = Math.max(0, itemWeight - Math.floor(R_prof / 2));
      
      if (Attacker_d100 <= 5) attritionCost = Math.floor(attritionCost / 2); // Crit Halves Cost
      if (Attacker_d100 >= 96) attritionCost = attritionCost * 2;            // Fail Doubles Cost

      // --- 4. UPDATE SHEET & FEEDBACK ---
      await this.actor.update({
          "system.calculator.output": `${hitLabel}: ${finalDamage} Dmg`,
          "system.calculator.last_damage": finalDamage 
      });

      // --- 5. CHAT OUTPUT (WITH DEBUG LOG) ---
      const containerStyle = "font-family: 'Signika', sans-serif; color: #191813; background: #e8e8e3; border: 1px solid #999; padding: 5px;";
      
      const content = `
      <div class="narequenta chat-card" data-defender-token-id="${targetId}" data-damage="${finalDamage}" style="${containerStyle}">
          <h3 style="border-bottom: 2px solid #333; margin-bottom:5px;">${itemName} vs ${targetName}</h3>
          
          <div style="font-size:0.9em; margin-bottom:10px;">
             <div style="display:flex; justify-content:space-between;">
                <span><strong>Check:</strong> ${Attacker_d100} - ${R_prof} = <strong>${effectiveRoll}</strong></span>
                <span>vs <strong>${activeMotorVal}%</strong></span>
             </div>
             <div style="text-align:center; margin-top:5px; font-weight:bold; color:${hitColor}; border:1px solid ${hitColor}; background:rgba(255,255,255,0.5);">
                ${hitLabel}
             </div>
          </div>

          ${isHit ? `
          <div style="text-align: center; margin: 10px 0;">
              <span style="font-size: 1.8em; font-weight: bold; color: #8b0000;">${finalDamage} Damage</span>
          </div>
          ` : ``}

          <div style="text-align: center; font-size: 0.9em; margin-bottom: 10px;">
              <strong>Attrition:</strong> -${attritionCost}% (Base ${itemWeight})
          </div>

          ${isHit ? `
          <button class="apply-damage-btn" style="background: #8b0000; color: white; width: 100%;" 
             data-defender-token-id="${targetId}" data-damage="${finalDamage}">
             Apply Damage
          </button>` : ``}

          <div style="font-family: monospace; font-size: 0.8em; background: #f0f0f0; border: 1px dashed #666; margin-top: 10px; padding: 5px;">
             <strong>DEBUG MATH LOG</strong><br>
             ------------------<br>
             <strong>Hit Logic:</strong><br>
             Attacker Roll: ${Attacker_d100}<br>
             Prof Roll (R_prof): ${R_prof}<br>
             Effective: ${effectiveRoll} (Needs <= ${activeMotorVal})<br>
             <br>
             <strong>Damage Logic:</strong><br>
             A_FP (100 - Eff): ${A_FP}<br>
             M_Defense (Tier*5.5): ${M_Defense}<br>
             D_Margin: ${D_Margin}<br>
             Item Bonus: ${itemBonus}<br>
             Raw: ${A_FP.toFixed(1)} - ${M_Defense.toFixed(1)} + ${D_Margin} + ${R_prof} + ${itemBonus} = <strong>${rawCalc.toFixed(2)}</strong><br>
             <br>
             <strong>Floor Check:</strong><br>
             Max(${R_prof}, ${rawCalc.toFixed(2)}) = ${baseDamage.toFixed(2)}<br>
             <br>
             <strong>Multiplier:</strong><br>
             Tiers: Att(${Attacker_Tier}) vs Def(${Defender_Tier}) = Diff ${diff}<br>
             Mult: x${multiplier}<br>
             Final: ${baseDamage.toFixed(2)} * ${multiplier} = <strong>${finalDamage}</strong>
          </div>
      </div>`;

      ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: content
      });
  }

  async _onApplySheetDamage(event) {
      event.preventDefault();
      const calc = this.actor.system.calculator;
      const targetId = calc.target_id;
      const damage = Number(calc.last_damage);

      if (!targetId) {
          ui.notifications.warn("No target selected or ID lost. Please re-select target.");
          return;
      }
      if (damage === undefined || damage < 0) { 
           ui.notifications.warn("No valid damage calculated.");
           return;
      }

      const token = canvas.tokens.get(targetId);
      if (!token || !token.actor) {
          ui.notifications.warn("Target token not found on current scene.");
          return;
      }

      // 1. Calculate New HP
      const currentHP = Number(token.actor.system.resources.hp.value) || 0;
      const newHP = Math.max(0, currentHP - damage);

      // 2. Update Target Actor
      await token.actor.update({ "system.resources.hp.value": newHP });
      
      // 3. Apply Dead Status (Improved Check)
      if (newHP <= 0) {
          const isDead = token.actor.effects.some(e => e.statusId === "dead" || (e.statuses && e.statuses.has("dead")));
          
          if (!isDead) {
              await token.actor.toggleStatusEffect("dead", { overlay: true });
              ChatMessage.create({ content: `<strong>${token.name}</strong> has been defeated!` });
          }
      }

      // 4. Update Calculator: Sync HP and RESET ROLLS
      await this.actor.update({ 
          "system.calculator.target_ecur": newHP, 
          "system.calculator.attack_roll": 0,      
          "system.calculator.prof_roll": 0,        
          "system.calculator.defense_roll": 0,     
          "system.calculator.output": `Applied ${damage} Dmg. Rolls Reset.` 
      });

      ui.notifications.info(`Applied ${damage} damage to ${token.name}. HP: ${currentHP} -> ${newHP}`);
  }
}
```
