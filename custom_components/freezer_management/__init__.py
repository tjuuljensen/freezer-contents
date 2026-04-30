"""The Freezer Management integration."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components.http import StaticPathConfig
from homeassistant.components.sensor import DOMAIN as SENSOR_DOMAIN
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv, entity_registry as er, service
from homeassistant.helpers.typing import ConfigType

from .const import (
    ATTR_COMPARTMENT,
    ATTR_CONTENTS,
    ATTR_DATE,
    ATTR_ITEM_ID,
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
    """Return domain data dict."""
    return hass.data.setdefault(DOMAIN, {})


def _get_entry_store(hass: HomeAssistant, entity_id: str) -> FreezerInventoryStore | None:
    """Resolve a freezer inventory store by sensor entity_id."""
    entity_registry = er.async_get(hass)
    entry = entity_registry.async_get(entity_id)
    if entry is None or entry.platform != DOMAIN or entry.domain != SENSOR_DOMAIN:
        return None

    entry_domain_data = _get_domain_data(hass).get(DATA_ENTRIES, {})
    return entry_domain_data.get(entry.config_entry_id)


async def _async_add_item_legacy(hass: HomeAssistant, call: ServiceCall) -> None:
    """Fallback service registration for older Home Assistant versions."""
    entity_id = call.data["entity_id"]
    store = _get_entry_store(hass, entity_id)
    if store is None:
        return
    await store.async_add_item(
        contents=call.data[ATTR_CONTENTS],
        compartment=call.data.get(ATTR_COMPARTMENT, ""),
        date=call.data.get(ATTR_DATE),
    )


async def _async_remove_item_legacy(hass: HomeAssistant, call: ServiceCall) -> None:
    """Fallback service registration for older Home Assistant versions."""
    entity_id = call.data["entity_id"]
    store = _get_entry_store(hass, entity_id)
    if store is None:
        return
    await store.async_remove_item(call.data[ATTR_ITEM_ID])


async def _async_clear_inventory_legacy(hass: HomeAssistant, call: ServiceCall) -> None:
    """Fallback service registration for older Home Assistant versions."""
    entity_id = call.data["entity_id"]
    store = _get_entry_store(hass, entity_id)
    if store is None:
        return
    await store.async_clear()


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the Freezer Management integration."""
    domain_data = _get_domain_data(hass)
    domain_data.setdefault(DATA_ENTRIES, {})

    if not domain_data.get(_DATA_STATIC_PATH_REGISTERED):
        frontend_path = Path(__file__).parent / "frontend"
        if hass.http is not None:
            await hass.http.async_register_static_paths(
                [
                    StaticPathConfig(
                        STATIC_URL_PATH,
                        str(frontend_path),
                        False,
                    )
                ]
            )
        domain_data[_DATA_STATIC_PATH_REGISTERED] = True

    if not domain_data.get(_DATA_SERVICES_REGISTERED):
        if hasattr(service, "async_register_platform_entity_service"):
            service.async_register_platform_entity_service(
                hass,
                DOMAIN,
                SERVICE_ADD_ITEM,
                SENSOR_DOMAIN,
                {
                    vol.Required(ATTR_CONTENTS): cv.string,
                    vol.Optional(ATTR_COMPARTMENT, default=""): cv.string,
                    vol.Optional(ATTR_DATE): cv.string,
                },
                "async_add_item",
            )
            service.async_register_platform_entity_service(
                hass,
                DOMAIN,
                SERVICE_REMOVE_ITEM,
                SENSOR_DOMAIN,
                {
                    vol.Required(ATTR_ITEM_ID): cv.string,
                },
                "async_remove_item",
            )
            service.async_register_platform_entity_service(
                hass,
                DOMAIN,
                SERVICE_CLEAR_INVENTORY,
                SENSOR_DOMAIN,
                vol.Schema({}),
                "async_clear_inventory",
            )
        else:
            hass.services.async_register(
                DOMAIN,
                SERVICE_ADD_ITEM,
                lambda call: _async_add_item_legacy(hass, call),
                schema=vol.Schema(
                    {
                        vol.Required("entity_id"): cv.entity_id,
                        vol.Required(ATTR_CONTENTS): cv.string,
                        vol.Optional(ATTR_COMPARTMENT, default=""): cv.string,
                        vol.Optional(ATTR_DATE): cv.string,
                    }
                ),
            )
            hass.services.async_register(
                DOMAIN,
                SERVICE_REMOVE_ITEM,
                lambda call: _async_remove_item_legacy(hass, call),
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
                lambda call: _async_clear_inventory_legacy(hass, call),
                schema=vol.Schema(
                    {
                        vol.Required("entity_id"): cv.entity_id,
                    }
                ),
            )

        domain_data[_DATA_SERVICES_REGISTERED] = True

    return True


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
) -> bool:
    """Set up Freezer Management from a config entry."""
    store = FreezerInventoryStore(hass, entry.entry_id)
    await store.async_load()
    _get_domain_data(hass)[DATA_ENTRIES][entry.entry_id] = store
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
) -> bool:
    """Unload a config entry."""
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        _get_domain_data(hass).get(DATA_ENTRIES, {}).pop(entry.entry_id, None)
    return unloaded
