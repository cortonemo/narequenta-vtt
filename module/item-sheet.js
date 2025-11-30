import { EntitySheetHelper } from "./helper.js";
import { ATTRIBUTE_TYPES } from "./constants.js";

/**
 * Extend the basic ItemSheet with modifications for Nárëquenta mechanics.
 * Handles safe data retrieval, default values for new items, and attribute management.
 * @extends {ItemSheet}
 */
export class SimpleItemSheet extends ItemSheet {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["narequenta", "sheet", "item"],
      // Point to the HTML template defined above
      template: "systems/narequenta/templates/item-sheet.html",
      width: 520,
      height: 480,
      // Define tabs: Description is default
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}],
      scrollY: [".attributes"],
    });
  }

  /** * Prepare data for rendering the Handlebars template.
   * @inheritdoc 
   */
  async getData(options) {
    // 1. Retrieve the context from the parent class
    const context = await super.getData(options);
    
    // 2. SAFE DATA RETRIEVAL
    // Use this.document.toObject(false) to get a plain JS object of the item data.
    // This allows us to modify 'sourceData' in memory before sending it to the HTML
    // without accidentally triggering database updates.
    const sourceData = this.document.toObject(false);
    
    // 3. INITIALIZE MISSING COLLECTIONS
    // If this is a brand new item, these objects might be undefined.
    // We initialize them to prevent crashes in EntitySheetHelper.
    if (!sourceData.system.attributes) sourceData.system.attributes = {};
    if (!sourceData.system.groups) sourceData.system.groups = {};
    
    // 4. SET DEFAULT VALUES (v0.9.6 Logic)
    // Ensure new items have valid defaults for calculation logic.
    
    // Default Weight: 15 (Medium Class) -> Formula: max(0, 15 - R_prof/2)
    if (typeof sourceData.system.weight === "undefined") sourceData.system.weight = 15;
    
    // Default Range: 5ft (Standard Melee)
    if (typeof sourceData.system.range === "undefined") sourceData.system.range = 5;
    
    // Default Cost Pair: Vitalis/Motus (Physical Action)
    if (!sourceData.system.cost) sourceData.system.cost = { motor: "vitalis", quality: "motus" };

    // 5. Pass data to Handlebars context
    context.systemData = sourceData.system;
    context.dtypes = ATTRIBUTE_TYPES;

    // 6. Essence Dropdown Options
    // Used in the 'Details' tab for selecting Motor/Quality pairs.
    context.systemData.essencesList = {
        "vitalis": "VITALIS (Force)",
        "motus": "MOTUS (Reflex)",
        "sensus": "SENSUS (Instinct)",
        "verbum": "VERBUM (Logic)",
        "anima": "ANIMA (Will)"
    };

    // 7. Text Editor Enrichment
    // Converts Foundry secrets, links, and formatting for the description.
    context.descriptionHTML = await TextEditor.enrichHTML(context.systemData.description, {
      secrets: this.document.isOwner,
      async: true
    });

    return context;
  }

  /** * Activate event listeners for interactivity.
   * @inheritdoc 
   */
  activateListeners(html) {
    super.activateListeners(html);
    // Exit if the sheet is locked (player viewing item they don't own)
    if ( !this.isEditable ) return;

    // Attribute Management (Legacy Worldbuilding features)
    // Handled by the Helper class to keep this file clean.
    html.find(".attributes").on("click", ".attribute-control", EntitySheetHelper.onClickAttributeControl.bind(this));
    html.find(".groups").on("click", ".group-control", EntitySheetHelper.onClickAttributeGroupControl.bind(this));
    
    // Draggable Attributes (for Macro creation)
    html.find(".attributes a.attribute-roll").each((i, a) => {
      a.setAttribute("draggable", true);
      a.addEventListener("dragstart", ev => {
        let dragData = ev.currentTarget.dataset;
        ev.dataTransfer.setData('text/plain', JSON.stringify(dragData));
      }, false);
    });
  }

  /** * Handle form submission updates.
   * @override 
   */
  _getSubmitData(updateData) {
    // Get default form data
    let formData = super._getSubmitData(updateData);
    
    // Process Attributes via Helper
    // This ensures custom attributes defined in the "Attributes" tab are saved correctly.
    formData = EntitySheetHelper.updateAttributes(formData, this.object);
    formData = EntitySheetHelper.updateGroups(formData, this.object);
    
    return formData;
  }
}