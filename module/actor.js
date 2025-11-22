// Nárëquenta Contested Roll Calculator (v0.9) - CLEAN VERSION

// 1. VALIDATION
const attacker = canvas.tokens.controlled[0]?.actor;
const target = game.user.targets.first()?.actor;

if (!attacker) {
    ui.notifications.warn("❌ No Attacker Selected! Left-click your token first.");
    return;
}

<<<<<<< HEAD
if (!target) {
    ui.notifications.warn("❌ No Target! Right-click the enemy token.");
    return;
}

if (attacker === target) {
    ui.notifications.error("❌ You are targeting yourself! Right-click the enemy.");
    return;
}

// 2. DATA EXTRACTION: Attacker (PC)
let attackerTier = 0;
if (attacker.type === 'character') {
    if (attacker.system.essences) {
        for (let e of Object.values(attacker.system.essences)) {
            if (e.tier > attackerTier) attackerTier = e.tier;
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
>>>>>>> parent of 8d2ed83 (0.9.4)
        }
    }
} else {
    attackerTier = attacker.system.tier || 0;
}

const profFormula = attackerTier > 0 ? `${attackerTier}d10` : "0";

// 3. DATA EXTRACTION: Defender (NPC)
let defenderTier = target.system.tier || 0;
let defenderEcur = 0;

if (target.type === 'npc') {
    defenderEcur = target.system.focus_essence?.value || 0;
} else {
    // If targeting a PC, default to Vitalis
    defenderEcur = target.system.essences?.vitalis?.value || 0;
    defenderTier = 0;
    if (target.system.essences) {
        for (let e of Object.values(target.system.essences)) {
            if (e.tier > defenderTier) defenderTier = e.tier;
        }
    }
}

// 4. DIALOG UI
const dialogContent = `
<div class="narequenta">
    <style>
        .nq-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; }
        .nq-input { width: 60px; text-align: center; }
        .nq-btn { flex: 0 0 30px; height: 26px; line-height: 26px; margin-left: 5px; text-align: center; cursor: pointer; background: #ddd; border: 1px solid #999; border-radius: 3px; }
        .nq-btn:hover { background: #ccc; }
    </style>
    <div class="essence-grid-container">
        <div class="essence-header" style="grid-template-columns: 1fr 1fr; text-align: center;">
            <span style="color: #006400;">${attacker.name} (Tier ${attackerTier})</span>
            <span style="color: #8b0000;">${target.name} (Tier ${defenderTier})</span>
        </div>
        
        <hr>

        <div class="nq-row">
            <label style="font-weight:bold;">Attacker Roll (d100)</label>
            <div style="display:flex;">
                <input type="number" id="atk-d100" class="nq-input" placeholder="0">
                <a id="btn-roll-d100" class="nq-btn" title="Roll d100"><i class="fas fa-dice-d20"></i></a>
            </div>
        </div>
        
        <div class="nq-row">
            <label style="font-weight:bold;">Proficiency (${profFormula})</label>
            <div style="display:flex;">
                <input type="number" id="atk-rprof" class="nq-input" placeholder="0">
                <a id="btn-roll-prof" class="nq-btn" title="Roll ${profFormula}"><i class="fas fa-dice-d6"></i></a>
            </div>
        </div>

        <hr>
        
        <div class="nq-row">
            <label style="font-weight:bold;">Defender Roll (d100)</label>
            <div style="display:flex;">
                <input type="number" id="def-d100" class="nq-input" placeholder="0">
                <a id="btn-roll-def" class="nq-btn" title="Roll d100"><i class="fas fa-dice-d20"></i></a>
            </div>
        </div>
        <div class="resource-row">
            <label>Defender E_CUR (Auto)</label>
            <input type="number" id="def-ecur" value="${defenderEcur}" disabled style="width: 60px; float: right; text-align: center;">
        </div>
    </div>
    <p style="text-align:center; font-size: 0.8em; margin-top: 5px;">
        Rolls populate fields. Click Calculate to see damage.
    </p>
</div>
`;

new Dialog({
    title: `Contested: ${attacker.name} vs ${target.name}`,
    content: dialogContent,
    buttons: {
        calculate: {
            label: `<i class="fas fa-calculator"></i> Calculate Result`,
            callback: (html) => calculateDamage(html)
        }
    },
    render: (html) => {
        html.find("#btn-roll-d100").click(async () => {
            const roll = new Roll("1d100");
            await roll.evaluate();
            html.find("#atk-d100").val(roll.total);
            if (game.dice3d) game.dice3d.showForRoll(roll);
        });
        html.find("#btn-roll-prof").click(async () => {
            if (attackerTier === 0) {
                html.find("#atk-rprof").val(0);
                return;
            }
            const roll = new Roll(profFormula);
            await roll.evaluate();
            html.find("#atk-rprof").val(roll.total);
            if (game.dice3d) game.dice3d.showForRoll(roll);
        });
        html.find("#btn-roll-def").click(async () => {
            const roll = new Roll("1d100");
            await roll.evaluate();
            html.find("#def-d100").val(roll.total);
            if (game.dice3d) game.dice3d.showForRoll(roll);
        });
    },
    default: "calculate"
}).render(true);

function calculateDamage(html) {
    const d100_A = Number(html.find("#atk-d100").val()) || 0;
    const R_prof = Number(html.find("#atk-rprof").val()) || 0;
    const d100_D = Number(html.find("#def-d100").val()) || 0;
    const E_cur_D = Number(html.find("#def-ecur").val()) || 0;

    // A. A_FP = 100 - (d100 - R_prof)
    const A_FP = 100 - (d100_A - R_prof);

    // B. Defender Margin
    const D_Margin = d100_D - E_cur_D;

    // C. Mitigation
    const M_Defense = defenderTier * 5.5;

    // D. Tier Advantage
    const diff = attackerTier - defenderTier;
    let multiplier = 1.0;
    if (diff === 1) multiplier = 1.25;
    else if (diff === 2) multiplier = 1.50;
    else if (diff === 3) multiplier = 1.75;
    else if (diff >= 4) multiplier = 2.00;
    else if (diff === -1) multiplier = 0.75;
    else if (diff === -2) multiplier = 0.50;
    else if (diff <= -3) multiplier = 0.25;

    // E. Final Calculation
    let rawDamage = (A_FP - M_Defense + D_Margin + R_prof);
    if (rawDamage < 0) rawDamage = 0;
    
    const finalDamage = Math.floor(rawDamage * multiplier);

    // 6. CHAT OUTPUT
    const messageContent = `
    <div class="narequenta chat-card">
        <header class="card-header flexrow" style="border-bottom: 2px solid #333; margin-bottom: 5px;">
            <img src="${attacker.img}" width="36" height="36"/>
            <h3 class="item-name">Contested Result</h3>
        </header>
        <div class="card-content" style="padding: 5px;">
            <div style="display: flex; justify-content: space-between;">
                <strong>${attacker.name}</strong> <span>Roll: ${d100_A} (Prof: ${R_prof})</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <strong>${target.name}</strong> <span>Roll: ${d100_D} (E_cur: ${E_cur_D})</span>
            </div>
            <hr>
            <div style="font-size: 1.5em; text-align: center; font-weight: bold; margin: 10px 0; color: #8b0000;">
                ${finalDamage} Damage
            </div>
            <div style="font-size: 0.8em; color: #555; text-align: center;">
                Multiplier: x${multiplier} (Tier ${attackerTier} vs Tier ${defenderTier})
            </div>
        </div>
    </div>
    `;

    ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        content: messageContent
    });
}