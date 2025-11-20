import { EntitySheetHelper } from "./helper.js";
import { ATTRIBUTE_TYPES } from "./constants.js";

export class NarequentaActorSheet extends ActorSheet {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["narequenta", "sheet", "actor"],
      template: "systems/narequenta/templates/actor-sheet.html",
      width: 800,
      height: 700,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "essences"}]
    });
  }

  /** @inheritdoc */
  async getData(options) {
    // 1. Get the basic context
    const context = await super.getData(options);

    // 2. CRITICAL FIX: Correctly retrieve system data for V10+
    // We get the plain object from the actor document
    const actorData = this.actor.toObject(false);

    // 3. Define the variable your HTML is looking for (systemData)
    context.systemData = actorData.system;
    context.system = actorData.system; // Backup

    // 4. Prepare Legacy Helper Data (pass the full actorData object)
    EntitySheetHelper.getAttributeData(actorData);
    
    // 5. Pass Settings & Types
    context.shorthand = !!game.settings.get("narequenta", "macroShorthand");
    context.dtypes = ATTRIBUTE_TYPES;
    
    // 6. Enrich Biography (HTML Editor)
    context.biographyHTML = await TextEditor.enrichHTML(context.systemData.biography, {
      secrets: this.document.isOwner,
      async: true
    });
    
    return context;
  }

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    if ( !this.isEditable ) return;

    // Keep legacy listeners for Items
    html.find(".item-control").click(this._onItemControl.bind(this));
    html.find(".items .rollable").on("click", this._onItemRoll.bind(this));
  }

  _onItemControl(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const li = button.closest(".item");
    const item = this.actor.items.get(li?.dataset.itemId);

    switch ( button.dataset.action ) {
      case "create":
        const cls = getDocumentClass("Item");
        return cls.create({name: game.i18n.localize("NAREQUENTA.ItemNew"), type: "item"}, {parent: this.actor});
      case "edit":
        return item.sheet.render(true);
      case "delete":
        return item.delete();
    }
  }

  _onItemRoll(event) {
    let button = $(event.currentTarget);
    const li = button.parents(".item");
    const item = this.actor.items.get(li.data("itemId"));
    
    // Basic roll to chat
    if (item) item.roll(); 
  }
}