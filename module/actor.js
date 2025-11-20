import { EntitySheetHelper } from "./helper.js";

export class NarequentaActor extends Actor {

  /** @inheritdoc */
  prepareDerivedData() {
    super.prepareDerivedData();

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

    // 3. Handle Legacy Worldbuilding Logic
    this.system.groups = this.system.groups || {};
    this.system.attributes = this.system.attributes || {};
    EntitySheetHelper.clampResourceValues(this.system.attributes);
  }

  _prepareCharacterData() {
      const system = this.system;
      const essences = system.essences;

      // Double check to ensure essences exist before looping
      if (!essences) return;
      
      for (let [key, essence] of Object.entries(essences)) {
          // A. Enforce Hard Floor (50%)
          if (essence.max < 50) essence.max = 50;
          if (essence.max > 100) essence.max = 100;

          [cite_start]// B. Calculate Tier [cite: 260]
          let tier = 0;
          if (essence.max <= 50) tier = 5;      
          else if (essence.max <= 60) tier = 4; 
          else if (essence.max <= 70) tier = 3; 
          else if (essence.max <= 80) tier = 2; 
          else if (essence.max <= 90) tier = 1; 
          else tier = 0;                        

          [cite_start]// C. Derive Dice Pool [cite: 262]
          essence.tier = tier;
          essence.diceCount = (tier === 0) ? 0 : tier;
          essence.diceString = (tier > 0) ? `${tier}d10` : "0";
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