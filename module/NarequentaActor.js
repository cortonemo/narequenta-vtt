import { EntitySheetHelper } from "./helper.js";

export class NarequentaActor extends Actor {

  /** @inheritdoc */
  prepareDerivedData() {
    super.prepareDerivedData();

    // 1. Handle Nárëquenta Specific Logic (Essences)
    if (this.system.essences) {
        this._prepareEssenceData();
    }

    // 2. Handle Legacy Worldbuilding Logic (Optional dynamic attributes)
    // We keep this so if you add custom items/attributes later, they still work.
    this.system.groups = this.system.groups || {};
    this.system.attributes = this.system.attributes || {};
    EntitySheetHelper.clampResourceValues(this.system.attributes);
  }

  /**
   * Calculate Tiers, Dice Pools, and Enforce 50% Floor
   */
  _prepareEssenceData() {
      const essences = this.system.essences;
      
      for (let [key, essence] of Object.entries(essences)) {
          // A. Enforce Hard Floor (50%)
          // We modify the object in place so the sheet sees the corrected value
          if (essence.max < 50) essence.max = 50;
          if (essence.max > 100) essence.max = 100;

          [cite_start]// B. Calculate Tier based on Remaining E_max [cite: 260]
          let tier = 0;
          if (essence.max <= 50) tier = 5;      // Pinnacle
          else if (essence.max <= 60) tier = 4; // Tier IV
          else if (essence.max <= 70) tier = 3; // Tier III
          else if (essence.max <= 80) tier = 2; // Tier II
          else if (essence.max <= 90) tier = 1; // Tier I
          else tier = 0;                        // Tier 0

          [cite_start]// C. Derive Dice Pool [cite: 262]
          essence.tier = tier;
          essence.diceCount = (tier === 0) ? 0 : tier;
          essence.mitigation = (tier * 5.5); // Avg Mitigation
      }

      // D. Calculate Action Surges (Max = Highest Tier)
      if (this.system.resources && this.system.resources.action_surges) {
          let maxTier = 0;
          for (let [key, essence] of Object.entries(essences)) {
              if (essence.tier > maxTier) maxTier = essence.tier;
          }
          this.system.resources.action_surges.max = maxTier;
      }
  }

  /* -------------------------------------------- */
  /* Roll Data Preparation                       */
  /* -------------------------------------------- */

  /** @inheritdoc */
  getRollData() {
    const data = super.getRollData();
    const shorthand = game.settings.get("narequenta", "macroShorthand");

    // Add Essences to Roll Data so you can type @vitalis.value in macros
    if (data.essences) {
        for (let [key, essence] of Object.entries(data.essences)) {
            data[key] = essence; // Exposes @vitalis, @motus etc.
        }
    }

    return data;
  }

  /** @inheritdoc */
  async modifyTokenAttribute(attribute, value, isDelta = false, isBar = true) {
    // Standard handling for Essences (since they are structured {value, max})
    // Foundry Core handles value/max structure automatically, so we just pass it through
    // unless it's a legacy "Resource" type from worldbuilding.
    return super.modifyTokenAttribute(attribute, value, isDelta, isBar);
  }
}