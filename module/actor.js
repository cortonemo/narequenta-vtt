import { EntitySheetHelper } from "./helper.js";

export class NarequentaActor extends Actor {

  /** @inheritdoc */
  prepareDerivedData() {
    super.prepareDerivedData();

    // Safety check to prevent crashes on actors without data
    if (!this.system.essences) return;

    // 1. Run Tier Calculation for EVERYONE (PC & NPC)
    this._prepareEssenceData();

    // 2. Legacy Worldbuilding Logic
    this.system.groups = this.system.groups || {};
    this.system.attributes = this.system.attributes || {};
    EntitySheetHelper.clampResourceValues(this.system.attributes);
  }

  _prepareEssenceData() {
      const system = this.system;
      const essences = system.essences || {};
      
      // Track highest tier found among essences
      let maxTier = 0;

      for (let [key, essence] of Object.entries(essences)) {
          // A. Enforce Hard Floor (50%)
          if (essence.max < 50) essence.max = 50;
          if (essence.max > 100) essence.max = 100;

          // B. Calculate Tier based on Remaining E_max
          let tier = 0;
          if (essence.max <= 50) tier = 5;      
          else if (essence.max <= 60) tier = 4; 
          else if (essence.max <= 70) tier = 3; 
          else if (essence.max <= 80) tier = 2;
          else if (essence.max <= 90) tier = 1; 
          else tier = 0;
          
          // C. Derive Dice Pool
          essence.tier = tier;
          essence.diceCount = (tier === 0) ? 0 : tier;
          essence.diceString = (tier > 0) ? `${tier}d10` : "0";
          essence.mitigation = (tier * 5.5); 
          
          // Update Max Tier Tracker
          if (tier > maxTier) maxTier = tier;
      }

      // D. ASSIGN GLOBAL TIER (Fixes NPC Proficiency)
      // For Characters, this drives Action Surges.
      if (this.type === "character") {
          if (system.resources?.action_surges) {
              system.resources.action_surges.max = maxTier;
          }
      }
      
      // For NPCs (and generic actors), we must set the system.tier 
      // so the calculator can read it easily.
      system.tier = maxTier;
  }

  /** @inheritdoc */
  async rollInitiative(createCombatants=true, context={}) {
    const parts = ["1d10"];
    // Tie-breaker: Sensus Tier as decimal
    if (this.system.essences?.sensus) {
        parts.push(String(this.system.essences.sensus.tier / 10));
    }
    const formula = parts.join("+") || "1d10";

    await new Roll(formula, this.getRollData()).toMessage({
        speaker: ChatMessage.getSpeaker({actor: this}),
        flavor: `Rolling Initiative`
    });

    await super.rollInitiative(createCombatants, { ...context, formula });
  }

  /** @inheritdoc */
  getRollData() {
    const data = { ...this.system };
    if (this.system.essences) {
        for (const [key, value] of Object.entries(this.system.essences)) {
            data[key] = value;
        }
    }
    return data;
  }
}