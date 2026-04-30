"""Sensor platform for Freezer Management."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .const import (
    ATTR_COMPARTMENT,
    ATTR_CONTENTS,
    ATTR_DATE,
    ATTR_ISO_DATE,
    ATTR_ITEM_ID,
    ATTR_ITEMS,
    ATTR_UPDATED_AT,
    DATA_ENTRIES,
    DOMAIN,
    INVENTORY_ENTITY_NAME,
)
from .storage import FreezerInventoryStore


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up the freezer inventory sensor."""
    store: FreezerInventoryStore = hass.data[DOMAIN][DATA_ENTRIES][entry.entry_id]
    async_add_entities([FreezerInventorySensor(entry, store)])


class FreezerInventorySensor(SensorEntity):
    """Storage-backed freezer inventory entity."""

    _attr_has_entity_name = True
    _attr_name = INVENTORY_ENTITY_NAME
    _attr_icon = "mdi:fridge-outline"
    _attr_should_poll = False
    _attr_translation_key = "inventory"

    def __init__(self, entry: ConfigEntry, store: FreezerInventoryStore) -> None:
        """Initialize the sensor."""
        self._entry = entry
        self._store = store
        self._attr_unique_id = f"{entry.entry_id}_inventory"

    @property
    def native_value(self) -> int:
        """Return the current number of stored items."""
        return len(self._store.items)

    @property
    def available(self) -> bool:
        """Return availability."""
        return self._store.loaded

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return state attributes."""
        return {
            ATTR_ITEMS: [
                {
                    ATTR_ITEM_ID: item[ATTR_ITEM_ID],
                    ATTR_CONTENTS: item[ATTR_CONTENTS],
                    ATTR_COMPARTMENT: item[ATTR_COMPARTMENT],
                    ATTR_DATE: item[ATTR_DATE],
                    ATTR_ISO_DATE: item[ATTR_ISO_DATE],
                }
                for item in self._store.items
            ],
            ATTR_UPDATED_AT: self._store.updated_at,
        }

    @property
    def device_info(self) -> DeviceInfo:
        """Return device metadata."""
        return DeviceInfo(
            identifiers={(DOMAIN, self._entry.entry_id)},
            name=self._entry.title,
            manufacturer="Community",
            model="Freezer inventory",
            entry_type=DeviceEntryType.SERVICE,
            configuration_url="homeassistant://config/integrations",
        )

    async def async_added_to_hass(self) -> None:
        """Register entity listeners."""
        self.async_on_remove(self._store.async_add_listener(self._handle_store_update))

    @callback
    def _handle_store_update(self) -> None:
        """Write new state when the store changes."""
        self.async_write_ha_state()

    async def async_add_item(
        self,
        contents: str,
        compartment: str = "",
        date: str | None = None,
    ) -> None:
        """Add a new item to the inventory."""
        await self._store.async_add_item(
            contents=contents,
            compartment=compartment,
            date=date,
        )

    async def async_remove_item(self, item_id: str) -> None:
        """Remove an item from the inventory."""
        await self._store.async_remove_item(item_id)

    async def async_clear_inventory(self) -> None:
        """Clear the inventory."""
        await self._store.async_clear()
