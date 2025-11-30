## Version 0.9.0

- This is the initial version of the Nárëquenta system.
- The core description states the game is about **Beautiful Erosion**, where heroes fade and **Proficiency Compensates for Decline**.
- Defines basic actor types (`character`, `npc`) and items (`base`, `ability`, `equipment`, `weapon`).
- The `system.json` is configured with Foundry VTT URLs and licensed under `LICENSE.md`.

## Version 0.9.1

- No major mechanical or structural changes noted compared to 0.9.0.
- Note: internal label in the file was "0.9.1", which matches the canonical filename version.

## Version 0.9.2

- No major mechanical or structural changes noted compared to 0.9.1.
- Note: internal label in the file was "0.9.1", but filename is treated as canonical.

## Version 0.9.3

- No major mechanical or structural changes noted compared to 0.9.2.
- Note: internal label in the file was "0.9.1", but filename is treated as canonical.

## Version 0.9.4

- **New Essence Added:** The `ANIMA` essence is now included and displayed on the character sheet template, alongside Vitalis, Motus, Sensus, and Verbum.
- The sheet template for characters displays all five essences (`VITALIS`, `MOTUS`, `SENSUS`, `VERBUM`, `ANIMA`).
- Note: internal label in the file was "0.9.3", but filename is treated as canonical.

## Version 0.9.5

- No major structural changes noted compared to 0.9.4.
- Note: internal label in the file was "0.9.4", but filename is treated as canonical.

## Version 0.9.6

- No major structural changes noted compared to 0.9.5.
- Note: internal label in the file was "0.9.4", but filename is treated as canonical.

## Version 0.9.7

- **Sheet Restructure:** The Essence Grid display moved from being conditional (`{{#if (eq actor.type "character")}}`) to a **"UNIFIED ESSENCE GRID (PC & NPC)"** section.
- **Code Change:** Data access paths within the character sheet templates were generally updated from `{{system.essences...}}` (0.9.6) to `{{systemData.essences...}}`.
- Note: internal label in the file was "0.9.7", which matches the canonical filename version.

## Version 0.9.8

- No major structural changes noted compared to 0.9.7.
- Note: internal label in the file was "0.9.7", but filename is treated as canonical.

## Version 0.9.9

- No major structural changes noted compared to 0.9.8.
- Note: internal label in the file was "0.9.7", but filename is treated as canonical.

## Version 0.9.10

- **System Metadata:** The `system.json` file was significantly updated to include `authors`, `esmodules`, `styles`, `packs`, and `languages` arrays for better Foundry VTT integration.
- **Token Configuration:** Added `primaryTokenAttribute` (`resources.hp`) and `secondaryTokenAttribute` (`resources.action_surges`) parameters for token bars.
- **Compatibility:** Declared compatibility with Foundry VTT versions minimum "11" and verified "13".
- Note: internal label in the file was "0.9.10", which matches the canonical filename version.

## Version 0.9.11

- No major structural changes noted compared to 0.9.10.
- Note: internal label in the file was "0.9.10", but filename is treated as canonical.

## Version 0.9.12

- **New UI Tab:** A new "Calc" tab is added to the sheet navigation, indicating the introduction of an Interactive Resolution Calculator tool.
- **Item Mechanics Added:** Item sheets now include dropdowns for defining **Motor (E_P)** and **Quality (E_S)** essences for calculating item cost, applicable only if a cost is defined (Ability/Weapon).
- Note: internal label in the file was "v.9.12", but filename is treated as canonical.

## Version 0.9.13

- No major structural changes noted compared to 0.9.12.
- Note: internal label in the file was "v.9.12", but filename is treated as canonical.

## Version 0.9.14

- No major structural changes noted compared to 0.9.13.
- Note: internal label in the file was "v.9.12", but filename is treated as canonical.

## Version 0.9.15

- **Waning Mechanics UI:** Added a **"Trigger Waning Phase"** button visible only to PCs, integrating the key system decay mechanic.
- **New Tab Content:** The CALCULATOR TAB structure is displayed, including input fields for "My Roll (d100)", "Enemy Roll (d100)", "Enemy E_CUR", and "Enemy Tier (0-5)" for interactive resolution.
- **License Update:** The excerpts now include the specific Nárëquenta Limited Open License (v0.1) text.
- Note: internal label in the file was "v.9.15" or the earlier "v.9.12", but filename is treated as canonical.

## Version 0.9.16

- No major structural changes noted compared to 0.9.15.
- Note: internal label in the file was "v.9.12", but filename is treated as canonical.

## Version 0.9.17

- No major structural changes noted compared to 0.9.16.
- Note: internal label in the file was "v.9.12", but filename is treated as canonical.

## Version 0.9.18

- No major structural changes noted compared to 0.9.17.
- Note: internal label in the file was "v0.9.17" or "v.9.12", but filename is treated as canonical.

## Version 0.9.19 – not committed because of a small error.

## Version 0.9.20

- **Waning Phase UI Refinement:** The Waning process is now housed within a **"WANING SECTION (Toggle + Button)"**, introducing an "Enable Waning Phase" toggle option.
- Internal code comments reiterate the Core Axiom of **Proficiency Compensates for Decline**, and detail the Waning Roll mechanics: **Focus (2d6)** vs **Universal (1d6)** decay, including the **Tier I Guarantee** logic.
- Note: internal label in the file was "v0.9.19" or "v.9.12", but filename is treated as canonical.

## Version 0.9.21

- No major structural changes noted compared to 0.9.20.
- Note: internal label in the file was "v0.9.21", which matches the canonical filename version.

## Version 0.9.22

- **Waning Logic Implemented:** Code snippets now show the active implementation of the Waning process, including calculation of **loss percentage** (`${loss}%`) and communication via a chat message that details the _Focus_ and the percentage loss applied.
- Note: internal label in the file was "v0.9.22", which matches the canonical filename version.

## Version 0.9.23

- No major structural changes noted compared to 0.9.22.
- Note: internal label in the file was "v.9.12", but filename is treated as canonical.

## Version 0.9.24

- No major structural changes noted compared to 0.9.23.
- Note: internal label in the file was "v0.9.24", which matches the canonical filename version.

## Version 0.9.25

- No major structural changes noted compared to 0.9.24.
- Note: internal label in the file was "v0.9.25", which matches the canonical filename version.

## Version 0.9.26

- No major structural changes noted compared to 0.9.25.
- Note: internal label in the file was "v0.9.26", which matches the canonical filename version.

## Version 0.9.27

- **Metadata Clarification:** The author's email address in `system.json` was updated from `@proton.me` to `@gmail.com`.
- Note: internal label in the file was "v0.9.27", which matches the canonical filename version.

## Version 0.9.28

- No major structural changes noted compared to 0.9.27.
- Note: internal label in the file was "v0.9.28", which matches the canonical filename version.

## Version 0.9.29 – not committed because of a small error.

## Version 0.9.30

- No major structural changes noted compared to 0.9.28.
- Note: internal label in the file was "v0.9.30", which matches the canonical filename version.

## Version 0.9.31

- **Localization Updates:** Added new Portuguese (pt.json) localization strings for core prompts, including warnings for invalid attribute keys (`NAREQUENTA.NotifyAttrInvalid`) and confirmation prompts for deleting groups.
- Note: internal label in the file was "v0.9.31", which matches the canonical filename version.

## Version 0.9.32

- No major structural changes noted compared to 0.9.31.
- Note: internal label in the file was "v0.9.28" or "v0.9.31", but filename is treated as canonical.

## Version 0.9.33

- No major structural changes noted compared to 0.9.32.
- Note: internal label in the file was "v0.9.28", but filename is treated as canonical.

## Version 0.9.34

- No major structural changes noted compared to 0.9.33.
- Note: internal label in the file was "v0.9.28", but filename is treated as canonical.

## Version 0.9.35

- No major structural changes noted compared to 0.9.34.
- Note: internal label in the file was "v0.9.28", but filename is treated as canonical.

## Version 0.9.36

- No major structural changes noted compared to 0.9.35.
- Note: internal label in the file was "v0.9.28", but filename is treated as canonical.

## Version 0.9.37

- No major structural changes noted compared to 0.9.36.
- Note: internal label in the file was "v0.9.28", but filename is treated as canonical.

## Version 0.9.38

- No major structural changes noted compared to 0.9.37.
- Note: internal label in the file was "v0.9.28", but filename is treated as canonical.

## Version 0.9.39 – not committed because of a small error.

## Version 0.9.40

- **Client Registration:** Added explicit registration of custom sheet classes for both Actors (`NarequentaActorSheet`) and Items (`SimpleItemSheet`) to Foundry VTT's configuration settings.
- Note: internal label in the file was "v0.9.39", but filename is treated as canonical.

## Version 0.9.41

- No major structural changes noted compared to 0.9.40.
- Note: internal label in the file was "v0.9.39", but filename is treated as canonical.

## Version 0.9.42

- **Template Change:** Added the `equipped_item_id` string field to the character template within `template.json`.
- Note: internal label in the file was "v0.9.42", which matches the canonical filename version.

## Version 0.9.43

- No major structural changes noted compared to 0.9.42.
- Note: internal label in the file was "v0.9.42", but filename is treated as canonical.

## Version 0.9.44

- No major structural changes noted compared to 0.9.43.
- Note: internal label in the file was "v0.9.42", but filename is treated as canonical.

## Version 0.9.45

- **New Item Mechanic: Weight Class:** Item sheets now include a **Weight Class** dropdown menu for items (Light - 10% Cost, Medium - 15% Cost, Heavy - 20% Cost), introducing a new mechanical parameter for item cost calculation.
- Note: internal label in the file was "v0.9.44", but filename is treated as canonical.

## Version 0.9.46

- No major structural changes noted compared to 0.9.45.
- Note: internal label in the file was "v0.9.44", but filename is treated as canonical.

## Version 0.9.47

- No major structural changes noted compared to 0.9.46.
- Note: internal label in the file was "v0.9.47", which matches the canonical filename version.

## Version 0.9.48

- No major structural changes noted compared to 0.9.47.
- Note: internal label in the file was "v0.9.48", which matches the canonical filename version.

## Version 0.9.49

- No major structural changes noted compared to 0.9.48.
- Note: internal label in the file was "v0.9.48", but filename is treated as canonical.

## Version 0.9.50

- No major structural changes noted compared to 0.9.49.
- Note: internal label in the file was "v0.9.50", which matches the canonical filename version.

## Version 0.9.51

- **Client Initialization:** The initialization code confirms setting the combat initiative formula (`1d10`, 2 decimals) and assigns custom classes for Actors, Items, and Tokens.
- Note: internal label in the file was "v0.9.51", which matches the canonical filename version.

## Version 0.9.52 – not committed because of a small error.

## Version 0.9.53

- **Weapon Template Update:** The `weapon` item type now includes a default `range` value of `2` in `template.json`.
- **UI Update:** The character sheet header section is refined to explicitly display the **Essence Current Value / HP** line.
- **New Damage Section:** A new sheet section labeled "APPLY DAMAGE & ATTRITION" is introduced, likely for immediate interaction with health/essence values.
- Note: internal label in the file was "v0.9.53", which matches the canonical filename version.

## Version 0.9.54

- No major structural changes noted compared to 0.9.53.
- Note: internal label in the file was "v0.9.54", which matches the canonical filename version.

## Version 0.9.55

- No major structural changes noted compared to 0.9.54.
- Note: internal label in the file was "v0.9.54", but filename is treated as canonical.

## Version 0.9.56

- **Recovery Mechanics Implemented:** Added full logic for **Short Rest (Refocus)** and **Long Rest (Renewal)** buttons in `actor-sheet.js`.
- **Refocus (Short Rest):** Opens a dialog to roll varying recovery dice (e.g., 1d6 for Quick Breath, 4d10 for Deep Meditation) and restores Essence/HP.
- **Renewal (Long Rest):** Resets all Essences and HP to their current Maximums, resets Action Surges (for PCs), and clears targeting data.
- **Manual Damage Handler:** Implemented the `_onApplySheetDamage` helper to allow direct manual adjustments to HP or Essence pools via a dialog.