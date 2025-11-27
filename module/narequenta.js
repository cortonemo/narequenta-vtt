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
