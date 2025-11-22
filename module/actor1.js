import { EntitySheetHelper } from "./helper.js";

export class NarequentaActor extends Actor {

  /** @inheritdoc */
  prepareDerivedData() {
    super.prepareDerivedData();

<<<<<<< HEAD
    if (!this.system.essences && this.type === 'character') return;

    // Unified Logic
    this._prepareEssenceData();
=======
    // SAFETY CHECK: If this actor doesn't have essences defined yet, stop.
    // This prevents the "White Sheet" crash on new/old actors.
    if (!this.system.essences && this.type === 'character') return;

    // 1. Handle Nárëquenta Specific Logic (Essences)
    if (this.type === 'character') {
        this._prepareCharacterData();
    }
    
    // 2. Handle NPC Logic
    if (this.type === 'npc') {
        // NPC logic (if any)
    }
>>>>>>> parent of 8d2ed83 (0.9.4)

    // Legacy Worldbuilding
    this.system.groups = this.system.groups || {};
    this.system.attributes = this.system.attributes || {};
    EntitySheetHelper.clampResourceValues(this.system.attributes);
  }

  _prepareEssenceData() {
      const system = this.system;
      // Safely check if essences exist before iterating
      const essences = system.essences || {};

<<<<<<< HEAD
=======
      // Double check to ensure essences exist before looping
      if (!essences) return;
      
>>>>>>> parent of 8d2ed83 (0.9.4)
      for (let [key, essence] of Object.entries(essences)) {
          // A. Enforce Hard Floor (50%)
          [cite_start]if (essence.max < 50) essence.max = 50; [cite: 23]
          if (essence.max > 100) essence.max = 100;

<<<<<<< HEAD
          // B. Calculate Tier based on Remaining E_max
=======
          [cite_start]// B. Calculate Tier [cite: 260]
>>>>>>> parent of 8d2ed83 (0.9.4)
          let tier = 0;
          if (essence.max <= 50) tier = 5;      
          else if (essence.max <= 60) tier = 4; 
          else if (essence.max <= 70) tier = 3; 
          else if (essence.max <= 80) tier = 2; 
          else if (essence.max <= 90) tier = 1; 
          else tier = 0;                        

<<<<<<< HEAD
          // C. Derive Dice Pool
=======
          [cite_start]// C. Derive Dice Pool [cite: 262]
>>>>>>> parent of 8d2ed83 (0.9.4)
          essence.tier = tier;
          essence.diceCount = (tier === 0) ? 0 : tier;
          essence.diceString = (tier > 0) ? [cite_start]`${tier}d10` : "0"; [cite: 263]
          essence.mitigation = (tier * 5.5); 
      }

      // D. Calculate Action Surges
      if (system.resources && system.resources.action_surges) {
          let maxTier = 0;
          for (let [key, essence] of Object.entries(essences)) {
              if (essence.tier > maxTier) maxTier = essence.tier;
          }
          system.resources.action_surges.max = maxTier;
      }
  }

<<<<<<< HEAD
  /* -------------------------------------------- */
  /* New Snippet 1: Initiative Logic             */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async rollInitiative(createCombatants=true, context={}) {
    // 1. Define the Nárëquenta Initiative Formula
    // Default: 1d10 + Sensus Tier (as a tie-breaker decimal)
    const parts = ["1d10"];
    
    // Check if we can add Sensus Tier as a tie-breaker
    // (e.g., Roll 8 + Tier 3 = 8.3)
    if (this.system.essences?.sensus) {
        parts.push(String(this.system.essences.sensus.tier / 10));
    }
    
    // 2. Construct the Formula
    const formula = parts.join("+") || "1d10";

    // 3. Roll it
    const roll = await new Roll(formula, this.getRollData()).evaluate();
    
    // 4. Send to Chat
    await roll.toMessage({
        speaker: ChatMessage.getSpeaker({actor: this}),
        flavor: `Rolling Initiative (Sensus Tier Tie-Breaker)`
    });

    // 5. Pass to the Combat Tracker
    await super.rollInitiative(createCombatants, {
        ...context,
        formula: formula
    });
  }

  /* -------------------------------------------- */
  /* New Snippet 2: Updated Roll Data            */
  /* -------------------------------------------- */

  /** @inheritdoc */
=======
>>>>>>> parent of 8d2ed83 (0.9.4)
  getRollData() {
    // 1. Start with the system data (hp, essences, etc.)
    const data = { ...this.system };

    // 2. Add Essences as top-level shortcuts
    // Allows @vitalis instead of @essences.vitalis
    if (this.system.essences) {
        for (const [key, value] of Object.entries(this.system.essences)) {
            data[key] = value;
        }
    }
    
    // 3. Add NPC Focus shortcut (Safety check)
    if (this.system.focus_essence) {
        data.focus = this.system.focus_essence;
    }

    return data;
  }
}