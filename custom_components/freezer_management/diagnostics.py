"""Diagnostics support for Freezer Management."""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import ATTR_ITEMS, ATTR_UPDATED_AT, DATA_ENTRIES, DOMAIN
from .storage import FreezerInventoryStore


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant,
    entry: ConfigEntry,
) -> dict[str, Any]:
    store: FreezerInventoryStore = hass.data[DOMAIN][DATA_ENTRIES][entry.entry_id]

    return {
        "entry_id": entry.entry_id,
        "title": entry.title,
        "item_count": len(store.items),
        ATTR_UPDATED_AT: store.updated_at,
        ATTR_ITEMS: [
            {
                "itemId": item.get("itemId"),
                "item_length": len(item.get("item", "")),
                "packagingType_length": len(item.get("packagingType", "")),
                "freezerCompartment": item.get("freezerCompartment", ""),
                "addedDate": item.get("addedDate", ""),
                "expiryDate": item.get("expiryDate", ""),
            }
            for item in store.items
        ],
    }
