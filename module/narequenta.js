/**
 * Nárëquenta — Tales of the Waning
 * System Entry Point
 */

import { NarequentaActor } from "./actor.js";
import { SimpleItem } from "./item.js"; 
import { SimpleItemSheet } from "./item-sheet.js";
import { NarequentaActorSheet } from "./actor-sheet.js";
import { preloadHandlebarsTemplates } from "./templates.js";
import { createWorldbuildingMacro } from "./macro.js";
import { SimpleToken, SimpleTokenDocument } from "./token.js";

/* -------------------------------------------- */
/* Foundry VTT Initialization                   */
/* -------------------------------------------- */

Hooks.once("init", async function() {
  console.log(`Initializing Nárëquenta System`);

  CONFIG.Combat.initiative = {
    formula: "1d10",
    decimals: 2
  };

  game.narequenta = {
    NarequentaActor,
    createWorldbuildingMacro
  };

  CONFIG.Actor.documentClass = NarequentaActor;
  CONFIG.Item.documentClass = SimpleItem;
  CONFIG.Token.documentClass = SimpleTokenDocument;
  CONFIG.Token.objectClass = SimpleToken;

  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("narequenta", NarequentaActorSheet, { makeDefault: true });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("narequenta", SimpleItemSheet, { makeDefault: true });

  game.settings.register("narequenta", "macroShorthand", {
    name: "SETTINGS.SimpleMacroShorthandN",
    hint: "SETTINGS.SimpleMacroShorthandL",
    scope: "world",
    type: Boolean,
    default: true,
    config: true
  });

  game.settings.register("narequenta", "initFormula", {
    name: "SETTINGS.SimpleInitFormulaN",
    hint: "SETTINGS.SimpleInitFormulaL",
    scope: "world",
    type: String,
    default: "1d10",
    config: true,
    onChange: formula => _simpleUpdateInit(formula, true)
  });

  const initFormula = game.settings.get("narequenta", "initFormula");
  _simpleUpdateInit(initFormula);

  function _simpleUpdateInit(formula, notify = false) {
    const isValid = Roll.validate(formula);
    if ( !isValid ) {
      if ( notify ) ui.notifications.error(`${game.i18n.localize("NAREQUENTA.NotifyInitFormulaInvalid")}: ${formula}`);
      return;
    }
    CONFIG.Combat.initiative.formula = formula;
  }

  Handlebars.registerHelper('slugify', function(value) {
    return value.slugify({strict: true});
  });

  await preloadHandlebarsTemplates();
});

Hooks.on("hotbarDrop", (bar, data, slot) => createWorldbuildingMacro(data, slot));

/* -------------------------------------------- */
/* READY HOOK: BATCH RESOLUTION LISTENER        */
/* -------------------------------------------- */

Hooks.once("ready", () => {
    
    // Listen for the "EXECUTE BATCH" button
    $(document).on("click", ".execute-batch-resolution-btn", async (ev) => {
        ev.preventDefault();
        const btn = $(ev.currentTarget);
        
        // 1. Parse Payload
        let payload;
        try {
            payload = JSON.parse(btn.attr("data-payload")); // Use .attr to get raw string if .data auto-converts weirdly
        } catch (e) {
            console.error("Payload Parse Error", e);
            ui.notifications.error("Error reading resolution data.");
            return;
        }

        const { attackerUuid, essenceKey, attritionCost, targets } = payload;

        // 2. Apply Attrition (Attacker)
        let attackerDoc = await fromUuid(attackerUuid);
        if (attackerDoc && attackerDoc.actor) attackerDoc = attackerDoc.actor; // Handle Token UUID

        if (attackerDoc) {
            const currentVal = attackerDoc.system.essences[essenceKey].value;
            const newVal = Math.max(0, currentVal - attritionCost);
            await attackerDoc.update({ [`system.essences.${essenceKey}.value`]: newVal });
            ui.notifications.info(`${attackerDoc.name}: Attrition -${attritionCost}% applied.`);
        } else {
            ui.notifications.warn("Attacker not found for attrition.");
        }

        // 3. Apply Damage (Targets Loop)
        if (targets && targets.length > 0) {
            let dmgCount = 0;
            for (const tData of targets) {
                const token = canvas.tokens.get(tData.id);
                if (token && token.actor) {
                    const currentHP = Number(token.actor.system.resources.hp.value) || 0;
                    const newHP = Math.max(0, currentHP - tData.damage);
                    
                    await token.actor.update({ "system.resources.hp.value": newHP });
                    
                    // Death Check
                    if (newHP <= 0) {
                         const isDead = token.actor.effects.some(e => e.statusId === "dead" || (e.statuses && e.statuses.has("dead")));
                         if (!isDead) await token.actor.toggleStatusEffect("dead", { overlay: true });
                    }
                    dmgCount++;
                }
            }
            if (dmgCount > 0) ui.notifications.info(`Applied damage to ${dmgCount} target(s).`);
        }

        // 4. Disable Button
        btn.replaceWith(`<div style="background:#ccc; color:#333; text-align:center; font-weight:bold; padding:5px;">RESOLUTION COMPLETE</div>`);
    });
});
