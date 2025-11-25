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
          // 1. Basic Checks: Must have actor, must not be self
          if (!t.actor || t.actor.id === attacker.id) return; 

          // 2. NEW CHECK: Skip if HP is 0 or less
          const hp = t.actor.system.resources?.hp?.value || 0;
          if (hp <= 0) return;

          // 3. Build Option HTML
          const opt = `<option value="${t.id}">${t.name}</option>`;
          if (t.actor.type === "character") pcOptions += opt;
          else npcOptions += opt;
          count++;
      });

      if (count === 0) {
          ui.notifications.warn("No valid targets found (Dead actors excluded).");
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
      
      const Attacker_d100 = Number(calc.attack_roll) || 0;
      const R_prof = Number(calc.prof_roll) || 0;
      const Defender_d100 = Number(calc.defense_roll) || 0;
      const Defender_Ecur = Number(calc.target_ecur) || 0;
      const Defender_Tier = Number(calc.target_tier) || 0;

      // Determine Attacker Tier for DTA
      let Attacker_Tier = 0;
      if (this.actor.type === 'character') {
          Attacker_Tier = this.actor.system.resources.action_surges.max || 0;
      } else {
          Attacker_Tier = this.actor.system.tier || 0;
      }

      // --- 1. CALCULATIONS (Fixed A_FP Logic) ---
      
      // A_FP: 100 - (Roll - Prof). No division.
      const A_FP = 100 - (Attacker_d100 - R_prof);
      
      // D_Margin: Defender Roll - E_cur
      const D_Margin = Defender_d100 - Defender_Ecur;
      
      // M_Defense: Tier * 5.5
      const M_Defense = Defender_Tier * 5.5;

      // Raw Damage Summation
      let rawDamage = (A_FP + D_Margin - M_Defense + R_prof);
      if (rawDamage < 1) rawDamage = 1;

      // Tier Multiplier (M_DTA)
      let multiplier = 1.0;
      const diff = Attacker_Tier - Defender_Tier;
      if (diff >= 1) multiplier = 1.25;
      if (diff >= 2) multiplier = 1.50;
      if (diff === 0) multiplier = 1.00;
      if (diff === -1) multiplier = 0.75;
      if (diff <= -2) multiplier = 0.50;

      const finalDamage = Math.floor(rawDamage * multiplier);

      // Attrition (Medium Weight default: 15 - floor(R_prof/2))
      const attritionCost = Math.max(0, 15 - Math.floor(R_prof / 2));

      // --- 2. UPDATE SHEET ---
      await this.actor.update({
          "system.calculator.output": `${finalDamage} Damage (x${multiplier})`,
          "system.calculator.last_damage": finalDamage 
      });

      // --- 3. CONSTRUCT CHAT HTML (With Visible Formulas) ---
      
      // Styles for the table look
      const containerStyle = "font-family: 'Signika', sans-serif; color: #191813; background: #e8e8e3; border: 1px solid #999; padding: 5px;";
      const headerStyle = "font-weight: bold; font-size: 1.5em; border-bottom: 2px solid #333; margin-bottom: 5px; line-height: 1.2;";
      const rowStyle = "display: flex; justify-content: space-between; padding: 4px 8px; font-size: 0.95em;";
      const greyRow = "background-color: rgba(0, 0, 0, 0.06);"; // The grey bar
      const formulaStyle = "font-size: 0.85em; color: #444; margin-left: 5px;"; // Style for the (100 - [33-23]) text

      const content = `
      <div class="narequenta chat-card" data-defender-token-id="${targetId}" data-damage="${finalDamage}" style="${containerStyle}">
          
          <div style="${headerStyle}">
              vs ${targetName}
          </div>

          <div style="display: grid; grid-template-columns: 1fr auto; margin-bottom: 15px; font-size: 0.9em; padding: 0 5px;">
              <div style="font-weight: bold;">${this.actor.name}</div>
              <div style="text-align: right;">Roll: ${Attacker_d100} (Prof: ${R_prof})</div>
              
              <div style="font-weight: bold;">${targetName}</div>
              <div style="text-align: right;">Roll: ${Defender_d100} (E_cur: ${Defender_Ecur})</div>
          </div>
          
          <div style="border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; margin-bottom: 15px; padding: 5px 0;">
              <div style="${rowStyle}">
                  <div><strong>A_FP</strong> <span style="${formulaStyle}">(100 - [${Attacker_d100}-${R_prof}]):</span></div>
                  <span>${A_FP}</span>
              </div>
              <div style="${rowStyle} ${greyRow}">
                  <div><strong>D_Margin</strong> <span style="${formulaStyle}">(${Defender_d100}-${Defender_Ecur}):</span></div>
                  <span>${D_Margin}</span>
              </div>
              <div style="${rowStyle}">
                  <div><strong>M_Defense</strong> <span style="${formulaStyle}">(${Defender_Tier}*5.5):</span></div>
                  <span>-${M_Defense}</span>
              </div>
              <div style="${rowStyle} ${greyRow}">
                  <div><strong>R_Prof</strong> <span style="${formulaStyle}">(Bonus):</span></div>
                  <span>+${R_prof}</span>
              </div>
              <div style="${rowStyle}">
                  <div><strong>M_DTA</strong> <span style="${formulaStyle}">(Tier ${Attacker_Tier} vs ${Defender_Tier}):</span></div>
                  <span>x${multiplier}</span>
              </div>
          </div>

          <div style="text-align: center; margin-bottom: 5px;">
              <span style="font-size: 2.0em; font-weight: bold; color: #8b0000; text-shadow: 1px 1px 0px rgba(0,0,0,0.1);">${finalDamage} Damage</span>
          </div>

          <div style="text-align: center; color: #555; font-size: 0.9em; font-weight: bold; margin-bottom: 15px;">
              Attrition Cost: -${attritionCost}% E_cur (Motor)
          </div>

          <div style="text-align:center;">
              <button class="apply-damage-btn" 
                  style="background: #8b0000; color: white; border: 1px solid #333; width: 100%; font-weight: bold; padding: 6px;" 
                  data-defender-token-id="${targetId}" 
                  data-damage="${finalDamage}"
                  data-attacker-uuid="${this.actor.uuid}"> <i class="fas fa-heart-broken"></i> Apply Damage
              </button>
          </div>
      </div>`;

      ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: content
      });
  }

      // 4. SYNC: Update YOUR calculator to show the new HP
      await this.actor.update({ "system.calculator.target_ecur": newHP });

      ui.notifications.info(`Applied ${damage} damage to ${token.name}. HP: ${currentHP} -> ${newHP}`);
  }
}
