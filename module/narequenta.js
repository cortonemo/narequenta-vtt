/**
 * Nárëquenta — Tales of the Waning
 * System Entry Point
 */

// Import Modules
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

  // Default Initiative Formula
  CONFIG.Combat.initiative = {
    formula: "1d10",
    decimals: 2
  };

  // Assign Custom Classes
  game.narequenta = {
    NarequentaActor,
    createWorldbuildingMacro
  };

  // Define custom Document classes
  CONFIG.Actor.documentClass = NarequentaActor;
  CONFIG.Item.documentClass = SimpleItem;
  CONFIG.Token.documentClass = SimpleTokenDocument;
  CONFIG.Token.objectClass = SimpleToken;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("narequenta", NarequentaActorSheet, { makeDefault: true });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("narequenta", SimpleItemSheet, { makeDefault: true });

  // Register system settings
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

  // Handlebars Helper for Slugify
  Handlebars.registerHelper('slugify', function(value) {
    return value.slugify({strict: true});
  });

  await preloadHandlebarsTemplates();
});

// Macro Drop Hook
Hooks.on("hotbarDrop", (bar, data, slot) => createWorldbuildingMacro(data, slot));

/* -------------------------------------------- */
/* READY HOOK: GLOBAL LISTENERS                 */
/* -------------------------------------------- */

Hooks.once("ready", () => {
    
    // --- UNIFIED RESOLUTION LISTENER (Damage + Attrition) ---
    $(document).on("click", ".execute-resolution-btn", async (ev) => {
        ev.preventDefault();
        const btn = $(ev.currentTarget);
        
        // 1. DATA EXTRACTION
        const attackerId = btn.data("attacker-id");
        const essenceKey = btn.data("essence");
        const cost = parseInt(btn.data("cost")) || 0;
        
        const targetTokenId = btn.data("target-id");
        const damage = parseInt(btn.data("damage")) || 0;
        // Check if the attack was a Hit (bool)
        const isHit = btn.data("is-hit"); 

        // 2. ATTRITION APPLICATION (Attacker Side)
        const attacker = game.actors.get(attackerId);
        if (attacker) {
            const currentVal = attacker.system.essences[essenceKey].value;
            const newVal = Math.max(0, currentVal - cost);
            
            await attacker.update({ [`system.essences.${essenceKey}.value`]: newVal });
            
            ui.notifications.info(`ATTRITION: ${attacker.name} spent ${cost}% ${essenceKey}.`);
        } else {
            ui.notifications.warn("Original Attacker not found for Attrition.");
        }

        // 3. DAMAGE APPLICATION (Target Side)
        // Only apply if it was a HIT and we have a valid target
        if (isHit && targetTokenId) {
            const token = canvas.tokens.get(targetTokenId);
            
            if (token && token.actor) {
                // Determine current HP
                const currentHP = Number(token.actor.system.resources.hp.value) || 0;
                const newHP = Math.max(0, currentHP - damage);
                
                // Update HP
                await token.actor.update({ "system.resources.hp.value": newHP });
                
                // Check for Death (HP <= 0)
                if (newHP <= 0) {
                     const isDead = token.actor.effects.some(e => e.statusId === "dead" || (e.statuses && e.statuses.has("dead")));
                     
                     if (!isDead) {
                         await token.actor.toggleStatusEffect("dead", { overlay: true });
                         ChatMessage.create({ content: `<strong>${token.name}</strong> has been defeated!` });
                     }
                }
                ui.notifications.info(`DAMAGE: Applied ${damage} to ${token.name}.`);
            } else {
                ui.notifications.warn("Target token not found on scene.");
            }
        }
        
        // 4. DISABLE BUTTON (Visual Feedback)
        btn.replaceWith(`<div style="color:#333; font-weight:bold; text-align:center; background:#ccc; padding:5px; border-radius:3px;">RESOLUTION COMPLETE</div>`);
    });
});
