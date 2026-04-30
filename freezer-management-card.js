import Resources from './freezer-management-resources.js?v=0.3';

class FreezerManagementCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this.config = null;
    this.items = [];
    this.form = {
      contents: '',
      number: '',
      compartment: '',
    };
    this.errorMessage = '';
    this.pending = false;
    this.sensorUnavailable = false;
    this._lastLanguage = null;
    this._lastSensorState = null;
  }

  async setConfig(config) {
    if (!config.contents_notify) {
      throw new Error('Please provide a "contents_notify" attribute that points to your file notify service.');
    }

    if (!String(config.contents_notify).startsWith('notify.')) {
      throw new Error('The notify file should start with "notify."');
    }

    if (!config.contents_sensor) {
      throw new Error('Please provide a "contents_sensor" attribute that points to the sensor holding your freezer contents.');
    }

    if (!String(config.contents_sensor).startsWith('sensor.')) {
      throw new Error('The contents sensor should start with "sensor."');
    }

    this.config = {
      title: config.title,
      contents_notify: config.contents_notify,
      contents_sensor: config.contents_sensor,
      shortcuts: Array.isArray(config.shortcuts) ? config.shortcuts : [],
      sort_by: config.sort_by || 'contents',
      show_shortcuts: config.show_shortcuts !== false,
    };

    this.style.display = 'block';
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.refreshFromHass();
  }

  refreshFromHass() {
    if (!this.config) {
      return;
    }

    const sensorState = this._hass?.states?.[this.config.contents_sensor] ?? null;
    const language = this._getLanguage();

    if (
      this._lastSensorState !== sensorState ||
      this._lastLanguage !== language
    ) {
      this._lastSensorState = sensorState;
      this._lastLanguage = language;
      this.items = this._parseItems(sensorState);
      this.render();
      return;
    }

    if (!this.innerHTML) {
      this.render();
    }
  }

  getCardSize() {
    return Math.max(3, Math.ceil((this.items.length + 4) / 4));
  }

  render() {
    if (!this.config) {
      return;
    }

    const title = this.config.title || this._label('card-title', 'Freezer Management');
    const shortcuts = this._getShortcuts();
    const tableHtml = this.items.length > 0
      ? this._renderTable()
      : `<div class="fm-empty">${this._escapeHtml(this._label('freezer-empty', 'No items saved yet.'))}</div>`;

    const statusParts = [];
    if (this.sensorUnavailable) {
      statusParts.push(this._label('sensor-unavailable', 'The contents sensor is unavailable.'));
    } else {
      statusParts.push(`${this._label('status-items', 'Items')}: ${this.items.length}`);
    }
    if (this.errorMessage) {
      statusParts.push(this.errorMessage);
    }

    this.innerHTML = `
      <ha-card header="${this._escapeAttribute(title)}">
        <div class="card-content fm-card">
          <style>
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
              grid-template-columns: minmax(0, 2fr) minmax(120px, 1fr) minmax(120px, 1fr) auto;
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

            @media (max-width: 800px) {
              .fm-form {
                grid-template-columns: 1fr;
              }

              .fm-actions {
                justify-content: stretch;
              }
            }
          </style>

          <div class="fm-panel">
            <div class="fm-panel-header">
              <div class="fm-panel-title">${this._escapeHtml(this._label('form-title', 'Add freezer item'))}</div>
              <div class="fm-status">${this._escapeHtml(statusParts.join(' · '))}</div>
            </div>

            ${
              this.config.show_shortcuts && shortcuts.length > 0
                ? `
                  <div class="fm-shortcuts" id="shortcut-list">
                    ${shortcuts
                      .map(
                        (shortcut, index) => `
                          <mwc-button
                            class="action"
                            data-shortcut-index="${index}"
                          >${this._escapeHtml(shortcut)}</mwc-button>
                        `
                      )
                      .join('')}
                  </div>
                `
                : ''
            }

            <div class="fm-form">
              <ha-textfield
                id="item-contents"
                type="text"
                label="${this._escapeAttribute(this._label('item-contents-label', 'Contents'))}"
                placeholder="${this._escapeAttribute(this._label('item-contents-placeholder', 'Soup, bolognese, ...'))}"
              ></ha-textfield>

              <ha-textfield
                id="item-number"
                type="number"
                label="${this._escapeAttribute(this._label('item-number-label', 'Container #'))}"
              ></ha-textfield>

              <ha-textfield
                id="item-compartment"
                type="number"
                label="${this._escapeAttribute(this._label('item-compartment-label', 'Compartment #'))}"
              ></ha-textfield>

              <div class="fm-actions">
                <mwc-button id="clear-form">${this._escapeHtml(this._label('clear-form-button', 'Clear'))}</mwc-button>
                <mwc-button id="save-item" class="action" ${this.pending ? 'disabled' : ''}>
                  ${this._escapeHtml(this.pending ? this._label('saving-button', 'Saving...') : this._label('save-item-button', 'Save'))}
                </mwc-button>
              </div>
            </div>
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
            <th>${this._escapeHtml(this._label('food-table-container-contents', 'Contents'))}</th>
            <th class="fm-number">${this._escapeHtml(this._label('food-table-container-number', 'Cnt #'))}</th>
            <th class="fm-number">${this._escapeHtml(this._label('food-table-compartment-number', 'Cmp #'))}</th>
            <th class="fm-date">${this._escapeHtml(this._label('food-table-container-date', 'Date'))}</th>
            <th class="fm-action"></th>
          </tr>
        </thead>
        <tbody>
          ${this.items
            .map(
              (item, index) => `
                <tr>
                  <td class="fm-row-content">${this._escapeHtml(item.potContents)}</td>
                  <td class="fm-number">${this._escapeHtml(item.potNumber || '')}</td>
                  <td class="fm-number">${this._escapeHtml(item.potCompartment || '')}</td>
                  <td class="fm-date">${this._escapeHtml(item.potDate || '')}</td>
                  <td class="fm-action">
                    <ha-icon-button
                      data-delete-index="${index}"
                      title="${this._escapeAttribute(this._label('delete-item-label', 'Delete item'))}"
                      aria-label="${this._escapeAttribute(this._label('delete-item-label', 'Delete item'))}"
                    >
                      <ha-icon icon="mdi:delete"></ha-icon>
                    </ha-icon-button>
                  </td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  _syncFieldValues() {
    const contents = this.querySelector('#item-contents');
    const number = this.querySelector('#item-number');
    const compartment = this.querySelector('#item-compartment');

    if (contents) {
      contents.value = this.form.contents;
    }
    if (number) {
      number.value = this.form.number;
    }
    if (compartment) {
      compartment.value = this.form.compartment;
    }
  }

  _attachEventHandlers() {
    const contentsField = this.querySelector('#item-contents');
    const numberField = this.querySelector('#item-number');
    const compartmentField = this.querySelector('#item-compartment');
    const saveButton = this.querySelector('#save-item');
    const clearButton = this.querySelector('#clear-form');

    for (const field of [contentsField, numberField, compartmentField]) {
      if (!field) {
        continue;
      }

      field.addEventListener('input', (event) => {
        if (event.currentTarget === contentsField) {
          this.form.contents = event.currentTarget.value || '';
        } else if (event.currentTarget === numberField) {
          this.form.number = event.currentTarget.value || '';
        } else if (event.currentTarget === compartmentField) {
          this.form.compartment = event.currentTarget.value || '';
        }
      });

      field.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          this.handleSave();
        }
      });
    }

    if (saveButton) {
      saveButton.addEventListener('click', () => this.handleSave());
    }

    if (clearButton) {
      clearButton.addEventListener('click', () => this.clearForm());
    }

    this.querySelectorAll('[data-shortcut-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.getAttribute('data-shortcut-index'));
        const shortcuts = this._getShortcuts();
        this.form.contents = shortcuts[index] || '';
        this.errorMessage = '';
        this._syncFieldValues();
        numberField?.focus();
      });
    });

    this.querySelectorAll('[data-delete-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.getAttribute('data-delete-index'));
        this.handleDelete(index);
      });
    });
  }

  clearForm() {
    this.form = {
      contents: '',
      number: '',
      compartment: '',
    };
    this.errorMessage = '';
    this._syncFieldValues();
  }

  async handleSave() {
    if (this.pending) {
      return;
    }

    const potContents = String(this.form.contents || '').trim();
    if (!potContents) {
      this.errorMessage = this._label('validation-missing-contents', 'Enter contents before saving.');
      this.render();
      return;
    }

    const now = new Date();
    const newItem = {
      potContents,
      potNumber: String(this.form.number || '').trim(),
      potCompartment: String(this.form.compartment || '').trim(),
      potDate: this._formatDisplayDate(now.toISOString()),
      potIsoDate: now.toISOString(),
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
    if (this.pending || Number.isNaN(index)) {
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

    const [domain, service] = String(this.config.contents_notify).split('.', 2);
    const payload = {
      count: items.length,
      items,
    };

    this.pending = true;
    this.errorMessage = '';
    this.render();

    try {
      await this._hass.callService(domain, service, {
        message: JSON.stringify(payload),
      });

      await this._hass.callService('homeassistant', 'update_entity', {
        entity_id: this.config.contents_sensor,
      });

      return true;
    } catch (error) {
      console.error('Freezer Management card: could not persist items', error);
      this.errorMessage = this._label('save-error', 'Could not save freezer contents.');
      return false;
    } finally {
      this.pending = false;
    }
  }

  _parseItems(sensorState) {
    if (!sensorState || sensorState.state === 'unavailable' || sensorState.state === 'unknown') {
      this.sensorUnavailable = true;
      return [];
    }

    this.sensorUnavailable = false;

    const rawItems = Array.isArray(sensorState.attributes?.items)
      ? sensorState.attributes.items
      : [];

    const normalizedItems = rawItems
      .map((item) => this._normalizeItem(item))
      .filter((item) => item.potContents);

    return this._sortItems(normalizedItems);
  }

  _normalizeItem(item) {
    const potContents = String(item?.potContents ?? item?.contents ?? '').trim();
    const potNumber = String(item?.potNumber ?? item?.number ?? '').trim();
    const potCompartment = String(item?.potCompartment ?? item?.compartment ?? '').trim();

    const rawIso = item?.potIsoDate ?? item?.isoDate ?? '';
    const hasValidIso = typeof rawIso === 'string' && rawIso !== '/' && !Number.isNaN(Date.parse(rawIso));
    const potIsoDate = hasValidIso ? rawIso : '';
    const potDate = String(
      item?.potDate ??
      item?.date ??
      (potIsoDate ? this._formatDisplayDate(potIsoDate) : '')
    ).trim();

    return {
      potContents,
      potNumber,
      potCompartment,
      potDate,
      potIsoDate,
    };
  }

  _sortItems(items) {
    const collator = new Intl.Collator(this._getLanguage(), {
      numeric: true,
      sensitivity: 'base',
    });

    const sortBy = this.config?.sort_by || 'contents';

    return [...items].sort((left, right) => {
      if (sortBy === 'newest') {
        return (right.potIsoDate || '').localeCompare(left.potIsoDate || '');
      }

      if (sortBy === 'oldest') {
        return (left.potIsoDate || '').localeCompare(right.potIsoDate || '');
      }

      if (sortBy === 'compartment') {
        return (
          collator.compare(left.potCompartment || '', right.potCompartment || '') ||
          collator.compare(left.potNumber || '', right.potNumber || '') ||
          collator.compare(left.potContents || '', right.potContents || '') ||
          (right.potIsoDate || '').localeCompare(left.potIsoDate || '')
        );
      }

      return (
        collator.compare(left.potContents || '', right.potContents || '') ||
        (right.potIsoDate || '').localeCompare(left.potIsoDate || '') ||
        collator.compare(left.potCompartment || '', right.potCompartment || '') ||
        collator.compare(left.potNumber || '', right.potNumber || '')
      );
    });
  }

  _getShortcuts() {
    const values = new Map();

    for (const item of this.config?.shortcuts || []) {
      const value = String(item || '').trim();
      if (!value) {
        continue;
      }
      const key = value.toLocaleLowerCase(this._getLanguage());
      if (!values.has(key)) {
        values.set(key, value);
      }
    }

    for (const item of this.items) {
      const value = String(item.potContents || '').trim();
      if (!value) {
        continue;
      }
      const key = value.toLocaleLowerCase(this._getLanguage());
      if (!values.has(key)) {
        values.set(key, value);
      }
    }

    return [...values.values()].sort((left, right) =>
      left.localeCompare(right, this._getLanguage(), { sensitivity: 'base' })
    );
  }

  _formatDisplayDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleDateString(this._getLanguage(), {
      day: 'numeric',
      month: 'short',
    });
  }

  _getLanguage() {
    const lang = this._hass?.selectedLanguage || this._hass?.language || 'en';
    return lang in Resources ? lang : lang.split('-')[0];
  }

  _label(label, fallback = 'unknown') {
    const language = this._getLanguage();
    const resources = Resources[language] || Resources.en;
    return resources?.[label] || Resources.en?.[label] || fallback;
  }

  _escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  _escapeAttribute(value) {
    return this._escapeHtml(value);
  }

  static getStubConfig() {
    return {
      type: 'custom:freezer-management-card',
      contents_notify: 'notify.diepvries',
      contents_sensor: 'sensor.diepvries_contents',
      shortcuts: [],
    };
  }
}

customElements.define('freezer-management-card', FreezerManagementCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'freezer-management-card',
  name: 'Freezer Management Card',
  description: 'Simple freezer inventory card without the multi-step add overlay.',
});
