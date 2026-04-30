"""The Freezer Management integration."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components.http import StaticPathConfig
from homeassistant.components.sensor import DOMAIN as SENSOR_DOMAIN
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv, entity_registry as er
from homeassistant.helpers.typing import ConfigType

from .const import (
    ATTR_FREEZER_COMPARTMENT,
    ATTR_ITEM,
    ATTR_ITEM_ID,
    ATTR_PACKAGING_TYPE,
    ATTR_STORAGE_DATE,
    DATA_ENTRIES,
    DOMAIN,
    PLATFORMS,
    SERVICE_ADD_ITEM,
    SERVICE_CLEAR_INVENTORY,
    SERVICE_REMOVE_ITEM,
    STATIC_URL_PATH,
)
from .storage import FreezerInventoryStore

_DATA_STATIC_PATH_REGISTERED = "static_path_registered"
_DATA_SERVICES_REGISTERED = "services_registered"


def _get_domain_data(hass: HomeAssistant) -> dict[str, Any]:
    return hass.data.setdefault(DOMAIN, {})


def _get_entry_store(hass: HomeAssistant, entity_id: str) -> FreezerInventoryStore | None:
    registry = er.async_get(hass)
    entity_entry = registry.async_get(entity_id)
    if entity_entry is None or entity_entry.domain != SENSOR_DOMAIN:
        return None

    config_entry_id = entity_entry.config_entry_id
    if not config_entry_id:
        return None

    return _get_domain_data(hass).get(DATA_ENTRIES, {}).get(config_entry_id)


async def _async_add_item(hass: HomeAssistant, call: ServiceCall) -> None:
    store = _get_entry_store(hass, call.data["entity_id"])
    if store is None:
        raise vol.Invalid("Unknown freezer inventory entity.")

    await store.async_add_item(
        item=call.data[ATTR_ITEM],
        packaging_type=call.data.get(ATTR_PACKAGING_TYPE, ""),
        freezer_compartment=call.data.get(ATTR_FREEZER_COMPARTMENT, ""),
        storage_date=call.data.get(ATTR_STORAGE_DATE),
    )


async def _async_remove_item(hass: HomeAssistant, call: ServiceCall) -> None:
    store = _get_entry_store(hass, call.data["entity_id"])
    if store is None:
        raise vol.Invalid("Unknown freezer inventory entity.")

    await store.async_remove_item(call.data[ATTR_ITEM_ID])


async def _async_clear_inventory(hass: HomeAssistant, call: ServiceCall) -> None:
    store = _get_entry_store(hass, call.data["entity_id"])
    if store is None:
        raise vol.Invalid("Unknown freezer inventory entity.")

    await store.async_clear()


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    domain_data = _get_domain_data(hass)
    domain_data.setdefault(DATA_ENTRIES, {})

    if not domain_data.get(_DATA_STATIC_PATH_REGISTERED):
        frontend_path = Path(__file__).parent / "frontend"
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL_PATH, str(frontend_path), False)]
        )
        domain_data[_DATA_STATIC_PATH_REGISTERED] = True

    if not domain_data.get(_DATA_SERVICES_REGISTERED):
        async def handle_add(call: ServiceCall) -> None:
            await _async_add_item(hass, call)

        async def handle_remove(call: ServiceCall) -> None:
            await _async_remove_item(hass, call)

        async def handle_clear(call: ServiceCall) -> None:
            await _async_clear_inventory(hass, call)

        hass.services.async_register(
            DOMAIN,
            SERVICE_ADD_ITEM,
            handle_add,
            schema=vol.Schema(
                {
                    vol.Required("entity_id"): cv.entity_id,
                    vol.Required(ATTR_ITEM): cv.string,
                    vol.Optional(ATTR_PACKAGING_TYPE, default=""): cv.string,
                    vol.Optional(ATTR_FREEZER_COMPARTMENT, default=""): cv.string,
                    vol.Optional(ATTR_STORAGE_DATE): cv.string,
                }
            ),
        )
        hass.services.async_register(
            DOMAIN,
            SERVICE_REMOVE_ITEM,
            handle_remove,
            schema=vol.Schema(
                {
                    vol.Required("entity_id"): cv.entity_id,
                    vol.Required(ATTR_ITEM_ID): cv.string,
                }
            ),
        )
        hass.services.async_register(
            DOMAIN,
            SERVICE_CLEAR_INVENTORY,
            handle_clear,
            schema=vol.Schema(
                {
                    vol.Required("entity_id"): cv.entity_id,
                }
            ),
        )
        domain_data[_DATA_SERVICES_REGISTERED] = True

    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    store = FreezerInventoryStore(hass, entry.entry_id)
    await store.async_load()
    _get_domain_data(hass)[DATA_ENTRIES][entry.entry_id] = store
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        _get_domain_data(hass).get(DATA_ENTRIES, {}).pop(entry.entry_id, None)
    return unloaded
