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

      // Define Helper for Logic
      const performWaning = async (html, dialogInstance) => {
          const focusKey = html.find("#focus-select").val();
          const updates = {};
          let chatOutput = "";
          
          for (const key of essenceKeys) {
              const isFocus = (key === focusKey);
              const manualInput = html.find(`#input-${key}`).val();
              let loss = 0;
              
              if (manualInput !== "" && Number(manualInput) > 0) {
                  loss = parseInt(manualInput);
              } else {
                  const formula = isFocus ? "2d6" : "1d6";
                  const r = new Roll(formula);
                  await r.evaluate();
                  loss = r.total;
                  if (game.dice3d) game.dice3d.showForRoll(r);
              }

              const currentMax = actor.system.essences[key].max;
              let newMax = currentMax - loss;
              if (newMax < 50) newMax = 50;

              updates[`system.essences.${key}.max`] = newMax;

              chatOutput += `
              <div style="display:flex; justify-content:space-between; font-size:0.9em; ${isFocus ? 'font-weight:bold; color:#006400;' : ''}">
                  <span>${essenceLabels[key]}:</span>
                  <span>-${loss}% (${newMax}%)</span>
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
      const calc = this.actor.system.calculator;
      
      const Attacker_d100 = Number(calc.attack_roll);
      const R_prof = Number(calc.prof_roll);
      const Defender_d100 = Number(calc.defense_roll);
      const Defender_Ecur = Number(calc.target_ecur);
      const Defender_Tier = Number(calc.target_tier);

      let Attacker_Tier = 0;
      if (this.actor.type === 'character') {
          for (let e of Object.values(this.actor.system.essences)) {
              if (e.tier > Attacker_Tier) Attacker_Tier = e.tier;
          }
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
      else if (diff >= 3) multiplier = 1.75; // Simplified
      else if (diff === -1) multiplier = 0.75;
      else if (diff === -2) multiplier = 0.50;
      else if (diff <= -3) multiplier = 0.25;

      const finalDamage = Math.floor(rawDamage * multiplier);
      const resultString = `Damage: ${finalDamage} (x${multiplier})`;
      
      await this.actor.update({"system.calculator.output": resultString});
  }
}