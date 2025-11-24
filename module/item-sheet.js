import { EntitySheetHelper } from "./helper.js";
import {ATTRIBUTE_TYPES} from "./constants.js";

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class SimpleItemSheet extends ItemSheet {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["narequenta", "sheet", "item"], // Changed from worldbuilding
      template: "systems/narequenta/templates/item-sheet.html", // Changed path
      width: 520,
      height: 480,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}],
      scrollY: [".attributes"],
    });
  }

  /* -------------------------------------------- */

/** @inheritdoc */
async getData(options) {
  // 1. Retrieve the context from the parent class
  const context = await super.getData(options);

  // 2. SAFE DATA RETRIEVAL (The Fix)
  // Foundry V10+ splits data. We grab the plain object to ensure we can edit it.
  const sourceData = context.data || this.document.toObject(false);

  // 3. INITIALIZE MISSING COLLECTIONS (Prevents the crash)
  // If this is a new item, these might be undefined, crashing the Helper.
  if (!sourceData.system.attributes) sourceData.system.attributes = {};
  if (!sourceData.system.groups) sourceData.system.groups = {};

  // 4. Process Attributes using the Helper
  EntitySheetHelper.getAttributeData(sourceData);
  
  // 5. Assign processed data to context for the HTML to use
  context.systemData = sourceData.system;
  context.dtypes = ATTRIBUTE_TYPES;
  
  // 6. Essence Options for the Dropdown
  context.systemData.essencesList = {
      "vitalis": "NAREQUENTA.Vitalis",
      "motus": "NAREQUENTA.Motus",
      "sensus": "NAREQUENTA.Sensus",
      "verbum": "NAREQUENTA.Verbum",
      "anima": "NAREQUENTA.Anima"
  };

  // 7. Resolve Actor Data for Descriptions (The SWP Feature)
  // We use 'this.document.actor' which is the safe V10+ way to get the parent.
  const actor = this.document.actor;
  const rollData = actor ? actor.getRollData() : {};

  // 8. Enrich the HTML
  context.descriptionHTML = await TextEditor.enrichHTML(context.systemData.description, {
    secrets: this.document.isOwner,
    rollData: rollData,
    async: true
  });

  return context;
}

  /* -------------------------------------------- */

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if ( !this.isEditable ) return;

    // Attribute Management
    html.find(".attributes").on("click", ".attribute-control", EntitySheetHelper.onClickAttributeControl.bind(this));
    html.find(".groups").on("click", ".group-control", EntitySheetHelper.onClickAttributeGroupControl.bind(this));
    html.find(".attributes").on("click", "a.attribute-roll", EntitySheetHelper.onAttributeRoll.bind(this));

    // Add draggable for Macro creation
    html.find(".attributes a.attribute-roll").each((i, a) => {
      a.setAttribute("draggable", true);
      a.addEventListener("dragstart", ev => {
        let dragData = ev.currentTarget.dataset;
        ev.dataTransfer.setData('text/plain', JSON.stringify(dragData));
      }, false);
    });
  }

  /* -------------------------------------------- */

  /** @override */
  _getSubmitData(updateData) {
    let formData = super._getSubmitData(updateData);
    formData = EntitySheetHelper.updateAttributes(formData, this.object);
    formData = EntitySheetHelper.updateGroups(formData, this.object);
    return formData;
  }
}
