"""Storage helpers for Freezer Management."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any, Callable, TypedDict
from uuid import uuid4

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store

from .const import (
    ATTR_ADDED_DATE,
    ATTR_ADDED_ISO_DATE,
    ATTR_EXPIRY_DATE,
    ATTR_EXPIRY_ISO_DATE,
    ATTR_FREEZER_COMPARTMENT,
    ATTR_ITEM,
    ATTR_ITEM_ID,
    ATTR_ITEMS,
    ATTR_PACKAGING_TYPE,
    ATTR_UPDATED_AT,
    STORAGE_KEY_PREFIX,
    STORAGE_VERSION,
)


class FreezerItem(TypedDict):
    """Stored freezer item."""

    itemId: str
    item: str
    packagingType: str
    freezerCompartment: str
    addedDate: str
    addedIsoDate: str
    expiryDate: str
    expiryIsoDate: str


class FreezerStoreData(TypedDict):
    """Persisted store payload."""

    items: list[FreezerItem]
    updated_at: str


Listener = Callable[[], None]


@dataclass(slots=True)
class FreezerInventoryStore:
    """Storage-backed freezer inventory."""

    hass: HomeAssistant
    entry_id: str
    _store: Store[FreezerStoreData] = field(init=False)
    _data: FreezerStoreData = field(
        default_factory=lambda: {
            ATTR_ITEMS: [],
            ATTR_UPDATED_AT: "",
        }
    )
    _listeners: list[Listener] = field(default_factory=list)
    loaded: bool = False

    def __post_init__(self) -> None:
        self._store = Store[FreezerStoreData](
            self.hass,
            STORAGE_VERSION,
            f"{STORAGE_KEY_PREFIX}.{self.entry_id}",
        )

    @property
    def items(self) -> list[FreezerItem]:
        return self._data[ATTR_ITEMS]

    @property
    def updated_at(self) -> str:
        return self._data[ATTR_UPDATED_AT]

    async def async_load(self) -> None:
        raw = await self._store.async_load()
        self._data = self._normalize_store(raw)
        self.loaded = True
        self._notify()

    @callback
    def async_add_listener(self, listener: Listener):
        self._listeners.append(listener)

        @callback
        def remove_listener() -> None:
            if listener in self._listeners:
                self._listeners.remove(listener)

        return remove_listener

    async def async_add_item(
        self,
        *,
        item: str,
        packaging_type: str = "",
        freezer_compartment: str = "",
        added_date: str | None = None,
        expiry_date: str | None = None,
    ) -> FreezerItem:
        now = datetime.now(UTC)
        normalized_expiry_date, normalized_expiry_iso = _normalize_expiry_input(expiry_date or "")

        normalized_item: FreezerItem = {
            ATTR_ITEM_ID: uuid4().hex,
            ATTR_ITEM: item.strip(),
            ATTR_PACKAGING_TYPE: packaging_type.strip(),
            ATTR_FREEZER_COMPARTMENT: freezer_compartment.strip(),
            ATTR_ADDED_DATE: added_date.strip() if added_date else now.date().isoformat(),
            ATTR_ADDED_ISO_DATE: now.isoformat(),
            ATTR_EXPIRY_DATE: normalized_expiry_date,
            ATTR_EXPIRY_ISO_DATE: normalized_expiry_iso,
        }

        self._data[ATTR_ITEMS].append(normalized_item)
        self._touch_updated_at(now)
        await self._async_save()
        self._notify()
        return normalized_item

    async def async_remove_item(self, item_id: str) -> bool:
        original_count = len(self._data[ATTR_ITEMS])
        self._data[ATTR_ITEMS] = [
            item for item in self._data[ATTR_ITEMS] if item[ATTR_ITEM_ID] != item_id
        ]
        removed = len(self._data[ATTR_ITEMS]) != original_count
        if removed:
            self._touch_updated_at()
            await self._async_save()
            self._notify()
        return removed

    async def async_clear(self) -> None:
        self._data[ATTR_ITEMS] = []
        self._touch_updated_at()
        await self._async_save()
        self._notify()

    async def _async_save(self) -> None:
        await self._store.async_save(self._data)

    @callback
    def _notify(self) -> None:
        for listener in list(self._listeners):
            listener()

    @staticmethod
    def _normalize_store(raw: FreezerStoreData | dict[str, Any] | None) -> FreezerStoreData:
        items: list[FreezerItem] = []
        updated_at = ""

        if isinstance(raw, dict):
            updated_at = str(raw.get(ATTR_UPDATED_AT, "") or "")
            raw_items = raw.get(ATTR_ITEMS, [])
            if isinstance(raw_items, list):
                for raw_item in raw_items:
                    normalized = FreezerInventoryStore._normalize_item(raw_item)
                    if normalized is not None:
                        items.append(normalized)

        return {
            ATTR_ITEMS: items,
            ATTR_UPDATED_AT: updated_at,
        }

    @staticmethod
    def _normalize_item(raw_item: Any) -> FreezerItem | None:
        if not isinstance(raw_item, dict):
            return None

        item = str(raw_item.get(ATTR_ITEM) or "").strip()
        packaging_type = str(raw_item.get(ATTR_PACKAGING_TYPE) or "").strip()
        freezer_compartment = str(raw_item.get(ATTR_FREEZER_COMPARTMENT) or "").strip()
        added_date = str(raw_item.get(ATTR_ADDED_DATE) or "").strip()
        added_iso_date = str(raw_item.get(ATTR_ADDED_ISO_DATE) or "").strip()
        expiry_date = str(raw_item.get(ATTR_EXPIRY_DATE) or "").strip()
        expiry_iso_date = str(raw_item.get(ATTR_EXPIRY_ISO_DATE) or "").strip()
        item_id = str(raw_item.get(ATTR_ITEM_ID) or "").strip() or uuid4().hex

        if not item:
            return None

        if not added_date and added_iso_date:
            added_date = _iso_to_date(added_iso_date)
        if not added_iso_date:
            added_iso_date = datetime.now(UTC).isoformat()

        if expiry_date and not expiry_iso_date:
            _, expiry_iso_date = _normalize_expiry_input(expiry_date)
        if expiry_iso_date and not expiry_date:
            expiry_date = _iso_to_date(expiry_iso_date)

        return {
            ATTR_ITEM_ID: item_id,
            ATTR_ITEM: item,
            ATTR_PACKAGING_TYPE: packaging_type,
            ATTR_FREEZER_COMPARTMENT: freezer_compartment,
            ATTR_ADDED_DATE: added_date,
            ATTR_ADDED_ISO_DATE: added_iso_date,
            ATTR_EXPIRY_DATE: expiry_date,
            ATTR_EXPIRY_ISO_DATE: expiry_iso_date,
        }

    def _touch_updated_at(self, now: datetime | None = None) -> None:
        self._data[ATTR_UPDATED_AT] = (now or datetime.now(UTC)).isoformat()


def _iso_to_date(value: str) -> str:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return value[:10]


def _normalize_expiry_input(value: str) -> tuple[str, str]:
    raw = value.strip().lower()
    if not raw:
        return "", ""

    now = datetime.now(UTC)

    if raw.endswith("d") and raw[:-1].isdigit():
        target = now + timedelta(days=int(raw[:-1]))
        return target.date().isoformat(), target.isoformat()

    if raw.endswith("m") and raw[:-1].isdigit():
        target = now + timedelta(days=int(raw[:-1]) * 30)
        return target.date().isoformat(), target.isoformat()

    if raw.endswith("y") and raw[:-1].isdigit():
        target = now + timedelta(days=int(raw[:-1]) * 365)
        return target.date().isoformat(), target.isoformat()

    try:
        target = datetime.fromisoformat(raw)
        if target.tzinfo is None:
            target = target.replace(tzinfo=UTC)
        return target.date().isoformat(), target.isoformat()
    except ValueError:
        return raw, ""
