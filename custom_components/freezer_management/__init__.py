"""The Freezer Management integration."""

from __future__ import annotations

from pathlib import Path

import voluptuous as vol

from homeassistant.components.http import StaticPathConfig
from homeassistant.components.sensor import DOMAIN as SENSOR_DOMAIN
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv, service
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

FreezerManagementConfigEntry = ConfigEntry[FreezerInventoryStore]

_DATA_STATIC_PATH_REGISTERED = "static_path_registered"
_DATA_SERVICES_REGISTERED = "services_registered"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the Freezer Management integration."""
    domain_data = hass.data.setdefault(DOMAIN, {})

    if not domain_data.get(_DATA_STATIC_PATH_REGISTERED):
        frontend_path = Path(__file__).parent / "frontend"
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
        service.async_register_platform_entity_service(
            hass,
            DOMAIN,
            SERVICE_ADD_ITEM,
            entity_domain=SENSOR_DOMAIN,
            schema=cv.make_entity_service_schema(
                {
                    vol.Required(ATTR_CONTENTS): cv.string,
                    vol.Optional(ATTR_COMPARTMENT, default=""): cv.string,
                    vol.Optional(ATTR_DATE): cv.string,
                }
            ),
            func="async_add_item",
        )
        service.async_register_platform_entity_service(
            hass,
            DOMAIN,
            SERVICE_REMOVE_ITEM,
            entity_domain=SENSOR_DOMAIN,
            schema=cv.make_entity_service_schema(
                {
                    vol.Required(ATTR_ITEM_ID): cv.string,
                }
            ),
            func="async_remove_item",
        )
        service.async_register_platform_entity_service(
            hass,
            DOMAIN,
            SERVICE_CLEAR_INVENTORY,
            entity_domain=SENSOR_DOMAIN,
            schema=cv.make_entity_service_schema({}),
            func="async_clear_inventory",
        )
        domain_data[_DATA_SERVICES_REGISTERED] = True

    return True


async def async_setup_entry(
    hass: HomeAssistant,
    entry: FreezerManagementConfigEntry,
) -> bool:
    """Set up Freezer Management from a config entry."""
    store = FreezerInventoryStore(hass, entry.entry_id)
    await store.async_load()
    domain_data = hass.data.setdefault(DOMAIN, {})
    domain_data.setdefault(DATA_ENTRIES, {})[entry.entry_id] = store
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(
    hass: HomeAssistant,
    entry: FreezerManagementConfigEntry,
) -> bool:
    """Unload a config entry."""
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        domain_data = hass.data.get(DOMAIN, {})
        entries = domain_data.get(DATA_ENTRIES, {})
        entries.pop(entry.entry_id, None)
    return unloaded
