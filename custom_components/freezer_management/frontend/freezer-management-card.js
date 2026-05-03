import Resources from "./freezer-management-resources.js";

const CARD_TYPE = "freezer-management-card";
const CARD_NAME = "Freezer Management Card";
const DOMAIN = "freezer_management";
const INTEGRATION_DOMAIN = "freezer_management";
const SORT_OPTIONS = ["freezerCompartment", "newest", "oldest", "item", "expiryDate"];
const DATE_DISPLAY_OPTIONS = ["locale_short", "locale_medium", "locale_long", "iso", "relative"];

class FreezerManagementCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this.config = null;
    this.items = [];
    this.form = {
      item: "",
      packagingType: "",
      freezerCompartment: "",
      expiryDate: "",
    };
    this.errorMessage = "";
    this.pending = false;
    this.entityUnavailable = true;
    this._lastLanguage = null;
    this._lastStateSignature = null;
    this._showAddForm = false;
    this._measuredHeight = 0;
    this._resizeObserver = null;
    this._boundMeasure = () => this._updateMeasuredSize();
  }

  static getStubConfig() {
    return {
      title: "",
      entity: "",
      sort_by: "freezerCompartment",
      date_display: "locale_medium",
      hide_added_date: false,
      item_header: "",
      packaging_header: "",
      compartment_header: "",
      added_header: "",
      expiry_header: "",
      show_shortcuts: true,
      shortcuts: [],
      item_shortcuts: [],
      packaging_shortcuts: [],
      compartment_shortcuts: [],
      expiry_shortcuts: [],
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
      date_display: DATE_DISPLAY_OPTIONS.includes(config?.date_display) ? config.date_display : "locale_medium",
      show_shortcuts: config?.show_shortcuts !== false,
      hide_added_date: config?.hide_added_date === true,
      shortcuts: Array.isArray(config?.shortcuts) ? config.shortcuts : [],
      item_shortcuts: Array.isArray(config?.item_shortcuts) ? config.item_shortcuts : [],
      packaging_shortcuts: Array.isArray(config?.packaging_shortcuts) ? config.packaging_shortcuts : [],
      compartment_shortcuts: Array.isArray(config?.compartment_shortcuts) ? config.compartment_shortcuts : [],
      expiry_shortcuts: Array.isArray(config?.expiry_shortcuts) ? config.expiry_shortcuts : [],
    };
    if (!this.config.item_shortcuts.length && this.config.shortcuts.length) {
      this.config.item_shortcuts = [...this.config.shortcuts];
    }
    this.style.display = "block";
    this.style.width = "100%";
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.refreshFromHass();
  }

  connectedCallback() {
    if (!this._resizeObserver) {
      this._resizeObserver = new ResizeObserver(() => this._updateMeasuredSize());
    }
    window.addEventListener("resize", this._boundMeasure);
    queueMicrotask(() => this._startObservingCard());
  }

  disconnectedCallback() {
    window.removeEventListener("resize", this._boundMeasure);
    this._resizeObserver?.disconnect();
  }

  getCardSize() {
    const height = this._measuredHeight || this._estimateHeight();
    return Math.max(4, Math.ceil(height / 50));
  }

  getGridOptions() {
    return { columns: 12, min_columns: 4 };
  }

  _estimateHeight() {
    const headerHeight = 96;
    const panelHeight = this._showAddForm ? 260 : 88;
    const footerHeight = 56;
    const tableHeaderHeight = this.items.length ? 48 : 0;
    const rowHeight = 48;
    const tableHeight = tableHeaderHeight + (this.items.length * rowHeight);
    return headerHeight + panelHeight + footerHeight + tableHeight;
  }

  _startObservingCard() {
    const card = this.shadowRoot?.querySelector("ha-card");
    if (!card || !this._resizeObserver) return;
    this._resizeObserver.disconnect();
    this._resizeObserver.observe(card);
    this._updateMeasuredSize();
  }

  _updateMeasuredSize() {
    const card = this.shadowRoot?.querySelector("ha-card");
    if (!card) return;
    const nextHeight = Math.ceil(card.getBoundingClientRect().height || card.scrollHeight || 0);
    if (!nextHeight) return;
    if (Math.abs(nextHeight - this._measuredHeight) < 2) return;
    this._measuredHeight = nextHeight;
    this._notifyCardSizeChanged();
  }

  _notifyCardSizeChanged() {
    this.dispatchEvent(new Event("iron-resize", { bubbles: true, composed: true }));
    window.dispatchEvent(new Event("resize"));
  }

  _toggleAddForm(force) {
    this._showAddForm = typeof force === "boolean" ? force : !this._showAddForm;
    this.render();
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

    const itemShortcuts = this._getConfiguredShortcuts("item");
    const formDisabled = this.pending || this.entityUnavailable || !this.config.entity;
    const canClear = !formDisabled && this.items.length > 0;

    let bodyHtml = "";
    if (!this.config.entity) {
      bodyHtml = `<div class="fm-empty">${this._escapeHtml(this._label("setup-required", "Select a Freezer Management inventory entity in the card configuration."))}</div>`;
    } else {
      bodyHtml = `
        ${this._renderPanel(itemShortcuts, formDisabled)}
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
        :host {
          display:block;
          width:100%;
          box-sizing:border-box;
        }
        *, *::before, *::after { box-sizing:border-box; }
        ha-card {
          display:block;
          width:100%;
          overflow:hidden;
        }
        .fm-panel {
          display:grid;
          gap:16px;
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
          grid-template-columns: minmax(0,2.6fr) minmax(0,1.6fr) minmax(86px,0.55fr) minmax(120px,0.85fr);
          align-items:end;
        }
        .fm-actions { display:flex; gap:8px; justify-content:flex-end; align-items:center; flex-wrap:wrap; }
        .fm-table-wrap { overflow-x:auto; }
        .fm-table { width:100%; border-collapse:collapse; }
        .fm-table th,.fm-table td { padding:10px 4px; border-bottom:1px solid var(--divider-color); vertical-align:middle; }
        .fm-table th { text-align:left; font-weight:600; }
        .fm-table td.fm-date,.fm-table th.fm-date,.fm-table td.fm-action,.fm-table th.fm-action {
          text-align:right; white-space:nowrap;
        }
        .fm-empty { padding:12px 0 4px; color:var(--secondary-text-color); }
        .fm-row-item { word-break:break-word; }
        .fm-footer-note { margin-top:10px; font-size:.85rem; color:var(--secondary-text-color); }
        button {
          appearance:none; border:none; border-radius:10px; padding:10px 14px;
          font:inherit; cursor:pointer; background:var(--primary-color); color:var(--text-primary-color, white);
        }
        button.fm-secondary {
          background:transparent; color:var(--primary-text-color); border:1px solid var(--divider-color);
        }
        button.fm-icon { padding:8px 10px; }
        button:disabled { opacity:.6; cursor:not-allowed; }
        label.fm-field { display:grid; gap:6px; font-size:.9rem; min-width:0; }
        input {
          width:100%; box-sizing:border-box; padding:10px 12px; border-radius:10px; border:1px solid var(--divider-color);
          background:var(--card-background-color); color:var(--primary-text-color); font:inherit;
        }
        .fm-help { font-size:.8rem; color:var(--secondary-text-color); margin-top:-4px; }
        .fm-warning { font-size:.85rem; color:var(--warning-color,#db4437); }
        @media (max-width:980px) {
          .fm-form { grid-template-columns: repeat(2, minmax(0,1fr)); }
        }
        @media (max-width:640px) {
          .fm-form { grid-template-columns: 1fr; }
          .fm-actions { justify-content:stretch; }
          .fm-actions button { flex:1 1 auto; }
        }
      </style>
      <ha-card header="${this._escapeAttr(title)}">
        <div class="card-content fm-card">
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
    queueMicrotask(() => this._startObservingCard());
    requestAnimationFrame(() => this._updateMeasuredSize());
  }

  _renderPanel(itemShortcuts, disabled) {
    const shortcutHtml =
      this.config.show_shortcuts && itemShortcuts.length && this._showAddForm
        ? `
          <div class="fm-shortcuts">
            ${itemShortcuts.map((shortcut) => `
              <button
                type="button"
                class="fm-secondary fm-shortcut"
                data-shortcut="${this._escapeAttr(shortcut)}"
                ${disabled ? "disabled" : ""}
              >
                ${this._escapeHtml(shortcut)}
              </button>
            `).join("")}
          </div>
        `
        : "";

    const formHtml = this._showAddForm
      ? `
        ${shortcutHtml}

        <div class="fm-form">
          <label class="fm-field">
            <span>${this._escapeHtml(this._label("field-item", "Item"))}</span>
            <input
              id="fm-item"
              type="text"
              list="fm-item-suggestions"
              value="${this._escapeAttr(this.form.item || "")}"
              placeholder="${this._escapeAttr(this._label("item-placeholder", "black beans, rye bread"))}"
              ${disabled ? "disabled" : ""}
            />
          </label>

          <label class="fm-field">
            <span>${this._escapeHtml(this._label("field-packaging", "Packaging"))}</span>
            <input
              id="fm-packaging"
              type="text"
              list="fm-packaging-suggestions"
              value="${this._escapeAttr(this.form.packagingType || "")}"
              ${disabled ? "disabled" : ""}
            />
          </label>

          <label class="fm-field">
            <span>${this._escapeHtml(this._label("field-compartment", "Compartment"))}</span>
            <input
              id="fm-compartment"
              type="text"
              list="fm-compartment-suggestions"
              value="${this._escapeAttr(this.form.freezerCompartment || "")}"
              ${disabled ? "disabled" : ""}
            />
          </label>

          <label class="fm-field">
            <span>${this._escapeHtml(this._label("field-expiry", "Expiry"))}</span>
            <input
              id="fm-expiry"
              type="text"
              list="fm-expiry-suggestions"
              value="${this._escapeAttr(this.form.expiryDate || "")}"
              placeholder="90d, 6m, 1y or 2026-12-31"
              ${disabled ? "disabled" : ""}
            />
          </label>
        </div>

        <datalist id="fm-item-suggestions">${this._renderDatalist(this._getConfiguredShortcuts("item"))}</datalist>
        <datalist id="fm-packaging-suggestions">${this._renderDatalist(this._getConfiguredShortcuts("packaging"))}</datalist>
        <datalist id="fm-compartment-suggestions">${this._renderDatalist(this._getConfiguredShortcuts("compartment"))}</datalist>
        <datalist id="fm-expiry-suggestions">${this._renderDatalist(this._getConfiguredShortcuts("expiry"))}</datalist>

        <div class="fm-help">
          Expiry accepts codes like 90d, 6m, 1y or a date like 2026-12-31.
        </div>

        <div class="fm-actions">
          <button id="save-item-btn" ${disabled ? "disabled" : ""}>
            ${this._escapeHtml(this.pending ? this._label("saving-button", "Saving...") : this._label("save-item-button", "Save"))}
          </button>
          <button id="clear-form-btn" class="fm-secondary" ${disabled ? "disabled" : ""}>
            ${this._escapeHtml(this._label("clear-form-button", "Clear"))}
          </button>
        </div>
      `
      : "";

    return `
      <div class="fm-panel">
        <div class="fm-actions" style="justify-content:space-between; align-items:center;">
          <div class="fm-panel-title">${this._escapeHtml(this._label("form-title", "Add freezer item"))}</div>
          <button
            id="toggle-add-form-btn"
            class="fm-secondary"
            ${this.pending ? "disabled" : ""}
          >
            ${this._escapeHtml(
              this._showAddForm
                ? this._label("cancel-button", "Cancel")
                : this._label("show-add-form-button", "Add item")
            )}
          </button>
        </div>

        ${formHtml}
      </div>
    `;
  }

  _renderDatalist(values) {
    return values.map((value) => `<option value="${this._escapeAttr(value)}"></option>`).join("");
  }

  _renderTable() {
    const headers = {
      item: this.config.item_header?.trim() || this._label("table-header-item", "Item"),
      packaging: this.config.packaging_header?.trim() || this._label("table-header-packaging", "Packaging"),
      compartment: this.config.compartment_header?.trim() || this._label("table-header-compartment", "Compartment"),
      added: this.config.added_header?.trim() || this._label("table-header-added", "Added"),
      expiry: this.config.expiry_header?.trim() || this._label("table-header-expiry", "Expiry"),
    };

    return `
      <div class="fm-table-wrap">
        <table class="fm-table">
          <thead>
            <tr>
              <th>${this._escapeHtml(headers.item)}</th>
              <th>${this._escapeHtml(headers.packaging)}</th>
              <th>${this._escapeHtml(headers.compartment)}</th>
              ${this.config.hide_added_date ? "" : `<th class="fm-date">${this._escapeHtml(headers.added)}</th>`}
              <th class="fm-date">${this._escapeHtml(headers.expiry)}</th>
              <th class="fm-action"></th>
            </tr>
          </thead>
          <tbody>
            ${this.items.map((item) => `
              <tr>
                <td class="fm-row-item">${this._escapeHtml(item.item || "")}</td>
                <td>${this._escapeHtml(item.packagingType || "")}</td>
                <td>${this._escapeHtml(item.freezerCompartment || "")}</td>
                ${this.config.hide_added_date ? "" : `<td class="fm-date">${this._escapeHtml(this._formatConfiguredDate(item.addedDate, item.addedIsoDate))}</td>`}
                <td class="fm-date">${this._escapeHtml(this._formatConfiguredDate(item.expiryDate, item.expiryIsoDate))}</td>
                <td class="fm-action">
                  <button
                    class="fm-secondary fm-icon fm-delete"
                    data-item-id="${this._escapeAttr(item.itemId || "")}"
                    aria-label="${this._escapeAttr(this._label("delete-item-label", "Delete item"))}"
                    title="${this._escapeAttr(this._label("delete-item-label", "Delete item"))}"
                    ${this.pending || this.entityUnavailable ? "disabled" : ""}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  _bindEvents() {
    const toggleAddFormButton = this.shadowRoot.getElementById("toggle-add-form-btn");
    const itemInput = this.shadowRoot.getElementById("fm-item");
    const packagingInput = this.shadowRoot.getElementById("fm-packaging");
    const compartmentInput = this.shadowRoot.getElementById("fm-compartment");
    const expiryInput = this.shadowRoot.getElementById("fm-expiry");

    toggleAddFormButton?.addEventListener("click", () => this._toggleAddForm());

    itemInput?.addEventListener("input", (event) => {
      this.form.item = event.target.value;
      this.errorMessage = "";
    });
    packagingInput?.addEventListener("input", (event) => {
      this.form.packagingType = event.target.value;
    });
    compartmentInput?.addEventListener("input", (event) => {
      this.form.freezerCompartment = event.target.value;
    });
    expiryInput?.addEventListener("input", (event) => {
      this.form.expiryDate = event.target.value;
    });

    [itemInput, packagingInput, compartmentInput, expiryInput].forEach((el) =>
      el?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this._saveItem();
        }
      })
    );

    this.shadowRoot.getElementById("save-item-btn")?.addEventListener("click", () => this._saveItem());
    this.shadowRoot.getElementById("clear-form-btn")?.addEventListener("click", () => this._clearForm());
    this.shadowRoot.getElementById("clear-inventory-btn")?.addEventListener("click", () => this._clearInventory());

    this.shadowRoot.querySelectorAll(".fm-shortcut").forEach((button) => {
      button.addEventListener("click", () => {
        this.form.item = button.dataset.shortcut || "";
        this.errorMessage = "";
        this.render();
        const newItemInput = this.shadowRoot.getElementById("fm-item");
        newItemInput?.focus();
        newItemInput?.select();
      });
    });

    this.shadowRoot.querySelectorAll(".fm-delete").forEach((button) => {
      button.addEventListener("click", () => {
        const itemId = button.dataset.itemId;
        if (itemId) this._deleteItem(itemId);
      });
    });
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
        expiryDate: (this.form.expiryDate || "").trim(),
      });

      this.form = {
        item: "",
        packagingType: "",
        freezerCompartment: "",
        expiryDate: "",
      };
      this._showAddForm = false;
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
      await this._hass.callService(DOMAIN, "remove_item", {
        entity_id: this.config.entity,
        itemId,
      });
    } catch (error) {
      this.errorMessage = `${this._label("delete-error", "Could not delete freezer item.")} ${error?.message || ""}`.trim();
    } finally {
      this.pending = false;
      this.render();
    }
  }

  async _clearInventory() {
    if (!this._hass || !this.config?.entity || this.pending || this.entityUnavailable || !this.items.length) return;

    const confirmed = window.confirm(this._label("clear-inventory-confirm", "Clear the entire inventory?"));
    if (!confirmed) return;

    this.pending = true;
    this.errorMessage = "";
    this.render();

    try {
      await this._hass.callService(DOMAIN, "clear_inventory", {
        entity_id: this.config.entity,
      });
    } catch (error) {
      this.errorMessage = `${this._label("clear-error", "Could not clear freezer inventory.")} ${error?.message || ""}`.trim();
    } finally {
      this.pending = false;
      this.render();
    }
  }

  _clearForm() {
    this.form = {
      item: "",
      packagingType: "",
      freezerCompartment: "",
      expiryDate: "",
    };
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
          item: String(item?.item || "").trim(),
          packagingType: String(item?.packagingType || "").trim(),
          freezerCompartment: String(item?.freezerCompartment || "").trim(),
          addedDate: String(item?.addedDate || "").trim(),
          addedIsoDate: String(item?.addedIsoDate || "").trim(),
          expiryDate: String(item?.expiryDate || "").trim(),
          expiryIsoDate: String(item?.expiryIsoDate || "").trim(),
        }))
        .filter((item) => item.item)
    );
  }

  _sortItems(items) {
    const sortBy = this.config?.sort_by || "freezerCompartment";
    const collator = new Intl.Collator(this._getLanguage(), { numeric: true, sensitivity: "base" });

    return [...items].sort((left, right) => {
      if (sortBy === "item") {
        return collator.compare(left.item, right.item);
      }

      if (sortBy === "newest" || sortBy === "oldest") {
        const leftDate = this._dateValue(left.addedIsoDate, left.addedDate);
        const rightDate = this._dateValue(right.addedIsoDate, right.addedDate);
        return sortBy === "newest" ? rightDate - leftDate : leftDate - rightDate;
      }

      if (sortBy === "expiryDate") {
        const leftDate = this._dateValue(left.expiryIsoDate, left.expiryDate);
        const rightDate = this._dateValue(right.expiryIsoDate, right.expiryDate);
        return leftDate - rightDate;
      }

      const compartmentCompare = collator.compare(left.freezerCompartment || "", right.freezerCompartment || "");
      if (compartmentCompare !== 0) return compartmentCompare;
      return collator.compare(left.item, right.item);
    });
  }

  _dateValue(isoValue, dateValue) {
    const candidate = isoValue || dateValue || "";
    const timestamp = Date.parse(candidate);
    return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
  }

  _formatConfiguredDate(dateValue, isoValue) {
    const displayMode = this.config?.date_display || "locale_medium";
    const candidate = isoValue || dateValue || "";
    if (!candidate) return "";

    if (displayMode === "iso") {
      return dateValue || candidate.slice(0, 10);
    }

    const parsed = new Date(candidate);
    if (Number.isNaN(parsed.getTime())) return dateValue || candidate;

    if (displayMode === "relative") {
      return this._formatRelativeDate(parsed);
    }

    if (displayMode === "locale_short") {
      return new Intl.DateTimeFormat(this._getLanguage(), { year: "2-digit", month: "numeric", day: "numeric" }).format(parsed);
    }

    if (displayMode === "locale_long") {
      return new Intl.DateTimeFormat(this._getLanguage(), { year: "numeric", month: "long", day: "numeric" }).format(parsed);
    }

    return new Intl.DateTimeFormat(this._getLanguage(), { year: "numeric", month: "short", day: "numeric" }).format(parsed);
  }

  _formatRelativeDate(date) {
    const diffMs = date.getTime() - Date.now();
    const diffDays = Math.round(diffMs / 86400000);

    if (Math.abs(diffDays) < 1) {
      return new Intl.DateTimeFormat(this._getLanguage(), {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date);
    }

    const rtf = new Intl.RelativeTimeFormat(this._getLanguage(), { numeric: "auto" });

    if (Math.abs(diffDays) < 31) return rtf.format(diffDays, "day");

    const diffMonths = Math.round(diffDays / 30);
    if (Math.abs(diffMonths) < 12) return rtf.format(diffMonths, "month");

    const diffYears = Math.round(diffMonths / 12);
    return rtf.format(diffYears, "year");
  }

  _getConfiguredShortcuts(field) {
    const collator = new Intl.Collator(this._getLanguage(), { sensitivity: "base", numeric: true });
    const map = new Map();

    let configured = [];
    if (field === "item") configured = this.config.item_shortcuts || this.config.shortcuts || [];
    if (field === "packaging") configured = this.config.packaging_shortcuts || [];
    if (field === "compartment") configured = this.config.compartment_shortcuts || [];
    if (field === "expiry") configured = this.config.expiry_shortcuts || [];

    for (const value of configured) {
      const clean = String(value || "").trim();
      if (!clean) continue;
      const key = clean.toLocaleLowerCase(this._getLanguage());
      if (!map.has(key)) map.set(key, clean);
    }

    return [...map.values()].sort((a, b) => collator.compare(a, b));
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
    this._config = {
      ...FreezerManagementCard.getStubConfig(),
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this.shadowRoot) return;

    const config = {
      ...FreezerManagementCard.getStubConfig(),
      ...this._config,
    };

    const language = this._getLanguage();
    const labels = Resources[language] || Resources.en;
    const states = this._hass?.states || {};
    const entities = Object.keys(states)
      .filter((entityId) => entityId.startsWith("sensor."))
      .filter((entityId) => states[entityId]?.attributes?.integration_domain === INTEGRATION_DOMAIN)
      .sort();

    const itemShortcutsText = Array.isArray(config.item_shortcuts?.length ? config.item_shortcuts : config.shortcuts)
      ? (config.item_shortcuts?.length ? config.item_shortcuts : config.shortcuts).join("\n")
      : "";
    const packagingShortcutsText = Array.isArray(config.packaging_shortcuts) ? config.packaging_shortcuts.join("\n") : "";
    const compartmentShortcutsText = Array.isArray(config.compartment_shortcuts) ? config.compartment_shortcuts.join("\n") : "";
    const expiryShortcutsText = Array.isArray(config.expiry_shortcuts) ? config.expiry_shortcuts.join("\n") : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        .editor { display:grid; gap:16px; }
        .section { display:grid; gap:12px; padding:16px; border-radius:12px; background:var(--secondary-background-color); }
        .section-title { font-weight:600; }
        .grid { display:grid; gap:12px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
        label { display:grid; gap:6px; font-size:.95rem; }
        input,select,textarea {
          width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid var(--divider-color);
          border-radius:10px; background:var(--card-background-color); color:var(--primary-text-color); font:inherit;
        }
        textarea { min-height:100px; resize:vertical; }
        .checkbox { display:flex; align-items:center; gap:10px; font-size:.95rem; }
        .checkbox input { width:auto; }
        .hint { font-size:.85rem; color:var(--secondary-text-color); }
      </style>

      <div class="editor">
        <div class="section">
          <div class="section-title">${this._escape(labels["editor-section-connection"] || "Connection")}</div>
          <div class="grid">
            <label>
              <span>${this._escape(labels["editor-title"] || "Title")}</span>
              <input data-field="title" type="text" value="${this._escape(config.title || "")}" />
            </label>

            <label>
              <span>${this._escape(labels["editor-entity"] || "Inventory entity")}</span>
              <input
                data-field="entity"
                type="text"
                list="inventory-entities"
                value="${this._escape(config.entity || "")}"
                placeholder="sensor.main_freezer_inventory"
              />
              <datalist id="inventory-entities">
                ${entities.map((entityId) => `<option value="${this._escape(entityId)}"></option>`).join("")}
              </datalist>
            </label>

            <label>
              <span>${this._escape(labels["editor-sort-by"] || "Sort by")}</span>
              <select data-field="sort_by">
                ${SORT_OPTIONS.map((option) => `<option value="${option}" ${config.sort_by === option ? "selected" : ""}>${option}</option>`).join("")}
              </select>
            </label>

            <label>
              <span>${this._escape(labels["editor-date-display"] || "Date display")}</span>
              <select data-field="date_display">
                ${DATE_DISPLAY_OPTIONS.map((option) => `<option value="${option}" ${config.date_display === option ? "selected" : ""}>${option}</option>`).join("")}
              </select>
            </label>
          </div>
        </div>

        <div class="section">
          <div class="section-title">${this._escape(labels["editor-section-display"] || "Display")}</div>
          <div class="grid">
            <label>
              <span>${this._escape(labels["editor-item-header"] || "Item header")}</span>
              <input data-field="item_header" type="text" value="${this._escape(config.item_header || "")}" />
            </label>

            <label>
              <span>${this._escape(labels["editor-packaging-header"] || "Packaging header")}</span>
              <input data-field="packaging_header" type="text" value="${this._escape(config.packaging_header || "")}" />
            </label>

            <label>
              <span>${this._escape(labels["editor-compartment-header"] || "Compartment header")}</span>
              <input data-field="compartment_header" type="text" value="${this._escape(config.compartment_header || "")}" />
            </label>

            <label>
              <span>${this._escape(labels["editor-added-header"] || "Added header")}</span>
              <input data-field="added_header" type="text" value="${this._escape(config.added_header || "")}" />
            </label>

            <label>
              <span>${this._escape(labels["editor-expiry-header"] || "Expiry header")}</span>
              <input data-field="expiry_header" type="text" value="${this._escape(config.expiry_header || "")}" />
            </label>
          </div>

          <label class="checkbox">
            <input data-field="hide_added_date" type="checkbox" ${config.hide_added_date ? "checked" : ""} />
            <span>${this._escape(labels["editor-hide-added-date"] || "Hide added date")}</span>
          </label>
        </div>

        <div class="section">
          <div class="section-title">${this._escape(labels["editor-section-shortcuts"] || "Shortcuts")}</div>

          <label class="checkbox">
            <input data-field="show_shortcuts" type="checkbox" ${config.show_shortcuts ? "checked" : ""} />
            <span>${this._escape(labels["editor-show-shortcuts"] || "Show shortcut buttons")}</span>
          </label>

          <div class="grid">
            <label>
              <span>${this._escape(labels["editor-item-shortcuts"] || "Item suggestions")}</span>
              <textarea data-field="item_shortcuts">${this._escape(itemShortcutsText)}</textarea>
            </label>

            <label>
              <span>${this._escape(labels["editor-packaging-shortcuts"] || "Packaging suggestions")}</span>
              <textarea data-field="packaging_shortcuts">${this._escape(packagingShortcutsText)}</textarea>
            </label>

            <label>
              <span>${this._escape(labels["editor-compartment-shortcuts"] || "Compartment suggestions")}</span>
              <textarea data-field="compartment_shortcuts">${this._escape(compartmentShortcutsText)}</textarea>
            </label>

            <label>
              <span>${this._escape(labels["editor-expiry-shortcuts"] || "Expiry suggestions")}</span>
              <textarea data-field="expiry_shortcuts">${this._escape(expiryShortcutsText)}</textarea>
            </label>
          </div>
          <span class="hint">${this._escape(labels["editor-shortcuts-hint"] || "One shortcut item per line.")}</span>
        </div>
      </div>
    `;

    this._bindEditorEvents();
  }

  _bindEditorEvents() {
    this.shadowRoot.querySelectorAll("[data-field]").forEach((element) => {
      const field = element.dataset.field;
      if (!field) return;

      if (element.tagName === "SELECT" || element.type === "checkbox") {
        element.addEventListener("change", (event) => this._handleChange(event));
        return;
      }

      element.addEventListener("change", (event) => this._handleChange(event));
      element.addEventListener("blur", (event) => this._handleChange(event));
    });
  }

  _handleChange(event) {
    const field = event.target.dataset.field;
    if (!field) return;

    const nextConfig = { ...this._config };

    if (field === "show_shortcuts" || field === "hide_added_date") {
      nextConfig[field] = Boolean(event.target.checked);
    } else if (["item_shortcuts", "packaging_shortcuts", "compartment_shortcuts", "expiry_shortcuts"].includes(field)) {
      nextConfig[field] = String(event.target.value || "")
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean);
    } else {
      nextConfig[field] = event.target.value;
    }

    this._config = nextConfig;
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: nextConfig },
      bubbles: true,
      composed: true,
    }));
  }

  _getLanguage() {
    return (this._hass?.locale?.language || this._hass?.language || document.documentElement.lang || "en").split("-")[0];
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

if (!customElements.get(CARD_TYPE)) {
  customElements.define(CARD_TYPE, FreezerManagementCard);
}

if (!customElements.get("freezer-management-card-editor")) {
  customElements.define("freezer-management-card-editor", FreezerManagementCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.find((card) => card.type === CARD_TYPE || card.type === `custom:${CARD_TYPE}`)) {
  window.customCards.push({
    type: CARD_TYPE,
    name: CARD_NAME,
    description: "Storage-backed freezer inventory card with inline add/remove actions.",
    preview: true,
  });
}
