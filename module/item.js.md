import {EntitySheetHelper} from "./helper.js";

/**
 * Extend the base Item document to support attributes and groups with a custom template creation dialog.
 * @extends {Item}
 */
export class SimpleItem extends Item {

  /** @inheritdoc */
  prepareDerivedData() {
    /* ... code ... */
  }

  /* -------------------------------------------- */

  /** @override */
  static async createDialog(data={}, options={}) {
    /* ... code ... */
  }

  /* -------------------------------------------- */

  /**
   * Is this Item used as a template for other Items?
   * @type {boolean}
   */
  get isTemplate() {
    /* ... code ... */
  }
}