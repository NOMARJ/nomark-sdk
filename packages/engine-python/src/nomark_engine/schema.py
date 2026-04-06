"""Schema types and validation for NOMARK ledger entries.

Ports packages/engine/src/schema.ts — Pydantic v2 models instead of Zod.
"""

from __future__ import annotations

import re
from typing import Literal, Union

from pydantic import BaseModel, Field, field_validator

# --- String literal unions (match TS types) ---

Context = Literal["chat", "cowork", "code"]
Outcome = Literal["accepted", "edited", "corrected", "rejected", "abandoned", "unknown"]
RequestType = Literal["question", "task", "brainstorm", "decision", "critique", "creative", "continuation", "reaction"]
PatternType = Literal["rewrite_request", "scope_change", "quality_complaint", "format_request", "style_override", "abort"]
RubricStage = Literal["ephemeral", "pending", "proven", "trusted"]
SignalType = Literal["meta", "pref", "map", "asn", "rub"]

# Scope is a free-form string: '*' | 'context:{ctx}' | 'topic:{topic}' | compound
Scope = str

_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_ISO_DATETIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")


def _validate_iso_date(v: str) -> str:
    if not _ISO_DATE_RE.match(v):
        raise ValueError(f"Expected ISO date (YYYY-MM-DD), got {v!r}")
    return v


# --- Context counts ---

class ContextCounts(BaseModel):
    chat: int | None = None
    code: int | None = None
    cowork: int | None = None


# --- Signal data models ---

class SigPref(BaseModel):
    dim: str
    target: str
    w: float = Field(ge=0, le=1)
    n: int = Field(ge=0)
    src: ContextCounts
    ctd: int = Field(ge=0)
    scope: str
    decay: float = Field(ge=0, le=1)
    last: str
    staged: bool | None = None
    note: str | None = None

    @field_validator("last")
    @classmethod
    def _check_last(cls, v: str) -> str:
        return _validate_iso_date(v)


class SigMap(BaseModel):
    trigger: str
    pattern_type: PatternType
    intent: list[str]
    neg: list[str] | None = None
    conf: float = Field(ge=0, le=1)
    n: int = Field(ge=0)
    scope: str | None = None
    last: str

    @field_validator("last")
    @classmethod
    def _check_last(cls, v: str) -> str:
        return _validate_iso_date(v)


class SigAsn(BaseModel):
    field: str
    default: str
    accuracy: float = Field(ge=0, le=1)
    total: int = Field(ge=0)
    correct: int = Field(ge=0)
    last: str

    @field_validator("last")
    @classmethod
    def _check_last(cls, v: str) -> str:
        return _validate_iso_date(v)


class OutcomeCounts(BaseModel):
    accepted: int | None = None
    edited: int | None = None
    corrected: int | None = None
    rejected: int | None = None
    abandoned: int | None = None


class SigMeta(BaseModel):
    profile: dict[str, object]
    signals: int = Field(ge=0)
    by_ctx: ContextCounts
    by_out: OutcomeCounts
    avg_conf: float = Field(ge=0, le=1)
    avg_q: float = Field(ge=0)
    updated: str

    @field_validator("updated")
    @classmethod
    def _check_updated(cls, v: str) -> str:
        return _validate_iso_date(v)


class SigRub(BaseModel):
    id: str
    fmt: str
    stage: RubricStage
    uses: int = Field(ge=0)
    accepts: int = Field(ge=0)
    avg_ed: float = Field(ge=0)
    dims: dict[str, float]
    min: float
    ref: str | None = None
    last: str

    @field_validator("last")
    @classmethod
    def _check_last(cls, v: str) -> str:
        return _validate_iso_date(v)


# --- Ledger entry (discriminated union) ---

class LedgerEntryMeta(BaseModel):
    type: Literal["meta"] = "meta"
    data: SigMeta


class LedgerEntryPref(BaseModel):
    type: Literal["pref"] = "pref"
    data: SigPref


class LedgerEntryMap(BaseModel):
    type: Literal["map"] = "map"
    data: SigMap


class LedgerEntryAsn(BaseModel):
    type: Literal["asn"] = "asn"
    data: SigAsn


class LedgerEntryRub(BaseModel):
    type: Literal["rub"] = "rub"
    data: SigRub


LedgerEntry = Union[LedgerEntryMeta, LedgerEntryPref, LedgerEntryMap, LedgerEntryAsn, LedgerEntryRub]

_SIGNAL_TYPE_MAP: dict[str, type[BaseModel]] = {
    "meta": LedgerEntryMeta,
    "pref": LedgerEntryPref,
    "map": LedgerEntryMap,
    "asn": LedgerEntryAsn,
    "rub": LedgerEntryRub,
}

_SIGNAL_DATA_MAP: dict[str, type[BaseModel]] = {
    "meta": SigMeta,
    "pref": SigPref,
    "map": SigMap,
    "asn": SigAsn,
    "rub": SigRub,
}


def parse_ledger_entry(signal_type: str, data: dict) -> LedgerEntry | None:
    """Parse a signal type + data dict into a typed LedgerEntry. Returns None on validation failure."""
    entry_cls = _SIGNAL_TYPE_MAP.get(signal_type)
    if entry_cls is None:
        return None
    try:
        return entry_cls.model_validate({"type": signal_type, "data": data})  # type: ignore[return-value]
    except Exception:
        return None
