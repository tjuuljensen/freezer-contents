# Simple Freezer Management Card

A simplified rewrite of the original freezer management card for Home Assistant.

## Credit

This project is based on the original **Freezer Management** card by **Ronald Dehuysser** (`rdehuyss`), shared on the Home Assistant Community forum and published on GitHub.  
This rewrite keeps the core idea and storage model, but removes the original multi-step overlay flow in favor of a simpler inline form.

## What changed

- Removed the multi-step add flow and replaced it with one inline form.
- Kept the same storage model (`potContents`, `potNumber`, `potCompartment`, `potDate`, `potIsoDate`) so the card stays simple and the JSON structure remains predictable.
- Fixed the original bug where the card always wrote to `notify.diepvries` instead of the configured `contents_notify`.
- Added Danish translations in `freezer-management-resources.js`.
- Added a few optional config values:
  - `title`
  - `sort_by`: `contents`, `newest`, `oldest`, `compartment`
  - `show_shortcuts`: `true` or `false`

## Install

### Manual installation

Copy these files to your Home Assistant `www` folder:

- `freezer-management-card.js`
- `freezer-management-resources.js`

Then add the resource in Lovelace:

```yaml
resources:
  - url: /local/freezer-management-card.js?v=0.3
    type: module
```

### HACS custom repository

This can be packaged as a HACS **Dashboard** repository.

Recommended repository layout:

```text
freezer-management-card/
  README.md
  hacs.json
  freezer-management-card.js
  freezer-management-resources.js
```

Example `hacs.json`:

```json
{
  "name": "Simple Freezer Management Card",
  "content_in_root": true,
  "filename": "freezer-management-card.js",
  "render_readme": true
}
```

Recommended repository name:

- `freezer-management-card`
- or `lovelace-freezer-management-card`

That matches HACS dashboard/plugin discovery rules best because the repository name should match the main `.js` file name, with the usual `lovelace-` prefix exception.

After publishing the repository on GitHub:

1. Add it in HACS as a **Dashboard** repository.
2. Install it from HACS.
3. Refresh the browser cache if Home Assistant still shows the previous bundle.
4. Add the card as `type: custom:freezer-management-card`.

## Card config

```yaml
type: custom:freezer-management-card
title: Fryser
contents_notify: notify.freezer_contents
contents_sensor: sensor.freezer_contents
sort_by: compartment
show_shortcuts: true
shortcuts:
  - Bolognese sauce
  - Vegetable soup
  - Tomato soup
  - Vol-au-vent
  - Lasagna
```

## Backend prerequisites

This version still uses the original backend pattern with a file notify service and a `command_line` sensor.

```yaml
notify:
  - name: freezer_contents
    platform: file
    filename: ./freezer-contents.json

sensor:
  - platform: command_line
    name: freezer_contents
    json_attributes:
      - count
      - items
    command: "tail -1 /config/freezer-contents.json"
    value_template: "{{ value_json.count }}"
```

## Notes on integration quality

This works, but it is still using a frontend card to write JSON through a notify service. That is fine for a lightweight custom card, but it is not the cleanest long-term Home Assistant architecture.

A more HA-native next step would be a small custom integration that:

- stores items with `Store` / storage-backed data instead of `notify.file`
- exposes services like `freezer_management.add_item` and `freezer_management.remove_item`
- provides one or more entities for counts, diagnostics, or summaries
- optionally provides a websocket/API layer so the card does not need to manually serialize JSON itself

## Future improvements

### Frontend improvements

- Rewrite the card in **Lit + TypeScript** for cleaner rendering and easier maintenance.
- Add a visual config editor with `getConfigElement()` and `getStubConfig()` so it integrates better with the Home Assistant dashboard editor.
- Add filter/search controls for large freezers.
- Add optional grouping by compartment or contents.
- Add duplicate detection or merge behavior for repeated entries.
- Add optional expiration / best-before date support.

### Home Assistant architecture improvements

- Replace the file-notify + command_line pattern with a real custom integration.
- Add services so items can also be added from automations, voice assistants, NFC tags, or scripts.
- Add diagnostics or meta-sensors, for example:
  - total item count
  - per-compartment count
  - oldest item age
  - stale backend detection if the data file stops updating
- Add translations through HA frontend localization conventions if the card grows further.

### Reliability improvements

- Add validation for duplicate container numbers.
- Add optimistic UI rollback handling if the save fails.
- Add better unavailable / malformed JSON handling in the card UI.
- Add automated linting and release packaging for GitHub + HACS publishing.

## Troubleshooting

### The card loads but no data appears

Check:

- `contents_sensor` exists and updates
- the sensor contains `items` in its attributes
- the `notify` target matches the configured `contents_notify`
- `/config/freezer-contents.json` is writable by Home Assistant

### The card is installed but does not update in the browser

Clear browser cache or force refresh after replacing the JS modules.

### The save button fails

Open the browser console and verify:

- the `notify` service exists
- the JSON file path is valid
- the `command_line` sensor can read the latest written line
