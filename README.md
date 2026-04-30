# Freezer Management

![Freezer Management logo](custom_components/freezer_management/brand/logo.png)

A storage-backed Home Assistant integration and dashboard card for tracking freezer contents by item, packaging, compartment, added date, and optional expiry date.

## Features

- Storage-backed freezer inventory integration with a config entry
- Dashboard card served directly by the integration
- Fields for:
  - Item
  - Packaging
  - Freezer compartment
  - Added date
  - Optional expiry date
- Sorting by:
  - compartment
  - added date newest
  - added date oldest
  - item
  - expiry date
- Optional hiding of the added date column
- Configurable table headers
- Configurable date display styles
- Shortcut buttons for common items
- Confirmation prompt before clearing the full inventory

## Installation

1. Copy `custom_components/freezer_management` into your Home Assistant config directory.
2. Restart Home Assistant.
3. Go to **Settings → Devices & services** and add **Freezer Management**.
4. Add the dashboard resource:

```yaml
resources:
  - url: /api/freezer_management/static/freezer-management-card.js
    type: module
```

5. Add the card to a dashboard.

## Card example

```yaml
type: custom:freezer-management-card
entity: sensor.main_freezer_inventory
title: Fryser
sort_by: freezerCompartment
date_display: locale_medium
hide_added_date: false
item_header: Item
packaging_header: Packaging
compartment_header: Compartment
added_header: Added
expiry_header: Expiry
show_shortcuts: true
shortcuts:
  - black beans
  - rye bread
```

## Expiry date input

Expiry is optional.

You can enter expiry in one of these forms:

- relative days: `90d`
- relative months: `6m`
- relative years: `1y`
- explicit ISO date: `2026-12-31`

Relative codes are converted into a stored expiry date when you save the item.

## Date display

The card supports these display modes:

- `locale_short`
- `locale_medium`
- `locale_long`
- `iso`
- `relative`

`relative` is useful for expiry because it can show values such as “in 3 months”.

## Services

### Add item

```yaml
action: freezer_management.add_item
data:
  entity_id: sensor.main_freezer_inventory
  item: black beans
  packagingType: bag
  freezerCompartment: 2
  expiryDate: 6m
```

### Remove item

```yaml
action: freezer_management.remove_item
data:
  entity_id: sensor.main_freezer_inventory
  itemId: abc123
```

### Clear inventory

```yaml
action: freezer_management.clear_inventory
data:
  entity_id: sensor.main_freezer_inventory
```

## Reset inventory

To fully reset the current integration inventory:

```yaml
action: freezer_management.clear_inventory
data:
  entity_id: sensor.main_freezer_inventory
```

If you need a completely fresh store, remove the config entry and add it again.

## Future improvements

- Edit existing rows directly in the card
- Bulk actions for moving or deleting multiple items
- Optional quantity field
- Optional labels or categories
- Dedicated expiry warnings and overdue highlighting
- Import/export helpers for backup and migration
- A build pipeline for a Lit + TypeScript frontend bundle

## Credits

Original concept inspiration came from the community freezer card idea shared by Ronald Dehuysser (`rdehuyss`):
https://community.home-assistant.io/t/custom-card-freezer-management/530416
