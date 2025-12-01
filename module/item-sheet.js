import { EntitySheetHelper } from "./helper.js";
import { ATTRIBUTE_TYPES } from "./constants.js";

/**
 * Nárëquenta Item Sheet Class
 * Extends the basic Foundry ItemSheet to support specific mechanics:
 * - Weight-based Attrition
 * - Essence Pairing (Motor/Quality)
 * - Targeting Logic (AoE, Self, Resource Routing)
 * - [v0.9.7] Weapon Types
 * @extends {ItemSheet}
 */
export class SimpleItemSheet extends ItemSheet {

  /** * Define default configuration options for the sheet.
   * @inheritdoc 
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["narequenta", "sheet", "item"],
      // Point to the specific HTML template for items
      template: "systems/narequenta/templates/item-sheet.html",
      width: 520,
      height: 480,
      // Define navigation tabs. Default opens to 'Description'.
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}],
      // Allow scrolling in the attributes tab
      scrollY: [".attributes"],
    });
  }

  /** * Prepare data for rendering the Handlebars template.
   * This is where we inject default values and dropdown options.
   * @inheritdoc 
   */
  async getData(options) {
    // 1. Retrieve the standard context from the parent class
    const context = await super.getData(options);
    
    // 2. SAFE DATA RETRIEVAL
    const sourceData = this.document.toObject(false);
    
    // 3. INITIALIZE MISSING COLLECTIONS
    if (!sourceData.system.attributes) sourceData.system.attributes = {};
    if (!sourceData.system.groups) sourceData.system.groups = {};
    
    // 4. SET DEFAULT VALUES
    // Weight: Defaults to 15 (Medium Class).
    if (typeof sourceData.system.weight === "undefined") sourceData.system.weight = 15;
    
    // Range: Defaults to 5ft (Standard Melee Square).
    if (typeof sourceData.system.range === "undefined") sourceData.system.range = 5;
    
    // Cost Pair: Defaults to Vitalis + Motus
    if (!sourceData.system.cost) sourceData.system.cost = { motor: "vitalis", quality: "motus" };

    // Target Type: Defaults to Single Target ("one")
    if (!sourceData.system.target_type) sourceData.system.target_type = "one";

    // Target Resource: Defaults to HP
    if (!sourceData.system.target_resource) sourceData.system.target_resource = "hp";

    // [v0.9.7] Weapon Type Default
    if (!sourceData.system.weapon_type) sourceData.system.weapon_type = "none";

    // 5. Pass data to Handlebars context
    context.systemData = sourceData.system;
    context.dtypes = ATTRIBUTE_TYPES;

    // 6. Essence Dropdown Options
    context.systemData.essencesList = {
        "vitalis": "VITALIS (Force)",
        "motus": "MOTUS (Reflex)",
        "sensus": "SENSUS (Instinct)",
        "verbum": "VERBUM (Logic)",
        "anima": "ANIMA (Will)"
    };

    // [v0.9.7] Weapon Types for Dropdown
    context.systemData.weaponTypes = {
        "none": "None / Generic",
        "slashing": "Slashing (Force & Will)",       // +1d4 to A_FP
        "piercing": "Piercing (Precision)",          // Ignore 1% Attrition
        "bludgeoning": "Bludgeoning (Endurance)",    // Crit Effects
        "ranged": "Ranged (Finesse)",                // Target specific stats
        "unarmed": "Unarmed"
    };

    // 7. Text Editor Enrichment
    context.descriptionHTML = await TextEditor.enrichHTML(context.systemData.description, {
      secrets: this.document.isOwner,
      async: true
    });

    return context;
  } // <--- THIS WAS MISSING IN YOUR CODE

  /** * Activate event listeners for interactivity.
   * Handles clicks, drags, and inputs on the sheet.
   * @inheritdoc 
   */
  activateListeners(html) {
    super.activateListeners(html);
    
    if ( !this.isEditable ) return;

    // Attribute Management (Legacy)
    html.find(".attributes").on("click", ".attribute-control", EntitySheetHelper.onClickAttributeControl.bind(this));
    html.find(".groups").on("click", ".group-control", EntitySheetHelper.onClickAttributeGroupControl.bind(this));
    
    // Draggable Attributes
    html.find(".attributes a.attribute-roll").each((i, a) => {
      a.setAttribute("draggable", true);
      a.addEventListener("dragstart", ev => {
        let dragData = ev.currentTarget.dataset;
        ev.dataTransfer.setData('text/plain', JSON.stringify(dragData));
      }, false);
    });
  }

  /** * Handle form submission updates.
   * This function runs before the data is saved to the database.
   * @override 
   */
  _getSubmitData(updateData) {
    let formData = super._getSubmitData(updateData);
    // Process Custom Attributes via Helper
    formData = EntitySheetHelper.updateAttributes(formData, this.object);
    formData = EntitySheetHelper.updateGroups(formData, this.object);
    
    return formData;
  }
}