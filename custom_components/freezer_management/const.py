"""Constants for the Freezer Management integration."""

from __future__ import annotations

DOMAIN = "freezer_management"
PLATFORMS = ["sensor"]

DATA_ENTRIES = "entries"

STORAGE_VERSION = 4
STORAGE_KEY_PREFIX = f"{DOMAIN}.inventory"
SCHEMA_VERSION = 4

ATTR_ITEM = "item"
ATTR_PACKAGING_TYPE = "packagingType"
ATTR_FREEZER_COMPARTMENT = "freezerCompartment"
ATTR_ADDED_DATE = "addedDate"
ATTR_ADDED_ISO_DATE = "addedIsoDate"
ATTR_EXPIRY_DATE = "expiryDate"
ATTR_EXPIRY_ISO_DATE = "expiryIsoDate"
ATTR_ITEM_ID = "itemId"
ATTR_ITEMS = "items"
ATTR_UPDATED_AT = "updated_at"
ATTR_INTEGRATION_DOMAIN = "integration_domain"
ATTR_SCHEMA_VERSION = "schema_version"

SERVICE_ADD_ITEM = "add_item"
SERVICE_REMOVE_ITEM = "remove_item"
SERVICE_CLEAR_INVENTORY = "clear_inventory"

DEFAULT_TITLE = "Freezer"
INVENTORY_ENTITY_NAME = "Inventory"

STATIC_URL_PATH = f"/api/{DOMAIN}/static"
