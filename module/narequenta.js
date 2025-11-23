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

  CONFIG.Combat.initiative = {
    formula: "1d10",
    decimals: 2
  };

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

  Handlebars.registerHelper('slugify', function(value) {
    return value.slugify({strict: true});
  });

  await preloadHandlebarsTemplates();
});

Hooks.on("hotbarDrop", (bar, data, slot) => createWorldbuildingMacro(data, slot));

// --- NEW: GLOBAL LISTENER FOR CHAT BUTTONS (With Dead Status) ---
Hooks.once("ready", () => {
    $(document).on("click", ".apply-damage-btn", async (ev) => {
        ev.preventDefault();
        const btn = $(ev.currentTarget);
        // Read data directly from the button element
        const targetTokenId = btn.data("defender-token-id");
        const damage = parseInt(btn.data("damage"));

        const token = canvas.tokens.get(targetTokenId);
        if (!token || !token.actor) {
            ui.notifications.warn("Target token not found on current scene.");
            return;
        }

        // Check permissions (Players shouldn't delete/kill NPCs unless GM)
        if (!game.user.isGM && token.actor.type === "npc") {
             ui.notifications.warn("You do not have permission to update this Adversary. Ask the GM.");
             return;
        }

        const currentHP = Number(token.actor.system.resources.hp.value) || 0;
        const newHP = Math.max(0, currentHP - damage);

        await token.actor.update({ "system.resources.hp.value": newHP });

        // Apply Dead Status if HP hits 0
        if (newHP === 0 && currentHP > 0) {
            const effect = CONFIG.statusEffects.find(e => e.id === "dead")?.icon || "icons/svg/skull.svg";
            await token.toggleEffect(effect, { overlay: true, active: true });
        }

        ui.notifications.info(`Applied ${damage} damage to ${token.name}. HP: ${currentHP} -> ${newHP}`);
        
        // Visual feedback on button
        btn.replaceWith(`<div style="color: #8b0000; font-weight:bold; text-align:center;">Damage Applied</div>`);
    });
});