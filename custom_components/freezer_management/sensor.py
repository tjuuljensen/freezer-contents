"""Sensor platform for Freezer Management."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .const import (
    ATTR_ADDED_DATE,
    ATTR_ADDED_ISO_DATE,
    ATTR_EXPIRY_DATE,
    ATTR_EXPIRY_ISO_DATE,
    ATTR_FREEZER_COMPARTMENT,
    ATTR_INTEGRATION_DOMAIN,
    ATTR_ITEM,
    ATTR_ITEM_ID,
    ATTR_ITEMS,
    ATTR_PACKAGING_TYPE,
    ATTR_SCHEMA_VERSION,
    ATTR_UPDATED_AT,
    DATA_ENTRIES,
    DOMAIN,
    INVENTORY_ENTITY_NAME,
    SCHEMA_VERSION,
)
from .storage import FreezerInventoryStore


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    store: FreezerInventoryStore = hass.data[DOMAIN][DATA_ENTRIES][entry.entry_id]
    async_add_entities([FreezerInventorySensor(entry, store)])


class FreezerInventorySensor(SensorEntity):
    _attr_has_entity_name = True
    _attr_name = INVENTORY_ENTITY_NAME
    _attr_icon = "mdi:fridge-outline"
    _attr_should_poll = False
    _attr_translation_key = "inventory"

    def __init__(self, entry: ConfigEntry, store: FreezerInventoryStore) -> None:
        self._entry = entry
        self._store = store
        self._attr_unique_id = f"{entry.entry_id}_inventory"

    @property
    def native_value(self) -> int:
        return len(self._store.items)

    @property
    def available(self) -> bool:
        return self._store.loaded

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {
            ATTR_ITEMS: [
                {
                    ATTR_ITEM_ID: item[ATTR_ITEM_ID],
                    ATTR_ITEM: item[ATTR_ITEM],
                    ATTR_PACKAGING_TYPE: item[ATTR_PACKAGING_TYPE],
                    ATTR_FREEZER_COMPARTMENT: item[ATTR_FREEZER_COMPARTMENT],
                    ATTR_ADDED_DATE: item[ATTR_ADDED_DATE],
                    ATTR_ADDED_ISO_DATE: item[ATTR_ADDED_ISO_DATE],
                    ATTR_EXPIRY_DATE: item[ATTR_EXPIRY_DATE],
                    ATTR_EXPIRY_ISO_DATE: item[ATTR_EXPIRY_ISO_DATE],
                }
                for item in self._store.items
            ],
            ATTR_UPDATED_AT: self._store.updated_at,
            ATTR_INTEGRATION_DOMAIN: DOMAIN,
            ATTR_SCHEMA_VERSION: SCHEMA_VERSION,
        }

    @property
    def device_info(self) -> DeviceInfo:
        return DeviceInfo(
            identifiers={(DOMAIN, self._entry.entry_id)},
            name=self._entry.title,
            manufacturer="Community",
            model="Freezer inventory",
            entry_type=DeviceEntryType.SERVICE,
            configuration_url="homeassistant://config/integrations",
        )

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self._store.async_add_listener(self._handle_store_update))

    @callback
    def _handle_store_update(self) -> None:
        self.async_write_ha_state()
