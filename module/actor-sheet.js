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

    // NEW: Waning Roll
    html.find(".waning-roll-btn").click(this._onWaningPhase.bind(this));
    
    // NEW: Rest Buttons
    html.find(".short-rest").click(this._onShortRest.bind(this));
    html.find(".long-rest").click(this._onLongRest.bind(this));

    // NEW: Contested Roll Launcher
    html.find(".launch-contest").click(this._onLaunchContest.bind(this));
    
    // NEW: Sheet Calculator Roll Buttons
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
      content: "<p>Perform a <strong>Long Rest (6h+)</strong>?<br>This will restore all Essences to their current Maximum and reset Action Surges.</p>"
    });

    if (confirmed) {
      const updates = {};
      const essences = actor.system.essences;

      // Restore Essences to Max
      for (const [key, essence] of Object.entries(essences)) {
        updates[`system.essences.${key}.value`] = essence.max;
      }

      // Restore Action Surges (PCs only)
      if (actor.type === "character") {
        updates[`system.resources.action_surges.value`] = actor.system.resources.action_surges.max;
      }

      // Restore HP (Optional standard rule)
      updates[`system.resources.hp.value`] = actor.system.resources.hp.max;

      await actor.update(updates);

      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: actor }),
        content: `
          <div class="narequenta chat-card">
            <h3>Renewal (Long Rest)</h3>
            <p>The character rests for 6 hours.</p>
            <ul>
              <li><strong>Essences:</strong> Fully Restored to E_max.</li>
              <li><strong>Action Surges:</strong> Reset.</li>
              <li><strong>HP:</strong> Fully Restored.</li>
            </ul>
          </div>`
      });
    }
  }

  async _onShortRest(event) {
    event.preventDefault();
    const actor = this.actor;

    // Updated v0.9.7 Rules: Refocus Options
    // Quick Breath: 1d6
    // Mental Calming: 2d8 (Base 5 min) + 1d8 per extra 5 min (Max 30 min)
    // Deep Meditation: 4d10 (1 Hour)

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
      <div id="mental-options" style="display:block; background:#f0f0f0; padding:5px; border:1px solid #ccc;">
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
    </form>
    <script>
      $("#rest-type").change(function() {
         if ($(this).val() === "mental") {
            $("#mental-options").slideDown();
         } else {
            $("#mental-options").slideUp();
         }
      });
    </script>
    `;

    new Dialog({
      title: "Refocus (Short Rest)",
      content: content,
      buttons: {
        rest: {
          icon: '<i class="fas fa-coffee"></i>',
          label: "Roll Recovery",
          callback: async (html) => {
            const type = html.find("#rest-type").val();
            let formula = "1d6"; // Default Quick

            if (type === "mental") {
               formula = html.find("#mental-duration").val();
            } else if (type === "deep") {
               formula = "4d10";
            }

            const roll = new Roll(formula);
            await roll.evaluate();
            
            if (game.dice3d) game.dice3d.showForRoll(roll);

            const updates = {};
            const recoveredAmount = roll.total;
            const essences = actor.system.essences;
            let outputList = "";

            // Apply recovery to all Essences
            for (const [key, essence] of Object.entries(essences)) {
              let newValue = essence.value + recoveredAmount;
              if (newValue > essence.max) newValue = essence.max;
              
              updates[`system.essences.${key}.value`] = newValue;
              
              if (essence.value < essence.max) {
                 outputList += `<li><strong>${essence.label}:</strong> +${recoveredAmount}% (${newValue}%)</li>`;
              }
            }
            
            await actor.update(updates);

            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: actor }),
              content: `
                <div class="narequenta chat-card">
                  <h3>Refocus (${type.toUpperCase()})</h3>
                  <div><strong>Die Rolled:</strong> ${formula}</div>
                  <div><strong>Result:</strong> +${recoveredAmount}% Recovery</div>
                  <hr>
                  <ul>${outputList || "<li>No recovery needed (At Max).</li>"}</ul>
                </div>`
            });
          }
        }
      }
    }).render(true);
  }

  /* -------------------------------------------- */
  /* WANING PHASE LOGIC                          */
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
          <tr id="row-${key}">
              <td style="font-weight:bold;">${essenceLabels[key]}</td>
              <td id="formula-${key}" style="color:#555; font-size:0.8em; text-align:center;">1d6</td>
              <td><input type="number" id="input-${key}" class="nq-manual" placeholder="Auto"></td>
          </tr>`;
      });

      const content = `
      <div class="narequenta">
          <style>
              .nq-section { margin-bottom: 10px; }
              .nq-label { font-weight: bold; display: block; margin-bottom: 2px; color: #333; }
              .nq-manual { width: 100%; text-align: center; }
              .nq-table { width: 100%; border-collapse: collapse; margin-top: 5px; }
              .nq-table td { padding: 4px; border-bottom: 1px solid #eee; }
              .nq-focus-highlight { background-color: rgba(0, 100, 0, 0.1); color: #006400; }
          </style>
          
          <p style="font-style:italic; font-size:0.9em; text-align:center;">"End of Chapter: Progression through Loss."</p>

          <div class="nq-section">
              <label class="nq-label">Select Focus Essence (2d6):</label>
              <select id="focus-select" style="width:100%">${essenceDropdown}</select>
          </div>

          <div class="nq-section">
              <label class="nq-label">Input Loss (Leave Empty to Auto-Roll):</label>
              <table class="nq-table">
                  <thead><tr><th style="text-align:left;">Essence</th><th>Dice</th><th>Manual</th></tr></thead>
                  <tbody>${rowsHTML}</tbody>
              </table>
          </div>
      </div>`;

      const performWaning = async (html, dialogInstance) => {
          const focusKey = html.find("#focus-select").val();
          const updates = {};
          let chatOutput = "";
          
          for (const key of essenceKeys) {
              const isFocus = (key === focusKey);
              const manualInput = html.find(`#input-${key}`).val();
              
              let loss = 0;
              let originalRoll = 0; 
              let note = ""; 

              if (manualInput !== "" && Number(manualInput) > 0) {
                  loss = parseInt(manualInput);
                  originalRoll = loss;
                  note = "(Manual)";
              } else {
                  const formula = isFocus ? "2d6" : "1d6";
                  const r = new Roll(formula);
                  await r.evaluate();
                  loss = r.total;
                  originalRoll = loss; 
                  if (game.dice3d) game.dice3d.showForRoll(r);
              }

              const currentMax = actor.system.essences[key].max;
              let newMax = currentMax - loss;

              if (isFocus && currentMax === 100) {
                  if (newMax > 90) {
                      newMax = 90;
                      loss = 10; 
                      note = `<span style="color:#aa0000; font-size:0.85em;">(Rolled ${originalRoll}, set to 10)</span>`;
                  } else {
                      note = `<span style="color:#555; font-size:0.85em;">(Natural ${originalRoll})</span>`;
                  }
              }

              if (newMax < 50) newMax = 50;

              updates[`system.essences.${key}.max`] = newMax;

              chatOutput += `
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.9em; ${isFocus ? 'font-weight:bold; color:#006400;' : ''}">
                  <span>${essenceLabels[key]}:</span>
                  <div style="text-align:right;">
                      <span>-${loss}%</span>
                      ${note}
                      <span> -> ${newMax}%</span>
                  </div>
              </div>`;
          }

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
          
          dialogInstance.close();
      };

      const d = new Dialog({
          title: `The Waning: ${actor.name}`,
          content: content,
          buttons: {
              roll: {
                  icon: '<i class="fas fa-dice"></i>',
                  label: "Process Waning",
                  callback: (html) => performWaning(html, d)
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
          }
      });
      d.render(true);
  }

  /* -------------------------------------------- */
  /* CONTESTED ROLL SUITE (v0.9.8 - Stable)      */
  /* -------------------------------------------- */

  _onLaunchContest(event) {
      event.preventDefault();
      const attacker = this.actor;
      
      // 1. Gather Tokens from Scene
      let pcOptions = "";
      let npcOptions = "";
      let count = 0;

      canvas.tokens.placeables.forEach(t => {
          // Skip objects without actors
          if (!t.actor) return;
          
          // Skip self (Don't target yourself)
          if (t.actor.id === attacker.id) return; 

          const opt = `<option value="${t.id}">${t.name}</option>`;
          if (t.actor.type === "character") {
              pcOptions += opt;
          } else {
              npcOptions += opt;
          }
          count++;
      });

      if (count === 0) {
          ui.notifications.warn("No valid targets found on the current scene.");
          return;
      }

      // 2. Build Grouped Select List
      const targetList = `
          <optgroup label="Adversaries (NPCs)">${npcOptions}</optgroup>
          <optgroup label="Characters (PCs)">${pcOptions}</optgroup>
      `;

      // 3. Show Dialog
      new Dialog({
          title: `⚔️ Select Target for ${attacker.name}`,
          content: `
          <form style="margin-bottom:10px;">
              <div class="form-group">
                  <label style="font-weight:bold;">Target:</label>
                  <select id="contest-target" style="width:100%">${targetList}</select>
              </div>
          </form>
          `,
          buttons: {
              fight: {
                  icon: '<i class="fas fa-crosshairs"></i>',
                  label: "Target Enemy",
                  callback: (html) => {
                      const targetId = html.find("#contest-target").val();
                      this._launchContestCalculator(attacker, targetId);
                  }
              }
          },
          default: "fight"
      }).render(true);
  }

  _launchContestCalculator(attacker, targetTokenId) {
      const targetToken = canvas.tokens.get(targetTokenId);
      
      // Safety Check: Does token exist?
      if (!targetToken || !targetToken.actor) {
          ui.notifications.error("Target token/actor data not found. Is the token linked?");
          return;
      }
      
      const target = targetToken.actor;

      // Get Data with Fallbacks to prevent "undefined" errors
      const aTier = attacker.system.resources?.action_surges?.max || attacker.system.tier || 0;
      const dTier = target.system.resources?.action_surges?.max || target.system.tier || 0;
      
      // Default Defense Energy to Vitalis (Standard) or 0 if missing
      const dEcur = target.system.essences?.vitalis?.value || 0; 
      
      const profFormula = aTier > 0 ? `${aTier}d10` : "0";

      const content = `
      <div class="narequenta">
          <style>
              .nq-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; }
              .nq-input { width: 60px; text-align: center; font-weight: bold; }
              .nq-btn { flex: 0 0 30px; height: 26px; line-height: 26px; margin-left: 5px; text-align: center; cursor: pointer; background: #ddd; border: 1px solid #999; border-radius: 3px; }
              .nq-btn:hover { background: #ccc; }
              .nq-actions { display: flex; gap: 5px; margin-top: 15px; }
              .nq-main-btn { flex: 1; background: #333; color: white; border: none; padding: 5px; cursor: pointer; border-radius: 3px; }
              .nq-result-box { margin-top: 15px; padding: 10px; background: #f0f0f0; border: 2px solid #333; text-align: center; display: none; }
          </style>
          <div class="essence-grid-container">
              <div class="essence-header" style="grid-template-columns: 1fr 1fr; gap: 10px; text-align: center;">
                  <div>
                      <span style="color:#006400; font-weight:bold;">${attacker.name}</span>
                      <div style="font-size: 0.8em; color: #555;">Tier ${aTier} (You)</div>
                  </div>
                  <div>
                      <span style="color:#8b0000; font-weight:bold;">${target.name}</span>
                      <div style="font-size: 0.8em; color: #555;">Tier ${dTier} (Target)</div>
                  </div>
              </div>
              <hr>
              
              <div class="nq-row">
                  <label style="font-weight:bold;">Your Attack (d100)</label>
                  <div style="display:flex;">
                      <input type="number" id="atk-d100" class="nq-input" placeholder="0">
                      <a id="btn-roll-d100" class="nq-btn" title="Roll 1d100"><i class="fas fa-dice-d20"></i></a>
                  </div>
              </div>
              <div class="nq-row">
                  <label style="font-weight:bold;">Your Proficiency (${profFormula})</label>
                  <div style="display:flex;">
                      <input type="number" id="atk-rprof" class="nq-input" placeholder="0">
                      <a id="btn-roll-prof" class="nq-btn" title="Roll ${profFormula}"><i class="fas fa-dice-d6"></i></a>
                  </div>
              </div>
              
              <hr>
              
              <div class="nq-row">
                  <label style="font-weight:bold;">${target.name} Defense (d100)</label>
                  <div style="display:flex;">
                      <input type="number" id="def-d100" class="nq-input" placeholder="0">
                      <a id="btn-roll-def" class="nq-btn" title="Roll 1d100"><i class="fas fa-dice-d20"></i></a>
                  </div>
              </div>
              <div class="resource-row">
                  <label>${target.name} E_CUR</label>
                  <input type="number" id="def-ecur" value="${dEcur}" style="width: 60px; float: right; text-align: center;">
              </div>
              
              <div id="result-area" class="nq-result-box">
                  <div style="font-size: 1.4em; color: #8b0000; font-weight: bold;" id="dmg-display">0 Damage</div>
                  <div style="font-size: 0.8em; color: #555;" id="formula-display"></div>
                  
                  <button id="btn-post" style="width:100%; margin-top:10px; background:#8b0000; color:white; border:none; padding:8px; font-weight:bold;">
                      <i class="fas fa-skull"></i> CONFIRM DAMAGE TO ${target.name.toUpperCase()}
                  </button>
              </div>

              <div class="nq-actions">
                  <button id="btn-calculate" class="nq-main-btn"><i class="fas fa-calculator"></i> Calculate Outcome</button>
              </div>
          </div>
      </div>`;

      const d = new Dialog({
          title: `Contested: ${attacker.name} vs ${target.name}`,
          content: content,
          buttons: {}, 
          render: (html) => {
              const resetUI = () => { html.find("#result-area").slideUp(); };

              // Rolls
              html.find("#btn-roll-d100").click(async () => {
                  const r = new Roll("1d100"); await r.evaluate(); html.find("#atk-d100").val(r.total);
                  if(game.dice3d) game.dice3d.showForRoll(r); resetUI();
              });
              html.find("#btn-roll-prof").click(async () => {
                  if (aTier === 0) { html.find("#atk-rprof").val(0); return; }
                  const r = new Roll(profFormula); await r.evaluate(); html.find("#atk-rprof").val(r.total);
                  if(game.dice3d) game.dice3d.showForRoll(r); resetUI();
              });
              html.find("#btn-roll-def").click(async () => {
                  const r = new Roll("1d100"); await r.evaluate(); html.find("#def-d100").val(r.total);
                  if(game.dice3d) game.dice3d.showForRoll(r); resetUI();
              });

              // Calculate
              html.find("#btn-calculate").click((ev) => {
                  ev.preventDefault();
                  
                  const d100_A = Number(html.find("#atk-d100").val()) || 0;
                  const R_prof = Number(html.find("#atk-rprof").val()) || 0;
                  const d100_D = Number(html.find("#def-d100").val()) || 0;
                  const E_cur_D = Number(html.find("#def-ecur").val()) || 0;

                  const A_FP = 100 - (d100_A - R_prof);
                  const D_Margin = d100_D - E_cur_D;
                  const M_Defense = dTier * 5.5;
                  
                  // Tier Advantage Multiplier (M_DTA)
                  const diff = aTier - dTier;
                  let mult = 1.0;
                  if (diff === 1) mult = 1.25;
                  else if (diff === 2) mult = 1.50;
                  else if (diff >= 3) mult = 1.75; 
                  if (diff === -1) mult = 0.75;
                  else if (diff === -2) mult = 0.50;
                  else if (diff <= -3) mult = 0.25;

                  let raw = (A_FP - M_Defense + D_Margin + R_prof);
                  if (raw < 0) raw = 0;
                  const finalDmg = Math.floor(raw * mult);

                  // Update UI
                  html.find("#dmg-display").text(`${finalDmg} Damage`);
                  html.find("#formula-display").text(`Mult: x${mult} (Tier ${aTier} vs ${dTier})`);
                  html.find("#result-area").slideDown();
                  
                  // Store data for posting
                  html.find("#btn-post").data("result", {
                      d100_A, R_prof, d100_D, E_cur_D, finalDmg, mult, aTier, dTier
                  });
              });

              // Post Result to Chat
              html.find("#btn-post").click((ev) => {
                  ev.preventDefault();
                  const data = $(ev.currentTarget).data("result");
                  
                  const content = `
                  <div class="narequenta chat-card" data-defender-token-id="${targetTokenId}" data-damage="${data.finalDmg}">
                      <header class="card-header flexrow" style="border-bottom: 2px solid #333; margin-bottom: 5px;">
                          <img src="${attacker.img}" width="36" height="36" style="border:1px solid #333;"/>
                          <h3 class="item-name">vs ${target.name}</h3>
                      </header>
                      <div class="card-content" style="padding: 5px;">
                          <div style="display: flex; justify-content: space-between;">
                              <strong>${attacker.name}</strong> <span>Roll: ${data.d100_A} (Prof: ${data.R_prof})</span>
                          </div>
                          <div style="display: flex; justify-content: space-between;">
                              <strong>${target.name}</strong> <span>Roll: ${data.d100_D} (E_cur: ${data.E_cur_D})</span>
                          </div>
                          <hr>
                          <div style="font-size: 1.5em; text-align: center; font-weight: bold; margin: 10px 0; color: #8b0000;">
                              ${data.finalDmg} Damage
                          </div>
                          <div style="font-size: 0.8em; color: #555; text-align: center; margin-bottom:10px;">
                              Multiplier: x${data.mult} (Tier ${data.aTier} vs Tier ${data.dTier})
                          </div>
                          <div style="text-align:center;">
                              <button class="apply-damage-btn" style="background:#8b0000; color:white; width:90%;">
                                  <i class="fas fa-heart-broken"></i> Apply ${data.finalDmg} Damage to ${target.name}
                              </button>
                          </div>
                      </div>
                  </div>`;

                  ChatMessage.create({
                      speaker: ChatMessage.getSpeaker({ actor: attacker }),
                      content: content
                  });
                  d.close();
              });
          }
      });
      d.render(true);
  }

  /* -------------------------------------------- */
  /* ITEM & CALCULATOR HANDLERS                  */
  /* -------------------------------------------- */

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
      // Legacy Static Calculator (Kept for simple checks)
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
          // Calculate Proficiency Formula based on actor's highest tier (Action Surges Max) or Tier
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
      
      // Update the specific field in the actor's system data
      await this.actor.update({ [targetField]: roll.total });
  }
}