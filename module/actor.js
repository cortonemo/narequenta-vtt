import { EntitySheetHelper } from "./helper.js";

export class NarequentaActor extends Actor {

  /** @inheritdoc */
  prepareDerivedData() {
    super.prepareDerivedData();

    // SAFETY CHECK: Stop if essences don't exist (prevents crash on old data)
    if (!this.system.essences) return;

    // Unified Logic: Run calculation for BOTH 'character' and 'npc'
    this._prepareEssenceData();

    // Handle Legacy Worldbuilding Logic
    this.system.groups = this.system.groups || {};
    this.system.attributes = this.system.attributes || {};
    EntitySheetHelper.clampResourceValues(this.system.attributes);
  }

  _prepareEssenceData() {
      const system = this.system;
      const essences = system.essences;

      for (let [key, essence] of Object.entries(essences)) {
          // A. Enforce Hard Floor (50%)
          if (essence.max < 50) essence.max = 50;
          if (essence.max > 100) essence.max = 100;

          // B. Calculate Tier
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
      }

      // D. Calculate Action Surges (Characters Only - NPCs usually don't use this, but we calculate it anyway)
      if (system.resources && system.resources.action_surges) {
          let maxTier = 0;
          for (let [key, essence] of Object.entries(essences)) {
              if (essence.tier > maxTier) maxTier = essence.tier;
          }
          system.resources.action_surges.max = maxTier;
      }
  }

  getRollData() {
    const data = super.getRollData();
    if (data.essences) {
        for (let [key, essence] of Object.entries(data.essences)) {
            data[key] = essence; 
        }
    }
    return data;
  }
}