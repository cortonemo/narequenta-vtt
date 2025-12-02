# CHANGELOG
***
## [v0.9.75] — 2025-12-02 (Item Standardization & UI Hints)
**Status:** Beta - Content Polish & Math Sync

### 📦 Content & Items
- **Fixed:** Updated legacy Compendium Items (`Soul-Drain`, `Sense Scar`, `River-Reed Spear`, `Old Iron Blade`, `Buckler`) to use standard **Weight** values.
    - *Context:* These items previously had `null` weights or referenced the old `7 - R_prof` formula. They now adhere to the automated calculator logic (`Weight - R_prof/2`).
- **Changed:** Cleaned up item descriptions to remove obsolete math references, relying on the automated Chat Output for calculation details.

### 💻 Interface (UI)
- **Added:** Visual reminder **(Floor: 50%)** added to the Essence Grid header on the Character Sheet to reinforce the *Extinction of Essence* rule.
- **Added:** Placeholder text (`10/15/20`) added to the Item Sheet **Weight** input to guide users toward the standard Weight Classes (Light/Medium/Heavy).
- **Fixed:** System manifest (`system.json`) version bumped to `0.9.75` to ensure correct update tracking in Foundry VTT.
***
## [v0.9.74] — 2025-12-02 (Steel & Splinters Implementation)
**Status:** Beta - Equipment & Durability Mechanics

### ⚔️ Combat & Mitigation
- **Changed:** **Combat Formula:** Now utilizes **Total Mitigation ($\bar{M}_{Total}$)**, calculated as the sum of Reflex (Tier), Static (Armor), and Active Parry (Weapons).
- **Added:** **Parry Logic:** Weapons now provide a `defense_bonus`. This bonus is **automatically ignored** by the calculator if the Attack Range is greater than **5ft** (Ranged Attacks bypass Parry).
- **Added:** **Armor Logic:** Added `mitigation_bonus` to Armor items, which contributes to Static Defense.

### 💥 Weapon Integrity
- **Added:** **Integrity Stat:** Weapons now track `integrity.value` / `integrity.max`.
- **Added:** **Automatic Degradation:** If an Attack Roll results in a **Critical Failure (96-100)**, the system automatically reduces the active weapon's Integrity by 1 and posts a "Weapon Chipped" warning to chat.
- **Added:** **Broken State:** If a weapon reaches **0 Integrity**, its bonuses (Attack and Parry) are treated as 0 in calculations.

### 💻 Interface
- **Actor Sheet:** Added a **Defense ($\bar{M}$)** display to the header, showing the calculated total.
- **Item Sheet:** Added inputs for **Attack Bonus**, **Parry Bonus**, **Integrity**, and **Equipped** status to Weapon/Armor items.
***

## [v0.9.73] — 2025-12-01 (Manual Input Flexibility)
**Status:** Beta - User Experience & Dice Integrity

### ⚔️ Combat Flow
- **Changed:** **Quick Breath Dialog:** The EXECUTE button now opens a dialog with a manual input field. Players can choose to enter a physical dice result or leave it empty to auto-roll.
- **Fixed:** **AoE Defense Dialog:** When multiple targets are selected for an attack, the calculator now prompts a dialog allowing individual manual defense roll entry for each target (defaulting to random if unchanged).

### 🎯 Targeting
- **Fixed:** **Targeting Source:** Distance calculation now prioritizes the *currently selected token* to ensure range is measured from the actor's current board position, not their spawn point.
***

## [v0.9.72] — 2025-12-01 (Combat Flow & Configuration Polish)
**Status:** Beta - Interface & Flow Enhancement

### ⚔️ Combat Mechanics
- **Added:** **Minimum Attrition Rule:** All offensive actions now consume at least **5%** Active Vigor, regardless of Skill/Weight.
- **Added:** **Quick Breath Toggle:** Added a "Lungs" button to the Calculator.
- **Added:** **Action Surge Loop:** Upon completing an attack, Characters are prompted to spend a Surge to continue their turn.

### 🎯 Targeting & Logic
- **Added:** **Dynamic Faction Targeting:** The auto-select system now recognizes "Allies" and "Enemies" based on the Actor Type (PC vs NPC).
- **Added:** **Waning Configuration Dialog:** The "Trigger Waning Phase" button now opens a configuration table with Manual Input support.
***

## [v0.9.7] — 2025-12-01 (Tactical Flow & Weapon Nuance)
**Status:** Beta - Combat Depth & UI Refinement

### ⚔️ Combat Flow & Recovery
- **Added:** **Quick Breath Toggle:** Added a dedicated "Lungs" button to the Calculator.
    - Activating this prepares a recovery roll (Sum of $D_{prof}$) and disables standard targeting.
    - Executing a Quick Breath now **automatically enforces "End Turn"**.
- **Added:** **Action Surge Prompt:** When a Character completes an attack, the system now checks for available Action Surges.
    - If available, a dialog asks: "Spend Surge to Keep Turn?" or "End Turn?".
    - If no surges remain (or NPC), the turn ends automatically.

### 🛡️ Weapon Mechanics (Attrition/Margin Modifiers)
- **Added:** **Weapon Type Logic:** Implemented specific mechanical benefits based on weapon form, moving away from generic damage.
    - **Slashing (Force/Will):** Adds `+1d4` to the **Full Potential Margin ($A_{FP}$)** on a hit.
    - **Piercing (Precision):** Reduces **Attrition Cost** by `1` (ignoring the 1% Quality Essence tax).
    - **UI:** Added "Weapon Type" dropdown to the Item Sheet header.

### 💻 Interface Improvements
- **Changed:** **Targeting Display:** The Calculator now explicitly names the selected target(s) (e.g., "Orc Grunt, Goblin Sapper") instead of just counting them.
- **Fixed:** **Roll Reset:** Selecting a new target via the dialog now automatically resets the manual "Attack Roll" and "Defense Roll" inputs to `0` to prevent stale data.
***

## [v0.9.62] — 2025-11-30 (Detailed Output & Smart Targeting)
**Status:** Alpha - UX Enhancement

### ⚔️ Combat Calculator Enhancements
- **Detailed Chat Log:** The calculator now outputs a structured HTML table to the Chat Log upon processing. This table lists every specific target, their individual Defense Roll (randomized or manual), and the calculated Damage/Healing result.
- **Visual Clarity:** Results in the chat are color-coded (Red for Damage, Green for Healing) to match the sheet interface.

### 🎯 Targeting Improvements
- **Smart Auto-Select:** Updated the Targeting Dialog (`_onLaunchContest`). If an item is flagged as **AoE**, the system now automatically pre-selects valid tokens based on the action type:
    - **Healing:** Auto-selects Allies (PCs).
    - **Damage (Tier < 3):** Auto-selects All (Wild Magic safeguard).
    - **Damage (Tier ≥ 3):** Auto-selects Enemies (NPCs) (Mastery safeguard).

### 🐛 UI Fixes
- **Item Sheet Layout:** Increased the width of the **Range** input field to `60px` to prevent text cutting off when entering long distances (e.g., "120").
***