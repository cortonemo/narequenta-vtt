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

	async _onEquipItem(event) {
      event.preventDefault();
      const li = $(event.currentTarget).closest(".item");
      const itemId = li.data("itemId");
      const item = this.actor.items.get(itemId);

      // Toggle Logic: If already equipped, unequip it.
      const currentEquipped = this.actor.system.equipped_item_id;
      let newEquipped = itemId;
      
      if (currentEquipped === itemId) {
          newEquipped = ""; // Unequip
      }

      // If equipping a weapon, automatically update the Calculator Synergy to match!
      if (newEquipped !== "") {
          const synergy = item.system.cost?.quality || "none";
          await this.actor.update({
              "system.equipped_item_id": newEquipped,
              "system.calculator.quality_synergy": synergy
          });
          ui.notifications.info(`Equipped ${item.name}. Calculator updated to ${synergy.toUpperCase()} synergy.`);
      } else {
          await this.actor.update({ "system.equipped_item_id": "" });
      }
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
	
	// Inside activateListeners
	html.find(".item-equip").click(this._onEquipItem.bind(this));

    // Items
    html.find(".item-control").click(this._onItemControl.bind(this));
    html.find(".items .rollable").on("click", this._onItemRoll.bind(this));

    // Calculator
    html.find(".roll-calculation").click(this._onCalculate.bind(this));
    html.find(".apply-sheet-damage").click(this._onApplySheetDamage.bind(this)); // NEW LISTENER

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
  /* REST & RECOVERY LOGIC                       */
  /* -------------------------------------------- */
  // ... (Keep existing _onLongRest and _onShortRest same as before) ...
  async _onLongRest(event) {
    event.preventDefault();
    const actor = this.actor;
    const confirmed = await Dialog.confirm({
      title: "Renewal (Long Rest)",
      content: "<p>Perform a <strong>Long Rest (6h+)</strong>?<br>This will restore <strong>Active Vigor (HP)</strong> and all <strong>Essences</strong> to <strong>100%</strong>.</p>"
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
    // ... (Copy the previously provided _onShortRest function here) ...
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

  // ... (Keep _onWaningPhase as provided previously) ...
  async _onWaningPhase(event) {
      event.preventDefault();
      // ... [Code omitted for brevity, copy from previous turn] ...
      // Ensure the content generation uses the individual roll logic
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
      const content = `<div class="narequenta">...<select id="focus-select" style="width:100%">${essenceDropdown}</select>...<table class="nq-table" style="width:100%"><thead><tr><th>Essence</th><th>Dice</th><th>Roll</th><th>Loss</th><th>Info</th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`;
      
      const performWaning = async (html, dialogInstance) => {
          // ... [Previous logic for apply] ...
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
              // ... [Highlight and Roll Logic] ...
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
  /* CONTESTED ROLL SUITE (Updates Sheet Data)   */
  /* -------------------------------------------- */

  _onLaunchContest(event) {
      event.preventDefault();
      const attacker = this.actor;
      
      let pcOptions = "";
      let npcOptions = "";
      let count = 0;

      canvas.tokens.placeables.forEach(t => {
          if (!t.actor || t.actor.id === attacker.id) return; 
          const opt = `<option value="${t.id}">${t.name}</option>`;
          if (t.actor.type === "character") pcOptions += opt;
          else npcOptions += opt;
          count++;
      });

      if (count === 0) {
          ui.notifications.warn("No valid targets found on the current scene.");
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
                  <label style="font-weight:bold;">Target:</label>
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
                      
                      const dTier = target.system.resources?.action_surges?.max || target.system.tier || 0;
                      const dEcur = target.system.essences[essenceKey]?.value || 0; 
                      const essenceLabel = essenceKey.charAt(0).toUpperCase() + essenceKey.slice(1);

                      await attacker.update({
                          "system.calculator.target_name": `${target.name} (${essenceLabel})`,
                          "system.calculator.target_id": targetId, // STORE TARGET ID
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
  /* SHEET CALCULATOR ROLLS                      */
  /* -------------------------------------------- */
  // ... (Keep _onRollSheetCalc and _onItemControl etc) ...
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

  _onItemRoll(event) {
    let button = $(event.currentTarget);
    const item = this.actor.items.get(button.parents(".item").data("itemId"));
    if (item) item.roll(); 
  }

// --- MODIFIED CALCULATE FUNCTION (v0.9.3 Compliance) ---
async _onCalculate(event) {
      event.preventDefault();
      const calc = this.actor.system.calculator;
      const targetName = calc.target_name || "Target";
      const targetId = calc.target_id || ""; 
      
      // 1. GET INPUTS
      let Attacker_d100 = Number(calc.attack_roll) || 0;
      let R_prof = Number(calc.prof_roll) || 0; // Raw roll result
      
      const Defender_d100 = Number(calc.defense_roll) || 0;
      const Defender_Ecur = Number(calc.target_ecur) || 0;
      const Defender_Tier = Number(calc.target_tier) || 0;
      
      // Get Synergy Selection (Ensure you added the dropdown to HTML)
      const Synergy = calc.quality_synergy || "none";

      // 2. DETERMINE ATTACKER TIER
      let Attacker_Tier = 0;
      if (this.actor.type === 'character') {
          Attacker_Tier = this.actor.system.resources.action_surges.max || 0;
      } else {
          Attacker_Tier = this.actor.system.tier || 0;
      }

      // 3. APPLY SYNERGIES (PRE-CALCULATION)
      // Motus: Adds +2 to the Proficiency Result (Accuracy)
      let effectiveProf = R_prof;
      if (Synergy === "motus") effectiveProf += 2;

      // Sensus: Expands Critical Range from 1-5 to 1-15
      let critThreshold = 5; 
      if (Synergy === "sensus") critThreshold = 15;

      // 4. CHECK CRITICAL (THE SPARK)
      // v0.9.3: If Crit, treat the d100 roll as a "1" for calculation purposes.
      let isCrit = false;
      let effectiveRoll = Attacker_d100;
      
      if (Attacker_d100 <= critThreshold) {
          isCrit = true;
          effectiveRoll = 1; 
      }

      // 5. CALCULATE A_FP (HALF-POTENTIAL)
      // v0.9.3 Formula: floor( (100 - (Roll - R_prof)) / 2 )
      // We use effectiveRoll (1 if Crit) and effectiveProf (Motus bonus included)
      const rawPotential = 100 - (effectiveRoll - effectiveProf);
      const A_FP = Math.floor(rawPotential / 2);

      const D_Margin = Defender_d100 - Defender_Ecur;
      const M_Defense = Defender_Tier * 5.5;

      // 6. BASE DAMAGE CALCULATION
      // D_Final = (A_FP - M_Def + D_Margin + R_prof)
      let rawDamage = (A_FP - M_Defense + D_Margin + effectiveProf);
      
      // Vitalis Synergy: Add Tier Value to Damage
      if (Synergy === "vitalis") {
          rawDamage += Attacker_Tier;
      }

      // Floor damage at 1 before multiplier
      if (rawDamage < 1) rawDamage = 1; 

      // 7. CALCULATE TIER MULTIPLIER (M_DTA)
      let multiplier = 1.0;
      let tierDiff = Attacker_Tier - Defender_Tier;
      
      // Verbum Synergy: Ignore one step of Tier Disadvantage
      // (Only helps if you are lower tier than opponent)
      if (Synergy === "verbum" && tierDiff < 0) {
          tierDiff += 1; 
      }

      if (tierDiff >= 1) multiplier = 1.25;      
      if (tierDiff >= 2) multiplier = 1.50;      
      if (tierDiff === 0) multiplier = 1.00;
      if (tierDiff === -1) multiplier = 0.75;
      if (tierDiff <= -2) multiplier = 0.50;

      const finalDamage = Math.floor(rawDamage * multiplier);
      
      // 8. ATTRITION CALCULATION (Updated for Equipped Weapon)
      const equippedId = this.actor.system.equipped_item_id;
      const equippedItem = this.actor.items.get(equippedId);
      
      let weightClass = "medium"; // Default
      if (equippedItem) {
          weightClass = equippedItem.system.weight_class || "medium";
      }

      // Base Costs: Light=10, Medium=15, Heavy=20
      let baseCost = 15;
      if (weightClass === "light") baseCost = 10;
      if (weightClass === "heavy") baseCost = 20;

      // Formula: Base Cost - floor(R_prof/2)
      const attritionReduction = Math.floor(effectiveProf / 2);
      let calculatedAttrition = Math.max(0, baseCost - attritionReduction);

      // Crit Success halves the Attrition Cost
      if (isCrit) {
          calculatedAttrition = Math.floor(calculatedAttrition / 2);
      }

      // 9. UPDATE SHEET DISPLAY
      const critText = isCrit ? " (CRIT!)" : "";
      const resultString = `Damage: ${finalDamage} (x${multiplier})${critText}`;

      await this.actor.update({
          "system.calculator.output": resultString,
          "system.calculator.last_damage": finalDamage 
      });

      // 10. GENERATE CHAT CARD (Update the Attrition section)
      // We now show the SPECIFIC calculated cost for the equipped weapon
      const attritionHtml = `
          <div style="background: rgba(0,0,0,0.05); padding: 5px; border-radius: 4px; font-size: 0.9em; color: #333; margin-top: 10px;">
              <div style="font-weight:bold; text-align:center; margin-bottom:2px;">
                Attrition Cost ${equippedItem ? `(${equippedItem.name})` : ''}
                ${isCrit ? '<br><span style="color:green;">(HALVED BY CRIT)</span>' : ''}
              </div>
              <div style="text-align:center; font-size: 1.2em; font-weight: bold; color: #8b0000;">
                  -${calculatedAttrition}% E_cur
              </div>
              <div style="text-align:center; font-size: 0.8em; margin-top:2px; font-style:italic;">
                ${weightClass.charAt(0).toUpperCase() + weightClass.slice(1)} (${baseCost}) - floor(${effectiveProf}/2)
              </div>
          </div>
      `;

      const content = `
      <div class="narequenta chat-card" data-defender-token-id="${targetId}" data-damage="${finalDamage}">
          <header class="card-header flexrow" style="border-bottom: 2px solid #333; margin-bottom: 5px;">
              <h3>vs ${targetName} <span style="color:#8b0000;">${critText}</span></h3>
          </header>
          <div class="card-content" style="padding: 5px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.9em;">
                 <span><strong>Roll:</strong> ${Attacker_d100} ${isCrit ? '(Treat as 1)' : ''}</span>
                 <span><strong>Prof:</strong> ${R_prof} ${Synergy === 'motus' ? '(+2)' : ''}</span>
              </div>
              <hr>
              ${breakdownHtml}
              <hr>
              <div style="font-size: 1.5em; text-align: center; font-weight: bold; margin: 10px 0; color: #8b0000;">
                  ${finalDamage} Damage
              </div>
              
              ${attritionHtml} <div style="text-align:center; margin-top:10px;">
                  <button class="apply-damage-btn" style="background:#8b0000; color:white; width:90%;" data-defender-token-id="${targetId}" data-damage="${finalDamage}">
                      <i class="fas fa-heart-broken"></i> Apply Damage
                  </button>
              </div>
          </div>
      </div>`;

      ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: content
      });
  }

  // --- NEW: APPLY DAMAGE FROM SHEET (Fixed Dead Status) ---
  async _onApplySheetDamage(event) {
      event.preventDefault();
      const calc = this.actor.system.calculator;
      const targetId = calc.target_id;
      const damage = Number(calc.last_damage);

      if (!targetId) {
          ui.notifications.warn("No target selected or ID lost. Please re-select target.");
          return;
      }
      if (!damage || damage <= 0) {
          ui.notifications.warn("No valid damage calculated to apply.");
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

      // 2. Update the Target Actor
      await token.actor.update({ "system.resources.hp.value": newHP });
      
      // 3. Check for "Down/Dead" Status
      if (newHP === 0 && currentHP > 0) {
          // Use the ACTOR method to toggle the effect. This is the most robust way.
          const isDead = token.actor.effects.some(e => e.statusId === "dead");
          if (!isDead) {
              await token.actor.toggleStatusEffect("dead", { overlay: true });
              
              // Optional: Send chat notification
              ChatMessage.create({
                  content: `<strong>${token.name}</strong> has been defeated!`
              });
          }
      }

      // 4. SYNC: Update YOUR calculator to show the new HP
      await this.actor.update({ "system.calculator.target_ecur": newHP });

      ui.notifications.info(`Applied ${damage} damage to ${token.name}. HP: ${currentHP} -> ${newHP}`);
  }
}
