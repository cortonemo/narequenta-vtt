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
      
      // 1. Calculate Tier and Dice Pools
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

          // --- v0.9.3 ZONE CALCULATION ---
          const eCur = essence.value; 
          let zonePenalty = 0;
          let zoneLabel = "Peak"; // 100% - 76%

          if (eCur <= 25) { 
              zoneLabel = "Hollow"; 
              zonePenalty = -30; 
          } else if (eCur <= 50) { 
              zoneLabel = "Fading"; 
              zonePenalty = -20; 
          } else if (eCur <= 75) { 
              zoneLabel = "Waning"; 
              zonePenalty = -10; 
          }

          essence.zonePenalty = zonePenalty;
          essence.zoneLabel = zoneLabel;
      }

      // D. ASSIGN GLOBAL TIER
      if (this.type === "character") {
          if (system.resources?.action_surges) {
              system.resources.action_surges.max = maxTier;
          }
      }
      
      system.tier = maxTier;

      // --- v0.9.73 MITIGATION CALCULATION ---
      
      // 1. Reflex (Tier Base)
      const baseMitigation = maxTier * 5.5;

      // 2. Scan Equipment
      let staticBonus = 0; // Armor + Shields
      let parryBonus = 0;  // Weapons

      // Ensure items exist before scanning
      if (this.items) {
          for (const item of this.items) {
              const iSys = item.system;
              
              // Only count if equipped
              if (iSys.equipped) {
                  
                  // ARMOR: Adds to Static Mitigation
                  if (item.type === "armor") {
                      staticBonus += (Number(iSys.mitigation_bonus) || 0);
                  }
                  
                  // WEAPONS: Add to Parry (only if intact)
                  if (item.type === "weapon") {
                      // Integrity check: Broken weapons (0) provide NO bonuses
                      const integrity = iSys.integrity?.value ?? 3;
                      if (integrity > 0) {
                          parryBonus += (Number(iSys.defense_bonus) || 0);
                      }
                  }
              }
          }
      }

      // 3. Store in System for Sheet/Calculator access
      system.mitigation = {
          base: baseMitigation,
          static: staticBonus,
          parry: parryBonus,
          // Total assumes best case (Melee) for display purposes
          total: baseMitigation + staticBonus + parryBonus
      };
  }

  /** @inheritdoc */
  async rollInitiative(createCombatants=true, context={}) {
    const parts = ["1d20"];
    // Tie-breaker: Sensus Tier as decimal
    if (this.system.essences?.sensus) {
        parts.push(String(this.system.essences.sensus.tier / 10));
    }
    const formula = parts.join("+") || "1d20";

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
