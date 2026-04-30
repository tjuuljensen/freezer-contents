import Resources from "./freezer-management-resources.js";

const CARD_TYPE = "freezer-management-card";
const CARD_NAME = "Freezer Management Card";
const DOMAIN = "freezer_management";
const INTEGRATION_DOMAIN = "freezer_management";
const SORT_OPTIONS = ["freezerCompartment", "newest", "oldest", "item"];

class FreezerManagementCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this.config = null;
    this.items = [];
    this.form = { item: "", packagingType: "", freezerCompartment: "" };
    this.errorMessage = "";
    this.pending = false;
    this.entityUnavailable = true;
    this._lastLanguage = null;
    this._lastStateSignature = null;
  }

  static getStubConfig() {
    return {
      title: "",
      entity: "",
      sort_by: "freezerCompartment",
      item_header: "",
      packaging_header: "",
      compartment_header: "",
      date_header: "",
      show_shortcuts: true,
      shortcuts: [],
      grid_options: { columns: 12, rows: 5 },
    };
  }

  static getConfigElement() {
    return document.createElement("freezer-management-card-editor");
  }

  setConfig(config) {
    this.config = {
      ...FreezerManagementCard.getStubConfig(),
      ...config,
      sort_by: SORT_OPTIONS.includes(config?.sort_by) ? config.sort_by : "freezerCompartment",
      show_shortcuts: config?.show_shortcuts !== false,
      shortcuts: Array.isArray(config?.shortcuts) ? config.shortcuts : [],
    };
    this.style.display = "block";
    this.style.width = "100%";
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.refreshFromHass();
  }

  getCardSize() {
    return 5;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 4, rows: 5, min_rows: 5 };
  }

  refreshFromHass() {
    if (!this.config || !this._hass) return;
    const stateObj = this.config.entity ? this._hass.states?.[this.config.entity] ?? null : null;
    const signature = stateObj
      ? JSON.stringify([stateObj.state, stateObj.attributes?.items, stateObj.attributes?.updated_at])
      : "missing";
    const language = this._getLanguage();

    if (this._lastStateSignature !== signature || this._lastLanguage !== language) {
      this._lastStateSignature = signature;
      this._lastLanguage = language;
      this.items = this._parseItems(stateObj);
      this.render();
      return;
    }

    if (!this.shadowRoot?.innerHTML) {
      this.render();
    }
  }

  render() {
    if (!this.config || !this.shadowRoot) return;

    const stateObj = this.config.entity ? this._hass?.states?.[this.config.entity] ?? null : null;
    const title =
      this.config.title?.trim() ||
      stateObj?.attributes?.friendly_name ||
      this._label("card-title", "Freezer Management");

    const shortcuts = this._getShortcuts();
    const formDisabled = this.pending || this.entityUnavailable || !this.config.entity;
    const canClear = !formDisabled && this.items.length > 0;

    let bodyHtml = "";
    if (!this.config.entity) {
      bodyHtml = `<div class="fm-empty">${this._escapeHtml(this._label("setup-required", "Select a Freezer Management inventory entity in the card configuration."))}</div>`;
    } else {
      bodyHtml = `
        ${this._renderPanel(shortcuts, formDisabled)}
        ${this.items.length > 0
          ? this._renderTable()
          : `<div class="fm-empty">${this._escapeHtml(this._label("freezer-empty", "No items saved yet."))}</div>`}
      `;
    }

    const status = [];
    if (this.config.entity) {
      status.push(
        this.entityUnavailable
          ? this._label("inventory-unavailable", "The freezer inventory entity is unavailable.")
          : `${this._label("status-items", "Items")}: ${this.items.length}`
      );
    }
    if (this.errorMessage) status.push(this.errorMessage);

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; width:100%; }
        ha-card { width:100%; }
        .fm-panel {
          display:grid;
          gap:12px;
          margin-bottom:16px;
          padding:0 0 16px;
          border-bottom:1px solid var(--divider-color);
          background:transparent;
          border-radius:0;
          box-shadow:none;
        }
        .fm-panel-title { font-weight:600; }
        .fm-shortcuts { display:flex; flex-wrap:wrap; gap:8px; }
        .fm-form {
          display:grid;
          gap:12px;
          grid-template-columns: minmax(0, 2.2fr) minmax(0, 1.3fr) minmax(0, 1fr) auto;
          align-items:end;
        }
        .fm-actions {
          display:flex;
          gap:8px;
          justify-content:flex-end;
          align-items:center;
          flex-wrap:nowrap;
        }
        .fm-table-wrap { overflow-x:auto; }
        .fm-table { width:100%; border-collapse:collapse; }
        .fm-table th, .fm-table td {
          padding:10px 4px;
          border-bottom:1px solid var(--divider-color);
          vertical-align:middle;
        }
        .fm-table th { text-align:left; font-weight:600; }
        .fm-table td.fm-date, .fm-table th.fm-date,
        .fm-table td.fm-action, .fm-table th.fm-action {
          text-align:right;
          white-space:nowrap;
        }
        .fm-empty { padding:12px 0 4px; color:var(--secondary-text-color); }
        .fm-row-item { word-break:break-word; }
        .fm-footer-note { margin-top:10px; font-size:.85rem; color:var(--secondary-text-color); }
        button {
          appearance:none;
          border:none;
          border-radius:10px;
          padding:10px 14px;
          font:inherit;
          cursor:pointer;
          background:var(--primary-color);
          color:var(--text-primary-color, white);
          white-space:nowrap;
        }
        button.fm-secondary {
          background:transparent;
          color:var(--primary-text-color);
          border:1px solid var(--divider-color);
        }
        button.fm-icon { padding:8px 10px; }
        button:disabled { opacity:.6; cursor:not-allowed; }
        label.fm-field { display:grid; gap:6px; font-size:.9rem; min-width:0; }
        input {
          width:100%;
          min-width:0;
          box-sizing:border-box;
          padding:10px 12px;
          border-radius:10px;
          border:1px solid var(--divider-color);
          background:var(--card-background-color);
          color:var(--primary-text-color);
          font:inherit;
        }
        .fm-warning { font-size:.85rem; color:var(--warning-color, #db4437); }
        @media (max-width: 1100px) {
          .fm-form { grid-template-columns: 1fr 1fr; }
          .fm-actions { grid-column: 1 / -1; justify-content:flex-start; }
        }
        @media (max-width: 700px) {
          .fm-form { grid-template-columns: 1fr; }
          .fm-actions { justify-content:stretch; flex-wrap:wrap; }
          .fm-actions button { flex:1 1 auto; }
        }
      </style>
      <ha-card header="${this._escapeAttr(title)}">
        <div class="card-content">
          ${bodyHtml}
          ${status.length ? `<div class="fm-footer-note">${this._escapeHtml(status.join(" • "))}</div>` : ""}
          ${this.config.entity && this.entityUnavailable
            ? `<div class="fm-warning">${this._escapeHtml(this._label("inventory-warning-readonly", "Editing is disabled until the freezer inventory is available again."))}</div>`
            : ""}
          ${this.config.entity && !this.entityUnavailable && this.items.length > 0
            ? `<div class="fm-actions" style="margin-top: 12px;">
                <button class="fm-secondary" id="clear-inventory-btn" ${canClear ? "" : "disabled"}>
                  ${this._escapeHtml(this._label("clear-inventory-button", "Clear inventory"))}
                </button>
              </div>`
            : ""}
        </div>
      </ha-card>
    `;
    this._bindEvents();
  }

  _renderPanel(shortcuts, disabled) {
    const shortcutHtml =
      this.config.show_shortcuts && shortcuts.length
        ? `<div class="fm-shortcuts">
            ${shortcuts.map((shortcut) => `
              <button type="button" class="fm-secondary fm-shortcut" data-shortcut="${this._escapeAttr(shortcut)}" ${disabled ? "disabled" : ""}>
                ${this._escapeHtml(shortcut)}
              </button>
            `).join("")}
          </div>`
        : "";

    return `
      <div class="fm-panel">
        <div class="fm-panel-title">${this._escapeHtml(this._label("form-title", "Add freezer item"))}</div>
        ${shortcutHtml}
        <div class="fm-form">
          <label class="fm-field">
            <span>${this._escapeHtml(this._label("item-label", "Item"))}</span>
            <input id="fm-item" type="text" value="${this._escapeAttr(this.form.item || "")}" placeholder="${this._escapeAttr(this._label("item-placeholder", "Soup, bolognese, ..."))}" ${disabled ? "disabled" : ""}>
          </label>
          <label class="fm-field">
            <span>${this._escapeHtml(this._label("packaging-label", "Packaging"))}</span>
            <input id="fm-packaging" type="text" value="${this._escapeAttr(this.form.packagingType || "")}" ${disabled ? "disabled" : ""}>
          </label>
          <label class="fm-field">
            <span>${this._escapeHtml(this._label("compartment-label", "Compartment"))}</span>
            <input id="fm-compartment" type="text" value="${this._escapeAttr(this.form.freezerCompartment || "")}" ${disabled ? "disabled" : ""}>
          </label>
          <div class="fm-actions">
            <button id="save-item-btn" ${disabled ? "disabled" : ""}>
              ${this._escapeHtml(this.pending ? this._label("saving-button", "Saving...") : this._label("save-item-button", "Save"))}
            </button>
            <button id="clear-form-btn" class="fm-secondary" ${disabled ? "disabled" : ""}>
              ${this._escapeHtml(this._label("clear-form-button", "Clear"))}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _renderTable() {
    const headers = {
      item: this.config.item_header?.trim() || this._label("table-header-item", "Item"),
      packaging: this.config.packaging_header?.trim() || this._label("table-header-packaging", "Type"),
      compartment: this.config.compartment_header?.trim() || this._label("table-header-compartment", "Cmp"),
      date: this.config.date_header?.trim() || this._label("table-header-date", "Date"),
    };

    return `
      <div class="fm-table-wrap">
        <table class="fm-table">
          <thead>
            <tr>
              <th>${this._escapeHtml(headers.item)}</th>
              <th>${this._escapeHtml(headers.packaging)}</th>
              <th>${this._escapeHtml(headers.compartment)}</th>
              <th class="fm-date">${this._escapeHtml(headers.date)}</th>
              <th class="fm-action"></th>
            </tr>
          </thead>
          <tbody>
            ${this.items.map((item) => `
              <tr>
                <td class="fm-row-item">${this._escapeHtml(item.item || "")}</td>
                <td>${this._escapeHtml(item.packagingType || "")}</td>
                <td>${this._escapeHtml(item.freezerCompartment || "")}</td>
                <td class="fm-date">${this._escapeHtml(item.storageDate || "")}</td>
                <td class="fm-action">
                  <button class="fm-secondary fm-icon fm-delete" data-item-id="${this._escapeAttr(item.itemId || "")}" aria-label="${this._escapeAttr(this._label("delete-item-label", "Delete item"))}" title="${this._escapeAttr(this._label("delete-item-label", "Delete item"))}" ${this.pending || this.entityUnavailable ? "disabled" : ""}>✕</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  _bindEvents() {
    const itemInput = this.shadowRoot.getElementById("fm-item");
    const packagingInput = this.shadowRoot.getElementById("fm-packaging");
    const compartmentInput = this.shadowRoot.getElementById("fm-compartment");
    itemInput?.addEventListener("input", (e) => { this.form.item = e.target.value; this.errorMessage = ""; });
    packagingInput?.addEventListener("input", (e) => { this.form.packagingType = e.target.value; });
    compartmentInput?.addEventListener("input", (e) => { this.form.freezerCompartment = e.target.value; });
    [itemInput, packagingInput, compartmentInput].forEach((el) => el?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); this._saveItem(); }
    }));
    this.shadowRoot.getElementById("save-item-btn")?.addEventListener("click", () => this._saveItem());
    this.shadowRoot.getElementById("clear-form-btn")?.addEventListener("click", () => this._clearForm());
    this.shadowRoot.getElementById("clear-inventory-btn")?.addEventListener("click", () => this._clearInventory());
    this.shadowRoot.querySelectorAll(".fm-shortcut").forEach((button) => button.addEventListener("click", () => {
      this.form.item = button.dataset.shortcut || "";
      this.errorMessage = "";
      const input = this.shadowRoot.getElementById("fm-item");
      if (input) {
        input.value = this.form.item;
        input.focus();
        input.select();
      }
    }));
    this.shadowRoot.querySelectorAll(".fm-delete").forEach((button) => button.addEventListener("click", () => {
      const itemId = button.dataset.itemId;
      if (itemId) this._deleteItem(itemId);
    }));
  }

  async _saveItem() {
    if (!this._hass || !this.config?.entity || this.pending || this.entityUnavailable) return;
    const item = (this.form.item || "").trim();
    if (!item) {
      this.errorMessage = this._label("validation-missing-item", "Enter an item before saving.");
      this.render();
      return;
    }
    this.pending = true;
    this.errorMessage = "";
    this.render();
    try {
      await this._hass.callService(DOMAIN, "add_item", {
        entity_id: this.config.entity,
        item,
        packagingType: (this.form.packagingType || "").trim(),
        freezerCompartment: (this.form.freezerCompartment || "").trim(),
      });
      this.form = { item: "", packagingType: "", freezerCompartment: "" };
    } catch (error) {
      this.errorMessage = `${this._label("save-error", "Could not save freezer contents.")} ${error?.message || ""}`.trim();
    } finally {
      this.pending = false;
      this.render();
    }
  }

  async _deleteItem(itemId) {
    if (!this._hass || !this.config?.entity || this.pending || this.entityUnavailable) return;
    this.pending = true;
    this.errorMessage = "";
    this.render();
    try {
      await this._hass.callService(DOMAIN, "remove_item", { entity_id: this.config.entity, itemId });
    } catch (error) {
      this.errorMessage = `${this._label("delete-error", "Could not delete freezer item.")} ${error?.message || ""}`.trim();
    } finally {
      this.pending = false;
      this.render();
    }
  }

  async _clearInventory() {
    if (!this._hass || !this.config?.entity || this.pending || this.entityUnavailable || !this.items.length) return;
    this.pending = true;
    this.errorMessage = "";
    this.render();
    try {
      await this._hass.callService(DOMAIN, "clear_inventory", { entity_id: this.config.entity });
    } catch (error) {
      this.errorMessage = `${this._label("clear-error", "Could not clear freezer inventory.")} ${error?.message || ""}`.trim();
    } finally {
      this.pending = false;
      this.render();
    }
  }

  _clearForm() {
    this.form = { item: "", packagingType: "", freezerCompartment: "" };
    this.errorMessage = "";
    this.render();
  }

  _parseItems(stateObj) {
    const unavailableStates = new Set(["unavailable", "unknown"]);
    this.entityUnavailable = !stateObj || unavailableStates.has(String(stateObj.state));
    if (!stateObj || !Array.isArray(stateObj.attributes?.items)) return [];
    return this._sortItems(
      stateObj.attributes.items
        .map((item, index) => ({
          itemId: String(item?.itemId || item?.id || `row-${index}`),
          item: String(item?.item || item?.contents || item?.potContents || "").trim(),
          packagingType: String(item?.packagingType || item?.type || item?.number || item?.potNumber || "").trim(),
          freezerCompartment: String(item?.freezerCompartment || item?.compartment || item?.potCompartment || "").trim(),
          storageDate: String(item?.storageDate || item?.date || item?.potDate || "").trim(),
          storageIsoDate: String(item?.storageIsoDate || item?.iso_date || item?.potIsoDate || "").trim(),
        }))
        .filter((item) => item.item)
    );
  }

  _sortItems(items) {
    const sortBy = this.config?.sort_by || "freezerCompartment";
    const collator = new Intl.Collator(this._getLanguage(), { numeric: true, sensitivity: "base" });
    return [...items].sort((left, right) => {
      if (sortBy === "item") return collator.compare(left.item, right.item);
      if (sortBy === "newest" || sortBy === "oldest") {
        const leftDate = Date.parse(left.storageIsoDate || left.storageDate || "") || 0;
        const rightDate = Date.parse(right.storageIsoDate || right.storageDate || "") || 0;
        return sortBy === "newest" ? rightDate - leftDate : leftDate - rightDate;
      }
      const compartmentCompare = collator.compare(left.freezerCompartment || "", right.freezerCompartment || "");
      return compartmentCompare !== 0 ? compartmentCompare : collator.compare(left.item, right.item);
    });
  }

  _getShortcuts() {
    return (Array.isArray(this.config?.shortcuts) ? this.config.shortcuts : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean);
  }

  _getLanguage() {
    return (this._hass?.locale?.language || this._hass?.language || document.documentElement.lang || "en").split("-")[0];
  }

  _label(key, fallback) {
    const language = this._getLanguage();
    return Resources[language]?.[key] || Resources.en?.[key] || fallback;
  }

  _escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  _escapeAttr(value) {
    return this._escapeHtml(value);
  }
}

class FreezerManagementCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
  }

  setConfig(config) {
    this._config = { ...FreezerManagementCard.getStubConfig(), ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this.shadowRoot) return;
    const config = { ...FreezerManagementCard.getStubConfig(), ...this._config };
    const language = (this._hass?.locale?.language || this._hass?.language || document.documentElement.lang || "en").split("-")[0];
    const labels = Resources[language] || Resources.en;
    const states = this._hass?.states || {};
    const entities = Object.keys(states)
      .filter((entityId) => entityId.startsWith("sensor."))
      .filter((entityId) => states[entityId]?.attributes?.integration_domain === INTEGRATION_DOMAIN)
      .sort();
    const shortcuts = Array.isArray(config.shortcuts) ? config.shortcuts.join("\n") : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        .editor { display:grid; gap:16px; }
        .section { display:grid; gap:12px; padding:16px; border-radius:12px; background:var(--secondary-background-color); }
        .section-title { font-weight:600; }
        .grid { display:grid; gap:12px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
        label { display:grid; gap:6px; font-size:.95rem; }
        input, select, textarea {
          width:100%;
          box-sizing:border-box;
          padding:10px 12px;
          border:1px solid var(--divider-color);
          border-radius:10px;
          background:var(--card-background-color);
          color:var(--primary-text-color);
          font:inherit;
        }
        textarea { min-height:120px; resize:vertical; }
        .checkbox { display:flex; align-items:center; gap:10px; font-size:.95rem; }
        .checkbox input { width:auto; }
        .hint { font-size:.85rem; color:var(--secondary-text-color); }
      </style>
      <div class="editor">
        <div class="section">
          <div class="section-title">${labels["editor-section-connection"] || "Connection"}</div>
          <div class="grid">
            <label>
              <span>${labels["editor-title"] || "Title"}</span>
              <input data-field="title" type="text" value="${this._escape(config.title || "")}">
            </label>
            <label>
              <span>${labels["editor-entity"] || "Inventory entity"}</span>
              <input data-field="entity" type="text" list="inventory-entities" value="${this._escape(config.entity || "")}" placeholder="sensor.main_freezer_inventory">
              <datalist id="inventory-entities">${entities.map((id) => `<option value="${this._escape(id)}"></option>`).join("")}</datalist>
            </label>
            <label>
              <span>${labels["editor-sort-by"] || "Sort by"}</span>
              <select data-field="sort_by">
                ${SORT_OPTIONS.map((option) => `<option value="${option}" ${config.sort_by === option ? "selected" : ""}>${option}</option>`).join("")}
              </select>
            </label>
          </div>
        </div>
        <div class="section">
          <div class="section-title">${labels["editor-section-display"] || "Display"}</div>
          <div class="grid">
            <label><span>${labels["editor-item-header"] || "Item header"}</span><input data-field="item_header" type="text" value="${this._escape(config.item_header || "")}"></label>
            <label><span>${labels["editor-packaging-header"] || "Packaging header"}</span><input data-field="packaging_header" type="text" value="${this._escape(config.packaging_header || "")}"></label>
            <label><span>${labels["editor-compartment-header"] || "Compartment header"}</span><input data-field="compartment_header" type="text" value="${this._escape(config.compartment_header || "")}"></label>
            <label><span>${labels["editor-date-header"] || "Date header"}</span><input data-field="date_header" type="text" value="${this._escape(config.date_header || "")}"></label>
          </div>
        </div>
        <div class="section">
          <div class="section-title">${labels["editor-section-shortcuts"] || "Shortcuts"}</div>
          <label class="checkbox">
            <input data-field="show_shortcuts" type="checkbox" ${config.show_shortcuts ? "checked" : ""}>
            <span>${labels["editor-show-shortcuts"] || "Show shortcut buttons"}</span>
          </label>
          <label>
            <span>${labels["editor-shortcuts"] || "Shortcut items"}</span>
            <textarea data-field="shortcuts">${this._escape(shortcuts)}</textarea>
            <span class="hint">${labels["editor-shortcuts-hint"] || "One shortcut item per line."}</span>
          </label>
        </div>
      </div>
    `;

    this.shadowRoot.querySelectorAll("[data-field]").forEach((element) => {
      const isTextLike = element.tagName === "INPUT" || element.tagName === "TEXTAREA";
      const eventName = element.tagName === "SELECT" || element.type === "checkbox" ? "change" : "change";
      element.addEventListener(eventName, (event) => {
        const field = event.target.dataset.field;
        if (!field) return;
        const next = { ...this._config };
        if (field === "show_shortcuts") next.show_shortcuts = Boolean(event.target.checked);
        else if (field === "shortcuts") next.shortcuts = String(event.target.value || "").split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
        else next[field] = event.target.value;
        this._config = next;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: next }, bubbles: true, composed: true }));
      });
      if (isTextLike) {
        element.addEventListener("input", (event) => {
          const field = event.target.dataset.field;
          if (!field) return;
          if (field === "shortcuts") this._config.shortcuts = String(event.target.value || "").split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
          else this._config[field] = event.target.value;
        });
      }
    });
  }

  _escape(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
}

if (!customElements.get(CARD_TYPE)) customElements.define(CARD_TYPE, FreezerManagementCard);
if (!customElements.get("freezer-management-card-editor")) customElements.define("freezer-management-card-editor", FreezerManagementCardEditor);

window.customCards = window.customCards || [];
if (!window.customCards.find((card) => card.type === CARD_TYPE || card.type === `custom:${CARD_TYPE}`)) {
  window.customCards.push({
    type: CARD_TYPE,
    name: CARD_NAME,
    description: "Storage-backed freezer inventory card with inline add/remove actions.",
    preview: true,
  });
}
