import Resources from "./freezer-management-resources.js";

const CARD_TYPE = "freezer-management-card";
const CARD_NAME = "Freezer Management Card";
const CARD_VERSION = "0.4.0";

const SORT_OPTIONS = ["compartment", "newest", "oldest", "contents"];

class FreezerManagementCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this._hass = null;
    this.config = null;
    this.items = [];
    this.form = {
      contents: "",
      compartment: "",
    };
    this.errorMessage = "";
    this.pending = false;
    this.sensorUnavailable = true;
    this._lastLanguage = null;
    this._lastSensorState = null;
  }

  static getStubConfig() {
    return {
      title: "Freezer",
      contents_notify: "notify.freezer_contents",
      contents_sensor: "sensor.freezer_contents",
      sort_by: "compartment",
      show_shortcuts: true,
      shortcuts: [],
    };
  }

  static getConfigElement() {
    return document.createElement("freezer-management-card-editor");
  }

  setConfig(config) {
    this.config = this._normalizeConfig(config);
    this.style.display = "block";
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.refreshFromHass();
  }

  getCardSize() {
    return Math.max(4, Math.ceil((this.items.length + 6) / 3));
  }

  getGridOptions() {
    return {
      columns: 6,
      min_columns: 4,
      rows: Math.max(5, Math.ceil((this.items.length + 6) / 2)),
      min_rows: 4,
    };
  }

  refreshFromHass() {
    if (!this.config) {
      return;
    }

    const sensorState = this._hass?.states?.[this.config.contents_sensor] ?? null;
    const language = this._getLanguage();

    if (this._lastSensorState !== sensorState || this._lastLanguage !== language) {
      this._lastSensorState = sensorState;
      this._lastLanguage = language;
      this.items = this._parseItems(sensorState);
      this.render();
      return;
    }

    if (!this.shadowRoot?.innerHTML) {
      this.render();
    }
  }

  render() {
    if (!this.config || !this.shadowRoot) {
      return;
    }

    const title = this.config.title || this._label("card-title", "Freezer Management");
    const shortcuts = this._getShortcuts();
    const tableHtml = this.items.length > 0
      ? this._renderTable()
      : `<div class="fm-empty">${this._escapeHtml(this._label("freezer-empty", "No items saved yet."))}</div>`;

    const statusParts = [];
    if (this.sensorUnavailable) {
      statusParts.push(this._label("sensor-unavailable", "The contents sensor is unavailable."));
    } else {
      statusParts.push(`${this._label("status-items", "Items")}: ${this.items.length}`);
    }
    if (this.errorMessage) {
      statusParts.push(this.errorMessage);
    }

    const actionsDisabled = this.pending || this.sensorUnavailable;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .fm-card {
          color: var(--primary-text-color);
        }

        .fm-panel {
          display: grid;
          gap: 12px;
          margin-bottom: 16px;
          padding: 12px;
          border-radius: 12px;
          background: var(--secondary-background-color);
        }

        .fm-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .fm-panel-title {
          font-weight: 600;
        }

        .fm-status {
          font-size: 0.9rem;
          color: var(--secondary-text-color);
        }

        .fm-shortcuts {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .fm-form {
          display: grid;
          gap: 12px;
          grid-template-columns: minmax(0, 2fr) minmax(140px, 1fr) auto;
          align-items: end;
        }

        .fm-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          align-items: center;
          flex-wrap: wrap;
        }

        .fm-table-wrap {
          overflow-x: auto;
        }

        .fm-table {
          width: 100%;
          border-collapse: collapse;
        }

        .fm-table th,
        .fm-table td {
          padding: 8px 4px;
          border-bottom: 1px solid var(--divider-color);
          vertical-align: middle;
        }

        .fm-table th {
          text-align: left;
          font-weight: 600;
        }

        .fm-table td.fm-number,
        .fm-table th.fm-number,
        .fm-table td.fm-date,
        .fm-table th.fm-date,
        .fm-table td.fm-action,
        .fm-table th.fm-action {
          text-align: right;
          white-space: nowrap;
        }

        .fm-empty {
          padding: 12px 0 4px;
          color: var(--secondary-text-color);
        }

        .fm-row-content {
          word-break: break-word;
        }

        .fm-footer-note {
          margin-top: 4px;
          font-size: 0.8rem;
          color: var(--secondary-text-color);
        }

        @media (max-width: 800px) {
          .fm-form {
            grid-template-columns: 1fr;
          }

          .fm-actions {
            justify-content: stretch;
          }
        }
      </style>

      <ha-card header="${this._escapeAttribute(title)}">
        <div class="card-content fm-card">
          <div class="fm-panel">
            <div class="fm-panel-header">
              <div class="fm-panel-title">${this._escapeHtml(this._label("form-title", "Add freezer item"))}</div>
              <div class="fm-status">${this._escapeHtml(statusParts.join(" · "))}</div>
            </div>

            ${
              this.config.show_shortcuts && shortcuts.length > 0
                ? `
                  <div class="fm-shortcuts" id="shortcut-list">
                    ${shortcuts.map((shortcut, index) => `
                      <mwc-button
                        class="action"
                        data-shortcut-index="${index}"
                        ${actionsDisabled ? "disabled" : ""}
                      >${this._escapeHtml(shortcut)}</mwc-button>
                    `).join("")}
                  </div>
                `
                : ""
            }

            <div class="fm-form">
              <ha-textfield
                id="item-contents"
                type="text"
                label="${this._escapeAttribute(this._label("item-contents-label", "Contents"))}"
                placeholder="${this._escapeAttribute(this._label("item-contents-placeholder", "Soup, bolognese, ..."))}"
                ${actionsDisabled ? "disabled" : ""}
              ></ha-textfield>

              <ha-textfield
                id="item-compartment"
                type="number"
                label="${this._escapeAttribute(this._label("item-compartment-label", "Compartment"))}"
                ${actionsDisabled ? "disabled" : ""}
              ></ha-textfield>

              <div class="fm-actions">
                <mwc-button id="clear-form" ${actionsDisabled ? "disabled" : ""}>
                  ${this._escapeHtml(this._label("clear-form-button", "Clear"))}
                </mwc-button>
                <mwc-button id="save-item" class="action" ${actionsDisabled ? "disabled" : ""}>
                  ${this._escapeHtml(this.pending ? this._label("saving-button", "Saving...") : this._label("save-item-button", "Save"))}
                </mwc-button>
              </div>
            </div>

            ${
              this.sensorUnavailable
                ? `<div class="fm-footer-note">${this._escapeHtml(this._label("sensor-warning-readonly", "Editing is disabled until the contents sensor is available again."))}</div>`
                : ""
            }
          </div>

          <div class="fm-table-wrap">
            ${tableHtml}
          </div>
        </div>
      </ha-card>
    `;

    this._syncFieldValues();
    this._attachEventHandlers();
  }

  _renderTable() {
    return `
      <table class="fm-table">
        <thead>
          <tr>
            <th>${this._escapeHtml(this._getHeader("contents"))}</th>
            <th class="fm-number">${this._escapeHtml(this._getHeader("compartment"))}</th>
            <th class="fm-date">${this._escapeHtml(this._getHeader("date"))}</th>
            <th class="fm-action"></th>
          </tr>
        </thead>
        <tbody>
          ${this.items.map((item, index) => `
            <tr>
              <td class="fm-row-content">${this._escapeHtml(item.contents)}</td>
              <td class="fm-number">${this._escapeHtml(item.compartment || "")}</td>
              <td class="fm-date">${this._escapeHtml(item.date || "")}</td>
              <td class="fm-action">
                <ha-icon-button
                  data-delete-index="${index}"
                  title="${this._escapeAttribute(this._label("delete-item-label", "Delete item"))}"
                  aria-label="${this._escapeAttribute(this._label("delete-item-label", "Delete item"))}"
                  ${this.pending || this.sensorUnavailable ? "disabled" : ""}
                >
                  <ha-icon icon="mdi:delete"></ha-icon>
                </ha-icon-button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  _attachEventHandlers() {
    const root = this.shadowRoot;
    const contentsField = root.querySelector("#item-contents");
    const compartmentField = root.querySelector("#item-compartment");
    const saveButton = root.querySelector("#save-item");
    const clearButton = root.querySelector("#clear-form");

    for (const field of [contentsField, compartmentField]) {
      if (!field) {
        continue;
      }

      field.addEventListener("input", (event) => {
        const target = event.currentTarget;
        if (target === contentsField) {
          this.form.contents = target.value || "";
        } else if (target === compartmentField) {
          this.form.compartment = target.value || "";
        }
      });

      field.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this.handleSave();
        }
      });
    }

    saveButton?.addEventListener("click", () => this.handleSave());
    clearButton?.addEventListener("click", () => this.clearForm());

    root.querySelectorAll("[data-shortcut-index]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-shortcut-index"));
        const shortcuts = this._getShortcuts();
        this.form.contents = shortcuts[index] || "";
        this.errorMessage = "";
        this._syncFieldValues();
        compartmentField?.focus();
      });
    });

    root.querySelectorAll("[data-delete-index]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-delete-index"));
        this.handleDelete(index);
      });
    });
  }

  _syncFieldValues() {
    const root = this.shadowRoot;
    const contents = root.querySelector("#item-contents");
    const compartment = root.querySelector("#item-compartment");

    if (contents) {
      contents.value = this.form.contents;
    }
    if (compartment) {
      compartment.value = this.form.compartment;
    }
  }

  clearForm() {
    this.form = {
      contents: "",
      compartment: "",
    };
    this.errorMessage = "";
    this._syncFieldValues();
  }

  async handleSave() {
    if (this.pending || this.sensorUnavailable) {
      return;
    }

    const contents = String(this.form.contents || "").trim();
    if (!contents) {
      this.errorMessage = this._label("validation-missing-contents", "Enter contents before saving.");
      this.render();
      return;
    }

    const compartment = String(this.form.compartment || "").trim();
    const now = new Date();
    const newItem = {
      contents,
      compartment,
      date: this._formatDisplayDate(now.toISOString()),
      iso_date: now.toISOString(),
    };

    const nextItems = this._sortItems([newItem, ...this.items]);
    const saved = await this._persistItems(nextItems);

    if (saved) {
      this.items = nextItems;
      this.clearForm();
    }

    this.render();
  }

  async handleDelete(index) {
    if (this.pending || this.sensorUnavailable || Number.isNaN(index)) {
      return;
    }

    const nextItems = this.items.filter((_, itemIndex) => itemIndex !== index);
    const saved = await this._persistItems(nextItems);

    if (saved) {
      this.items = nextItems;
    }

    this.render();
  }

  async _persistItems(items) {
    if (!this._hass || !this.config) {
      return false;
    }

    const payload = {
      count: items.length,
      items,
    };

    this.pending = true;
    this.errorMessage = "";
    this.render();

    try {
      await this._hass.callService("notify", "send_message", {
        entity_id: this.config.contents_notify,
        message: JSON.stringify(payload),
      });

      await this._hass.callService("homeassistant", "update_entity", {
        entity_id: this.config.contents_sensor,
      });

      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Freezer Management card: could not persist items", error);
      this.errorMessage = this._label("save-error", "Could not save freezer contents.");
      return false;
    } finally {
      this.pending = false;
    }
  }

  _parseItems(sensorState) {
    if (!sensorState || sensorState.state === "unavailable" || sensorState.state === "unknown") {
      this.sensorUnavailable = true;
      return [];
    }

    this.sensorUnavailable = false;

    const rawItems = Array.isArray(sensorState.attributes?.items)
      ? sensorState.attributes.items
      : [];

    return this._sortItems(
      rawItems
        .map((item) => this._normalizeItem(item))
        .filter((item) => item.contents)
    );
  }

  _normalizeItem(item) {
    const contents = String(item?.contents ?? item?.potContents ?? "").trim();
    const compartment = String(item?.compartment ?? item?.potCompartment ?? "").trim();

    const rawIso = item?.iso_date ?? item?.isoDate ?? item?.potIsoDate ?? "";
    const hasValidIso = typeof rawIso === "string" && rawIso !== "/" && !Number.isNaN(Date.parse(rawIso));
    const iso_date = hasValidIso ? rawIso : "";

    const date = String(
      item?.date ??
      item?.potDate ??
      (iso_date ? this._formatDisplayDate(iso_date) : "")
    ).trim();

    return {
      contents,
      compartment,
      date,
      iso_date,
    };
  }

  _sortItems(items) {
    const collator = new Intl.Collator(this._getLanguage(), {
      numeric: true,
      sensitivity: "base",
    });

    const sortBy = this.config?.sort_by || "compartment";

    return [...items].sort((left, right) => {
      if (sortBy === "newest") {
        return (right.iso_date || "").localeCompare(left.iso_date || "");
      }

      if (sortBy === "oldest") {
        return (left.iso_date || "").localeCompare(right.iso_date || "");
      }

      if (sortBy === "contents") {
        return (
          collator.compare(left.contents || "", right.contents || "") ||
          (right.iso_date || "").localeCompare(left.iso_date || "") ||
          collator.compare(left.compartment || "", right.compartment || "")
        );
      }

      return (
        collator.compare(left.compartment || "", right.compartment || "") ||
        collator.compare(left.contents || "", right.contents || "") ||
        (right.iso_date || "").localeCompare(left.iso_date || "")
      );
    });
  }

  _getShortcuts() {
    const values = new Map();

    for (const item of this.config?.shortcuts || []) {
      const value = String(item || "").trim();
      if (!value) {
        continue;
      }
      const key = value.toLocaleLowerCase(this._getLanguage());
      if (!values.has(key)) {
        values.set(key, value);
      }
    }

    for (const item of this.items) {
      const value = String(item.contents || "").trim();
      if (!value) {
        continue;
      }
      const key = value.toLocaleLowerCase(this._getLanguage());
      if (!values.has(key)) {
        values.set(key, value);
      }
    }

    return [...values.values()].sort((left, right) =>
      left.localeCompare(right, this._getLanguage(), { sensitivity: "base" })
    );
  }

  _getHeader(key) {
    if (key === "contents") {
      return String(this.config?.contents_header || "").trim() || this._label("table-header-contents", "Contents");
    }
    if (key === "compartment") {
      return String(this.config?.compartment_header || "").trim() || this._label("table-header-compartment", "Cmp");
    }
    if (key === "date") {
      return String(this.config?.date_header || "").trim() || this._label("table-header-date", "Date");
    }
    return "";
  }

  _formatDisplayDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString(this._getLanguage(), {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  _normalizeConfig(config) {
    if (!config || typeof config !== "object") {
      throw new Error("Invalid configuration.");
    }

    const contentsNotify = String(config.contents_notify || "").trim();
    if (!contentsNotify) {
      throw new Error('Please provide a "contents_notify" attribute that points to your notify entity.');
    }
    if (!contentsNotify.startsWith("notify.")) {
      throw new Error('The notify entity should start with "notify."');
    }

    const contentsSensor = String(config.contents_sensor || "").trim();
    if (!contentsSensor) {
      throw new Error('Please provide a "contents_sensor" attribute that points to the sensor holding your freezer contents.');
    }
    if (!contentsSensor.startsWith("sensor.")) {
      throw new Error('The contents sensor should start with "sensor."');
    }

    const sortBy = SORT_OPTIONS.includes(config.sort_by) ? config.sort_by : "compartment";

    return {
      title: String(config.title || "").trim(),
      contents_notify: contentsNotify,
      contents_sensor: contentsSensor,
      shortcuts: Array.isArray(config.shortcuts)
        ? config.shortcuts.map((item) => String(item || "").trim()).filter(Boolean)
        : [],
      sort_by: sortBy,
      show_shortcuts: config.show_shortcuts !== false,
      contents_header: String(config.contents_header || "").trim(),
      compartment_header: String(config.compartment_header || "").trim(),
      date_header: String(config.date_header || "").trim(),
    };
  }

  _getLanguage() {
    const lang = this._hass?.selectedLanguage || this._hass?.language || "en";
    const normalized = lang in Resources ? lang : lang.split("-")[0];
    return normalized in Resources ? normalized : "en";
  }

  _label(label, fallback = "unknown") {
    const language = this._getLanguage();
    const resources = Resources[language] || Resources.en;
    return resources?.[label] || Resources.en?.[label] || fallback;
  }

  _escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  _escapeAttribute(value) {
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
    if (!this.shadowRoot) {
      return;
    }

    const config = {
      ...FreezerManagementCard.getStubConfig(),
      ...this._config,
    };

    const notifyEntities = this._entityIdsByDomain("notify");
    const sensorEntities = this._entityIdsByDomain("sensor");
    const shortcutsText = Array.isArray(config.shortcuts) ? config.shortcuts.join("\n") : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .editor {
          display: grid;
          gap: 16px;
        }

        .section {
          display: grid;
          gap: 12px;
          padding: 16px;
          border-radius: 12px;
          background: var(--secondary-background-color);
        }

        .section-title {
          font-weight: 600;
        }

        .grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }

        label {
          display: grid;
          gap: 6px;
          font-size: 0.95rem;
        }

        input,
        select,
        textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 12px;
          border: 1px solid var(--divider-color);
          border-radius: 10px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font: inherit;
        }

        textarea {
          min-height: 120px;
          resize: vertical;
        }

        .checkbox {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.95rem;
        }

        .checkbox input {
          width: auto;
        }

        .hint {
          font-size: 0.85rem;
          color: var(--secondary-text-color);
        }
      </style>

      <div class="editor">
        <div class="section">
          <div class="section-title">Connection</div>
          <div class="grid">
            <label>
              <span>Title</span>
              <input data-field="title" type="text" value="${this._escape(config.title || "")}" />
            </label>

            <label>
              <span>Notify entity</span>
              <input
                data-field="contents_notify"
                type="text"
                list="notify-entities"
                value="${this._escape(config.contents_notify || "")}"
                placeholder="notify.freezer_contents"
              />
              <datalist id="notify-entities">
                ${notifyEntities.map((entityId) => `<option value="${this._escape(entityId)}"></option>`).join("")}
              </datalist>
            </label>

            <label>
              <span>Contents sensor</span>
              <input
                data-field="contents_sensor"
                type="text"
                list="sensor-entities"
                value="${this._escape(config.contents_sensor || "")}"
                placeholder="sensor.freezer_contents"
              />
              <datalist id="sensor-entities">
                ${sensorEntities.map((entityId) => `<option value="${this._escape(entityId)}"></option>`).join("")}
              </datalist>
            </label>

            <label>
              <span>Sort by</span>
              <select data-field="sort_by">
                ${SORT_OPTIONS.map((option) => `
                  <option value="${option}" ${config.sort_by === option ? "selected" : ""}>${option}</option>
                `).join("")}
              </select>
            </label>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Table headers</div>
          <div class="grid">
            <label>
              <span>Contents header</span>
              <input data-field="contents_header" type="text" value="${this._escape(config.contents_header || "")}" />
            </label>

            <label>
              <span>Compartment header</span>
              <input data-field="compartment_header" type="text" value="${this._escape(config.compartment_header || "")}" />
            </label>

            <label>
              <span>Date header</span>
              <input data-field="date_header" type="text" value="${this._escape(config.date_header || "")}" />
            </label>
          </div>
          <div class="hint">Leave a field empty to use the built-in translation.</div>
        </div>

        <div class="section">
          <div class="section-title">Shortcuts</div>
          <label class="checkbox">
            <input data-field="show_shortcuts" type="checkbox" ${config.show_shortcuts !== false ? "checked" : ""} />
            <span>Show shortcuts</span>
          </label>

          <label>
            <span>Shortcut values</span>
            <textarea data-field="shortcuts" placeholder="One shortcut per line">${this._escape(shortcutsText)}</textarea>
          </label>
          <div class="hint">One entry per line. These become quick-fill buttons in the card.</div>
        </div>
      </div>
    `;

    this.shadowRoot.querySelectorAll("[data-field]").forEach((element) => {
      const eventName = element.tagName === "SELECT" || element.type === "checkbox" ? "change" : "input";
      element.addEventListener(eventName, (event) => this._handleValueChanged(event));
    });
  }

  _handleValueChanged(event) {
    const target = event.currentTarget;
    const field = target.dataset.field;
    if (!field) {
      return;
    }

    const nextConfig = {
      ...this._config,
    };

    if (field === "show_shortcuts") {
      nextConfig.show_shortcuts = Boolean(target.checked);
    } else if (field === "shortcuts") {
      nextConfig.shortcuts = String(target.value || "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
    } else {
      nextConfig[field] = String(target.value || "");
    }

    this._config = this._cleanupConfig(nextConfig);
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
  }

  _cleanupConfig(config) {
    const cleaned = {
      ...config,
      shortcuts: Array.isArray(config.shortcuts) ? config.shortcuts : [],
      sort_by: SORT_OPTIONS.includes(config.sort_by) ? config.sort_by : "compartment",
      show_shortcuts: config.show_shortcuts !== false,
    };

    for (const key of ["title", "contents_header", "compartment_header", "date_header"]) {
      if (!String(cleaned[key] || "").trim()) {
        delete cleaned[key];
      } else {
        cleaned[key] = String(cleaned[key]).trim();
      }
    }

    cleaned.contents_notify = String(cleaned.contents_notify || "").trim();
    cleaned.contents_sensor = String(cleaned.contents_sensor || "").trim();

    if (!cleaned.shortcuts.length) {
      delete cleaned.shortcuts;
    }

    if (cleaned.show_shortcuts === true) {
      delete cleaned.show_shortcuts;
    }

    if (cleaned.sort_by === "compartment") {
      delete cleaned.sort_by;
    }

    return cleaned;
  }

  _entityIdsByDomain(domain) {
    if (!this._hass?.states) {
      return [];
    }

    return Object.keys(this._hass.states)
      .filter((entityId) => entityId.startsWith(`${domain}.`))
      .sort((left, right) => left.localeCompare(right));
  }

  _escape(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
}

if (!customElements.get(CARD_TYPE)) {
  customElements.define(CARD_TYPE, FreezerManagementCard);
}

if (!customElements.get("freezer-management-card-editor")) {
  customElements.define("freezer-management-card-editor", FreezerManagementCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === CARD_TYPE)) {
  window.customCards.push({
    type: CARD_TYPE,
    name: CARD_NAME,
    description: "Freezer inventory card with compartment-only grouping and an inline add form.",
    preview: true,
  });
}

// eslint-disable-next-line no-console
console.info(
  `%c ${CARD_NAME} %c v${CARD_VERSION} `,
  "color: white; background: #03a9f4; font-weight: 700;",
  "color: #03a9f4; background: white; font-weight: 700;"
);
