import { EntitySheetHelper } from "./helper.js";

export class NarequentaActor extends Actor {

  /** @inheritdoc */
  prepareDerivedData() {
    super.prepareDerivedData();

    // SAFETY CHECK: If this actor doesn't have essences defined yet, stop.
    if (this.type === 'character' && !this.system.essences) return;
    if (this.type === 'npc' && !this.system.focus_essence) return;

    // 1. Handle Character Logic
    if (this.type === 'character') {
        this._prepareCharacterData();
    }
    
    // 2. Handle NPC Logic (New Automation)
    if (this.type === 'npc') {
        this._prepareNpcData();
    }

    // 3. Handle Legacy Worldbuilding Logic
    this.system.groups = this.system.groups || {};
    this.system.attributes = this.system.attributes || {};
    EntitySheetHelper.clampResourceValues(this.system.attributes);
  }

  _prepareCharacterData() {
      const system = this.system;
      const essences = system.essences;

      if (!essences) return;
      
      for (let [key, essence] of Object.entries(essences)) {
          // A. Enforce Hard Floor (50%)
          if (essence.max < 50) essence.max = 50;
          if (essence.max > 100) essence.max = 100;

          // B. Calculate Tier
          essence.tier = this._calculateTier(essence.max);

          // C. Derive Dice Pool
          const tier = essence.tier;
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

  _prepareNpcData() {
      const system = this.system;
      const focus = system.focus_essence;
      
      if (!focus) return;

      // A. Enforce Hard Floor for NPC
      if (focus.max < 50) focus.max = 50;
      if (focus.max > 100) focus.max = 100;

      // B. Auto-Calculate NPC Tier based on Focus Essence
      // This writes to system.tier so the sheet displays it automatically
      system.tier = this._calculateTier(focus.max);
  }

  /**
   * Shared Logic: Returns Tier (0-5) based on E_max value
   */
  _calculateTier(maxEssence) {
      if (maxEssence <= 50) return 5;      
      if (maxEssence <= 60) return 4; 
      if (maxEssence <= 70) return 3; 
      if (maxEssence <= 80) return 2; 
      if (maxEssence <= 90) return 1; 
      return 0;     
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