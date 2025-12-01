import { EntitySheetHelper } from "./helper.js";
import { ATTRIBUTE_TYPES } from "./constants.js";

/**
 * Nárëquenta Item Sheet Class
 * Extends the basic Foundry ItemSheet to support specific mechanics:
 * - Weight-based Attrition
 * - Essence Pairing (Motor/Quality)
 * - Targeting Logic (AoE, Self, Resource Routing)
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
    // We use this.document.toObject(false) to get a plain JavaScript object of the item's data.
    // This allows us to modify 'sourceData' in memory before sending it to the HTML
    // without accidentally triggering database updates on the server.
    const sourceData = this.document.toObject(false);
    
    // 3. INITIALIZE MISSING COLLECTIONS
    // If this is a brand new item, these objects might be undefined in the database.
    // We initialize them to prevent crashes in the EntitySheetHelper or HTML loops.
    if (!sourceData.system.attributes) sourceData.system.attributes = {};
    if (!sourceData.system.groups) sourceData.system.groups = {};
    
    // 4. SET DEFAULT VALUES (v0.9.6 Logic)
    // These defaults ensure the Combat Calculator works even if the user hasn't edited the item yet.
    
    // Weight: Defaults to 15 (Medium Class).
    // Formula Reference: Attrition = max(0, Weight - floor(R_prof/2))
    if (typeof sourceData.system.weight === "undefined") sourceData.system.weight = 15;
    
    // Range: Defaults to 5ft (Standard Melee Square).
    if (typeof sourceData.system.range === "undefined") sourceData.system.range = 5;
    
    // Cost Pair: Defaults to Vitalis (Force) + Motus (Movement), the standard physical action.
    if (!sourceData.system.cost) sourceData.system.cost = { motor: "vitalis", quality: "motus" };

    // Target Type: Defaults to Single Target ("one"). Options: self, one, aoe.
    if (!sourceData.system.target_type) sourceData.system.target_type = "one";

    // Target Resource: Defaults to HP ("hp"). Options: hp, vitalis, motus, etc.
    // This determines where damage/healing is applied when the item is used.
    if (!sourceData.system.target_resource) sourceData.system.target_resource = "hp";

    // 5. Pass data to Handlebars context
    // 'systemData' is a shortcut for the template to access system fields easily.
    context.systemData = sourceData.system;
    context.dtypes = ATTRIBUTE_TYPES;

    // 6. Essence Dropdown Options
    // Used in the 'Details' tab for selecting Motor/Quality pairs.
    // Maps the internal key (vitalis) to the readable label (VITALIS (Force)).
    context.systemData.essencesList = {
        "vitalis": "VITALIS (Force)",
        "motus": "MOTUS (Reflex)",
        "sensus": "SENSUS (Instinct)",
        "verbum": "VERBUM (Logic)",
        "anima": "ANIMA (Will)"
    };

    // 7. Text Editor Enrichment
    // Converts Foundry secrets, entity links (@Actor[...]), and formatting for the description.
    context.descriptionHTML = await TextEditor.enrichHTML(context.systemData.description, {
      secrets: this.document.isOwner,
      async: true
    });

    return context;
  }

  /** * Activate event listeners for interactivity.
   * Handles clicks, drags, and inputs on the sheet.
   * @inheritdoc 
   */
  activateListeners(html) {
    super.activateListeners(html);
    
    // Exit immediately if the sheet is locked (e.g., player viewing an item they don't own)
    if ( !this.isEditable ) return;

    // Attribute Management (Legacy Worldbuilding features)
    // These listeners handle the "Attributes" tab (Add/Delete custom stats).
    // The logic is offloaded to the Helper class to keep this file clean.
    html.find(".attributes").on("click", ".attribute-control", EntitySheetHelper.onClickAttributeControl.bind(this));
    html.find(".groups").on("click", ".group-control", EntitySheetHelper.onClickAttributeGroupControl.bind(this));
    
    // Draggable Attributes
    // Allows players to drag a custom attribute to the Macro Bar to create a roll macro.
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
    // 1. Get the standard form data (inputs)
    let formData = super._getSubmitData(updateData);
    
    // 2. Process Custom Attributes via Helper
    // This ensures that any custom attributes defined in the "Attributes" tab 
    // are correctly structured and saved into the system.attributes object.
    formData = EntitySheetHelper.updateAttributes(formData, this.object);
    formData = EntitySheetHelper.updateGroups(formData, this.object);
    
    return formData;
  }
}