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

Hooks.once("ready", () => {
    $(document).on("click", ".apply-damage-btn", async (ev) => {
        ev.preventDefault();
        const btn = $(ev.currentTarget);
        const targetTokenId = btn.data("defender-token-id");
        const damage = parseInt(btn.data("damage"));
        const attackerUuid = btn.data("attacker-uuid");

        const token = canvas.tokens.get(targetTokenId);
        if (!token || !token.actor) {
            ui.notifications.warn("Target token not found on current scene.");
            return;
        }

        if (!game.user.isGM && token.actor.type === "npc") {
             ui.notifications.warn("You do not have permission to update this Adversary.");
             return;
        }

        const currentHP = Number(token.actor.system.resources.hp.value) || 0;
        const newHP = Math.max(0, currentHP - damage);
        await token.actor.update({ "system.resources.hp.value": newHP });

        if (newHP === 0 && currentHP > 0) {
            const isDead = token.actor.effects.some(e => e.statusId === "dead");
            if (!isDead) await token.actor.toggleStatusEffect("dead", { overlay: true });
        }

        ui.notifications.info(`Applied ${damage} damage to ${token.name}.`);
        btn.replaceWith(`<div style="color: #8b0000; font-weight:bold; text-align:center;">Damage Applied</div>`);

        if (attackerUuid) {
            const attacker = await fromUuid(attackerUuid);
            if (attacker) {
                await attacker.update({
                    "system.calculator.attack_roll": 0,
                    "system.calculator.prof_roll": 0,
                    "system.calculator.defense_roll": 0
                });
            }
        }
    });
});
