# Freezer Management Card

A simplified custom Home Assistant card for tracking freezer contents with **compartment-only grouping**.

## Credit

This project is based on the original **Freezer Management** card by **Ronald Dehuysser** (`rdehuyss`), first shared on the Home Assistant Community forum and published on GitHub. This rewrite keeps the core idea while removing the original multi-step overlay and the old container/pot layer entirely. citeturn349122search0turn583930view3

## What this version changes

- Removes the original add overlay and uses a single inline form.
- Removes the old `pot` / container number layer from the UI and the new write model.
- Uses the modern `notify.send_message` action pattern against a `notify` entity instead of calling legacy-style notify services directly. citeturn227873search1turn410960search5
- Adds configurable table headers for contents, compartment, and date.
- Adds `getConfigElement()` and `getStubConfig()` so the card can be configured in the dashboard editor. Home Assistant documents both methods as the way custom cards expose graphical configuration. citeturn778427view0
- Ships as a HACS-ready Dashboard/plugin repository with a release workflow and HACS validation workflow. HACS expects plugin repositories to expose matching `.js` files in `dist/` or the repo root, and its own docs provide a validation workflow using `hacs/action`. citeturn522400search0turn778427view1

## Repository layout

```text
freezer-management-card/
  dist/
    freezer-management-card.js
    freezer-management-resources.js
  .github/
    workflows/
      release.yml
      validate.yml
  CHANGELOG.md
  LICENSE
  README.md
  hacs.json
```

## Installation

### HACS

1. Add this repository as a **Dashboard** custom repository in HACS.
2. Install **Freezer Management Card**.
3. Refresh your browser cache.
4. Add the card as `type: custom:freezer-management-card`.

HACS plugin repositories can place their JavaScript files in `dist/`, and one of those files must match the repository name, with the normal `lovelace-` naming exception. citeturn522400search0

### Manual installation

1. Copy the two files from `dist/` into your Home Assistant `www/` folder.
2. Add the resource:

```yaml
resources:
  - url: /local/freezer-management-card.js
    type: module
```

## Card configuration

### YAML example

```yaml
type: custom:freezer-management-card
title: Fryser
contents_notify: notify.freezer_contents
contents_sensor: sensor.freezer_contents
sort_by: compartment
contents_header: Indhold
compartment_header: Rum
date_header: Dato
show_shortcuts: true
shortcuts:
  - Bolognese
  - Grøntsagssuppe
  - Lasagne
```

### Configuration options

| Option | Required | Description |
|---|---:|---|
| `contents_notify` | Yes | The `notify` entity used for persistence, for example `notify.freezer_contents`. |
| `contents_sensor` | Yes | The sensor that exposes the JSON payload through its `items` attribute. |
| `title` | No | Card title. |
| `sort_by` | No | `compartment`, `newest`, `oldest`, or `contents`. Defaults to `compartment`. |
| `contents_header` | No | Override the first table header. |
| `compartment_header` | No | Override the second table header. |
| `date_header` | No | Override the date table header. |
| `show_shortcuts` | No | Show or hide shortcut buttons. Defaults to `true`. |
| `shortcuts` | No | List of preset contents values. |

## Backend setup

This card still uses a lightweight file-backed pattern, but it is updated for Home Assistant's modern notify model:

- Create a **File** integration entry in **Settings → Devices & services**.
- Add a **notification** target that writes to `/config/freezer-contents.json`.
- Use the resulting notify entity as `contents_notify`.
- Add `/config` or a narrower directory to `allowlist_external_dirs`.
- Keep a sensor that reads the last line of that JSON file so the card can load the inventory. The File integration documents UI setup for file notifications and notes that writes require `allowlist_external_dirs`. It also documents `notify.send_message` for storing notification messages. citeturn285040view0turn227873search1

### Example backend YAML

```yaml
homeassistant:
  allowlist_external_dirs:
    - /config

sensor:
  - platform: command_line
    name: freezer_contents
    json_attributes:
      - count
      - items
    command: "tail -1 /config/freezer-contents.json"
    value_template: "{{ value_json.count }}"
```

### Example service test

This is the modern notify pattern the card now uses internally:

```yaml
action: notify.send_message
data:
  entity_id: notify.freezer_contents
  message: '{"count":0,"items":[]}'
```

Home Assistant's notify documentation describes `notify.send_message` as the entity-platform action for notify entities, and the File integration documents using it to store notification messages. citeturn227873search1turn285040view0

## Notes about the data model

New writes use this simplified item shape:

```json
{
  "count": 2,
  "items": [
    {
      "contents": "Bolognese",
      "compartment": "2",
      "date": "30 Apr 2026",
      "iso_date": "2026-04-30T12:34:56.000Z"
    }
  ]
}
```

The card still reads older `potContents` / `potCompartment` data if it finds it, but all new saves use the simplified model.

## Dashboard editor support

The card now exposes a graphical editor through `getConfigElement()` and a starter configuration through `getStubConfig()`. Home Assistant documents both hooks for custom card editors and the card picker flow. citeturn778427view0

## Release and validation workflows

- `.github/workflows/validate.yml` runs the HACS validator using the documented `plugin` category. citeturn778427view1
- `.github/workflows/release.yml` creates a GitHub release when you push a version tag like `v0.4.0`. GitHub releases are what HACS uses for the remote version when a repository publishes releases. citeturn522400search1turn778427view1

## Future improvements

### Architecture

- Replace the file + sensor persistence chain with a tiny custom integration that stores data with Home Assistant storage helpers instead of serializing JSON through a notify entity.
- Expose services like `freezer_management.add_item`, `freezer_management.remove_item`, and a storage-backed summary entity.
- Add diagnostics or a health sensor so the UI can show stale or unreadable storage cleanly.

### Frontend

- Rewrite the card in Lit + TypeScript for better rendering, state handling, and editor maintainability.
- Add filter/search controls and optional compartment grouping.
- Add import/export actions for freezer inventories.
- Add optimistic updates with rollback when persistence fails.
- Add optional quantity, tags, or expiry metadata as a deliberate second-generation schema instead of reintroducing the old container layer.

## Development notes

- The card disables edits while the backing sensor is unavailable to avoid overwriting unknown state.
- `dist/freezer-management-card.js` is the file HACS should serve.
- `hacs.json` is configured for a Dashboard/plugin repository. HACS requires that file in the repository root. citeturn458439search0turn522400search0
