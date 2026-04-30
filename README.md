# Freezer Management

![Freezer Management logo](custom_components/freezer_management/brand/logo.png)

A storage-backed Home Assistant companion integration plus custom dashboard card for tracking freezer contents with compartment-based organization.

## What changed in this release

- 1.1.2 hotfix: fixed add/delete/clear service execution, stabilized the card editor focus behavior, and simplified the form layout to avoid overlapping fields and wrapping buttons.

- 1.1.1 frontend hotfix: made the item input field wider and more stable in narrower dashboard sections.

- Fixed add/delete/clear actions by moving the integration to stable manual service registration.
- Renamed the item schema:
  - `potContents` → `item`
  - `potNumber` → `packagingType`
  - `potCompartment` → `freezerCompartment`
  - `potDate` → `storageDate`
  - `potIsoDate` → `storageIsoDate`
- Added `packagingType` to the integration, card form, and card overview table.
- Updated the card editor and card rendering to default to full-width section placement with:
  - `grid_options.columns: 12`
  - `grid_options.rows: 5`
- Fixed the card editor focus issue for shortcut editing.
- Removed the “card on top of card” styling from the upper form area.

## Installation

1. Copy `custom_components/freezer_management` into your Home Assistant config.
2. Restart Home Assistant.
3. Add the integration in **Settings → Devices & services**.
4. Add the dashboard resource:

```yaml
resources:
  - url: /api/freezer_management/static/freezer-management-card.js
    type: module
```

## Card example

```yaml
type: custom:freezer-management-card
entity: sensor.main_freezer_inventory
title: Fryser
sort_by: freezerCompartment
item_header: Indhold
packaging_header: Emballage
compartment_header: Rum
date_header: Dato
show_shortcuts: true
shortcuts:
  - Rødspættefilet
  - Sorte bønner
```

## Resetting old contents fully

If the card still shows old contents, it is usually one of these:

1. You selected the old file-backed sensor instead of the new integration sensor.
2. The old file-backed YAML sensor still exists.
3. The integration store already contains imported or old test data.

Use this checklist:

### A. Make sure the card uses the new integration entity

Use the sensor created by the integration, for example:

```yaml
entity: sensor.main_freezer_inventory
```

### B. Remove old file-backed entities

Delete or disable the old `notify.file` / `command_line` / JSON sensor configuration so it does not remain selectable or visible.

### C. Clear the new integration inventory

```yaml
action: freezer_management.clear_inventory
data:
  entity_id: sensor.main_freezer_inventory
```

## Credits

- Original concept and card by Ronald Dehuysser (`rdehuyss`): https://community.home-assistant.io/t/custom-card-freezer-management/530416
- This rewritten version restructures the project into a storage-backed Home Assistant companion integration with a simplified card.
