import { EntitySheetHelper } from "./helper.js";
import { ATTRIBUTE_TYPES } from "./constants.js";

export class NarequentaActorSheet extends ActorSheet {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["narequenta", "sheet", "actor"],
      template: "systems/narequenta/templates/actor-sheet.html",
      width: 800,
      height: 750,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "essences"}]
    });
  }

  /** @inheritdoc */
  async getData(options) {
    const context = await super.getData(options);
    
    // Use Live Data
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

    // Waning Toggle & Button
    html.find(".waning-toggle").change(ev => {
        const isChecked = ev.target.checked;
        if (isChecked) html.find(".waning-roll-btn").slideDown();
        else html.find(".waning-roll-btn").slideUp();
    });
    html.find(".waning-roll-btn").click(this._onWaningPhase.bind(this));
    
    // Rest Buttons (Refocus/Renewal)
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

  async _onLongRest(event) {
    event.preventDefault();
    const actor = this.actor;

    const confirmed = await Dialog.confirm({
      title: "Renewal (Long Rest)",
      content: "<p>Perform a <strong>Long Rest (6h+)</strong>?<br>This will restore <strong>Active Vigor (HP)</strong> and all <strong>Essences</strong> to their current Maximum.</p>"
    });

    if (confirmed) {
      const updates = {};
      const essences = actor.system.essences;

      // 1. Restore All Essences to Max
      for (const [key, essence] of Object.entries(essences)) {
        updates[`system.essences.${key}.value`] = essence.max;
      }

      // 2. Restore Action Surges (PCs only)
      if (actor.type === "character") {
        updates[`system.resources.action_surges.value`] = actor.system.resources.action_surges.max;
      }

      // 3. Restore Active Vigor (HP) to Max
      updates[`system.resources.hp.value`] = actor.system.resources.hp.max;

      await actor.update(updates);

      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: actor }),
        content: `
          <div class="narequenta chat-card">
            <h3>Renewal (Long Rest)</h3>
            <p>The character rests for 6 hours.</p>
            <ul>
              <li><strong>Essences:</strong> Fully Restored.</li>
              <li><strong>Active Vigor (HP):</strong> Fully Restored.</li>
              <li><strong>Action Surges:</strong> Reset.</li>
            </ul>
          </div>`
      });
    }
  }

  async _onShortRest(event) {
    event.preventDefault();
    const actor = this.actor;

    const content = `
    <form>
      <div class="form-group">
        <label>Rest Intensity:</label>
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
      <div class="form-group" style="border-top:1px solid #333; padding-top:5px;">
        <label style="font-weight:bold; color:#006400;">Manual Override (%):</label>
        <input type="number" id="manual-recovery" placeholder="Auto-Roll" style="width:100%;">
        <p class="notes" style="font-size:0.8em;">Enter a number to skip the roll.</p>
      </div>
    </form>
    <script>
      $("#rest-type").change(function() {
         if ($(this).val() === "mental") $("#mental-options").slideDown();
         else $("#mental-options").slideUp();
      });
    </script>
    `;

    new Dialog({
      title: "Refocus (Short Rest)",
      content: content,
      buttons: {
        rest: {
          icon: '<i class="fas fa-coffee"></i>',
          label: "Recover Energy",
          callback: async (html) => {
            const type = html.find("#rest-type").val();
            const manualVal = html.find("#manual-recovery").val();
            
            let formula = "1d6"; 
            if (type === "mental") formula = html.find("#mental-duration").val();
            else if (type === "deep") formula = "4d10";

            let recoveredAmount = 0;
            let resultMsg = "";

            // CHECK MANUAL INPUT
            if (manualVal !== "" && Number(manualVal) >= 0) {
                recoveredAmount = parseInt(manualVal);
                resultMsg = `Manual Input: +${recoveredAmount}%`;
            } else {
                // ROLL DICE
                const roll = new Roll(formula);
                await roll.evaluate();
                if (game.dice3d) game.dice3d.showForRoll(roll);
                recoveredAmount = roll.total;
                resultMsg = `Roll (${formula}): +${recoveredAmount}%`;
                
                // Show Roll Result in Chat
                roll.toMessage({
                    speaker: ChatMessage.getSpeaker({ actor: actor }),
                    flavor: "Refocus Roll"
                });
            }

            const updates = {};
            const essences = actor.system.essences;
            const hp = actor.system.resources.hp;
            let outputList = "";

            // 1. Apply to All Essences
            for (const [key, essence] of Object.entries(essences)) {
              let newValue = essence.value + recoveredAmount;
              if (newValue > essence.max) newValue = essence.max;
              
              updates[`system.essences.${key}.value`] = newValue;
              
              if (essence.value < essence.max) {
                 outputList += `<li><strong>${essence.label}:</strong> +${recoveredAmount}% (${newValue}%)</li>`;
              }
            }

            // 2. Apply to Active Vigor (HP)
            let newHP = hp.value + recoveredAmount;
            if (newHP > hp.max) newHP = hp.max;
            updates[`system.resources.hp.value`] = newHP;
            
            if (hp.value < hp.max) {
                outputList += `<li><strong>Active Vigor (HP):</strong> +${recoveredAmount} (${newHP})</li>`;
            }

            await actor.update(updates);

            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: actor }),
              content: `
                <div class="narequenta chat-card">
                  <h3>Refocus (${type.toUpperCase()})</h3>
                  <div><strong>${resultMsg}</strong></div>
                  <hr><ul>${outputList || "<li>No recovery needed.</li>"}</ul>
                </div>`
            });
          }
        }
      }
    }).render(true);
  }

  /* -------------------------------------------- */
  /* WANING PHASE LOGIC (ONE BY ONE)             */
  /* -------------------------------------------- */
  
  async _onWaningPhase(event) {
      event.preventDefault();
      const actor = this.actor;
      const essenceKeys = ["vitalis", "motus", "sensus", "verbum", "anima"];
      const essenceLabels = {
          "vitalis": "VITALIS", "motus": "MOTUS", "sensus": "SENSUS",
          "verbum": "VERBUM", "anima": "ANIMA"
      };

      let essenceDropdown = "";
      essenceKeys.forEach(key => {
          essenceDropdown += `<option value="${key}">${essenceLabels[key]}</option>`;
      });

      let rowsHTML = "";
      essenceKeys.forEach(key => {
          rowsHTML += `
          <tr id="row-${key}" class="essence-row-calc">
              <td style="font-weight:bold;">${essenceLabels[key]}</td>
              <td id="formula-${key}" class="formula-cell" style="color:#555; text-align:center;">1d6</td>
              <td>
                  <button class="roll-individual-btn" data-key="${key}" style="padding:2px 8px;"><i class="fas fa-dice"></i></button>
              </td>
              <td><input type="number" id="result-${key}" class="nq-manual" style="width:50px; text-align:center;"></td>
              <td id="display-${key}" style="font-size:0.8em; color:#666;">-</td>
          </tr>`;
      });

      const content = `
      <div class="narequenta">
          <style>
              .nq-section { margin-bottom: 10px; }
              .nq-table td { padding: 4px; border-bottom: 1px solid #eee; vertical-align: middle; }
              .nq-focus-highlight { background-color: rgba(0, 100, 0, 0.1); color: #006400; }
          </style>
          <p style="font-style:italic; font-size:0.9em; text-align:center;">"End of Chapter: Progression through Loss."</p>
          <div class="nq-section">
              <label style="font-weight:bold;">Select Focus Essence (2d6):</label>
              <select id="focus-select" style="width:100%">${essenceDropdown}</select>
          </div>
          <div class="nq-section">
              <table class="nq-table" style="width:100%">
                  <thead><tr><th>Essence</th><th>Dice</th><th>Roll</th><th>Loss</th><th>Info</th></tr></thead>
                  <tbody>${rowsHTML}</tbody>
              </table>
          </div>
      </div>`;

      const d = new Dialog({
          title: `The Waning: ${actor.name}`,
          content: content,
          buttons: {
              apply: {
                  icon: '<i class="fas fa-check"></i>',
                  label: "Apply All Changes",
                  callback: async (html) => {
                      const focusKey = html.find("#focus-select").val();
                      const updates = {};
                      let chatOutput = "";

                      for (const key of essenceKeys) {
                          const resultVal = html.find(`#result-${key}`).val();
                          // Only process if a result exists (rolled or manual)
                          if (resultVal === "") continue; 

                          const loss = parseInt(resultVal);
                          const currentMax = actor.system.essences[key].max;
                          let newMax = currentMax - loss;
                          
                          if (newMax < 50) newMax = 50;

                          updates[`system.essences.${key}.max`] = newMax;
                          const isFocus = (key === focusKey);

                          chatOutput += `
                          <div style="display:flex; justify-content:space-between; font-size:0.9em; ${isFocus ? 'font-weight:bold; color:#006400;' : ''}">
                              <span>${essenceLabels[key]}:</span>
                              <span>-${loss}% (${newMax}%)</span>
                          </div>`;
                      }

                      if (Object.keys(updates).length > 0) {
                          await actor.update(updates);
                          ChatMessage.create({
                              speaker: ChatMessage.getSpeaker({ actor: actor }),
                              content: `
                              <div class="narequenta chat-card">
                                  <h3>The Waning</h3>
                                  <div style="margin-bottom:5px;"><strong>Focus:</strong> ${essenceLabels[focusKey]}</div>
                                  <hr>${chatOutput}<hr>
                                  <div style="text-align:center; font-style:italic;">Sheet Updated.</div>
                              </div>`
                          });
                      }
                  }
              }
          },
          render: (html) => {
              const updateHighlights = () => {
                  const focusKey = html.find("#focus-select").val();
                  essenceKeys.forEach(k => {
                      html.find(`#row-${k}`).removeClass("nq-focus-highlight");
                      html.find(`#formula-${k}`).text("1d6");
                  });
                  html.find(`#row-${focusKey}`).addClass("nq-focus-highlight");
                  html.find(`#formula-${focusKey}`).html("<b>2d6</b>");
              };
              updateHighlights();
              html.find("#focus-select").change(updateHighlights);

              html.find(".roll-individual-btn").click(async (ev) => {
                  ev.preventDefault();
                  const btn = $(ev.currentTarget);
                  const key = btn.data("key");
                  const focusKey = html.find("#focus-select").val();
                  const isFocus = (key === focusKey);
                  
                  const formula = isFocus ? "2d6" : "1d6";
                  const r = new Roll(formula);
                  await r.evaluate();
                  if (game.dice3d) game.dice3d.showForRoll(r);

                  let loss = r.total;
                  let displayInfo = `Rolled ${loss}`;

                  const currentMax = actor.system.essences[key].max;
                  if (isFocus && currentMax === 100) {
                      const potentialMax = currentMax - loss;
                      if (potentialMax > 90) {
                          loss = 10; 
                          displayInfo = `Rolled ${r.total} -> Set 10 (Tier I Guarantee)`;
                      }
                  }

                  html.find(`#result-${key}`).val(loss);
                  html.find(`#display-${key}`).text(displayInfo);
                  
                  // Show roll result in chat
                  r.toMessage({
                      speaker: ChatMessage.getSpeaker({ actor: actor }),
                      flavor: `Waning Roll (${essenceLabels[key]})`
                  });
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

      new Dialog({
          title: `⚔️ Select Target`,
          content: `
          <form style="margin-bottom:10px;">
              <div class="form-group">
                  <label style="font-weight:bold;">Target:</label>
                  <select id="contest-target" style="width:100%">${targetList}</select>
              </div>
          </form>
          `,
          buttons: {
              select: {
                  icon: '<i class="fas fa-crosshairs"></i>',
                  label: "Lock Target",
                  callback: async (html) => {
                      const targetId = html.find("#contest-target").val();
                      const targetToken = canvas.tokens.get(targetId);
                      if(!targetToken) return;
                      
                      const target = targetToken.actor;
                      
                      // Calculate Target Stats
                      const dTier = target.system.resources?.action_surges?.max || target.system.tier || 0;
                      const dEcur = target.system.essences?.vitalis?.value || 0; 

                      // Update THIS Actor's Calculator Data
                      await attacker.update({
                          "system.calculator.target_name": target.name,
                          "system.calculator.target_tier": dTier,
                          "system.calculator.target_ecur": dEcur,
                          "system.calculator.defense_roll": 0, 
                          "system.calculator.output": "Target Selected. Roll when ready."
                      });

                      const sheet = attacker.sheet;
                      if (sheet._tabs && sheet._tabs[0]) {
                          sheet._tabs[0].activate("calculator");
                      }
                  }
              }
          },
          default: "select"
      }).render(true);
  }

  /* -------------------------------------------- */
  /* SHEET CALCULATOR ROLLS                      */
  /* -------------------------------------------- */
  
  async _onRollSheetCalc(event) {
      event.preventDefault();
      const btn = $(event.currentTarget);
      const targetField = btn.data("target");
      const type = btn.data("type");
      
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
              return;
          }
          formula = `${tier}d10`;
      }

      const roll = new Roll(formula);
      await roll.evaluate();
      
      if (game.dice3d) game.dice3d.showForRoll(roll);
      
      // Output Roll to Chat
      await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          flavor: `Calculator Roll (${formula})`
      });
      
      await this.actor.update({ [targetField]: roll.total });
  }

  _onItemControl(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const li = button.closest(".item");
    const item = this.actor.items.get(li?.dataset.itemId);

    switch ( button.dataset.action ) {
      case "create":
        const cls = getDocumentClass("Item");
        return cls.create({name: game.i18n.localize("NAREQUENTA.ItemNew"), type: "item"}, {parent: this.actor});
      case "edit":
        return item.sheet.render(true);
      case "delete":
        return item.delete();
    }
  }

  _onItemRoll(event) {
    let button = $(event.currentTarget);
    const item = this.actor.items.get(button.parents(".item").data("itemId"));
    if (item) item.roll(); 
  }

  async _onCalculate(event) {
      event.preventDefault();
      const calc = this.actor.system.calculator;
      
      const Attacker_d100 = Number(calc.attack_roll);
      const R_prof = Number(calc.prof_roll);
      const Defender_d100 = Number(calc.defense_roll);
      const Defender_Ecur = Number(calc.target_ecur);
      const Defender_Tier = Number(calc.target_tier);

      let Attacker_Tier = 0;
      if (this.actor.type === 'character') {
          Attacker_Tier = this.actor.system.resources.action_surges.max || 0;
      } else {
          Attacker_Tier = this.actor.system.tier || 0;
      }

      const A_FP = 100 - (Attacker_d100 - R_prof);
      const D_Margin = Defender_d100 - Defender_Ecur;
      const M_Defense = Defender_Tier * 5.5;

      let rawDamage = (A_FP - M_Defense + D_Margin + R_prof);
      if (rawDamage < 0) rawDamage = 0;

      let multiplier = 1.0;
      const diff = Attacker_Tier - Defender_Tier;
      if (diff === 1) multiplier = 1.25;
      else if (diff === 2) multiplier = 1.50;
      else if (diff >= 3) multiplier = 1.75; 
      else if (diff === -1) multiplier = 0.75;
      else if (diff === -2) multiplier = 0.50;
      else if (diff <= -3) multiplier = 0.25;

      const finalDamage = Math.floor(rawDamage * multiplier);
      const resultString = `Damage: ${finalDamage} (x${multiplier})`;
      
      await this.actor.update({"system.calculator.output": resultString});
  }
}