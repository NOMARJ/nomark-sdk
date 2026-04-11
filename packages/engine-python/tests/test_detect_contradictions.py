"""Parity tests for detect_contradictions — mirrors engine/src/__tests__/detectContradictions.test.ts."""

from __future__ import annotations

from datetime import datetime, timezone

from nomark_engine.detect_contradictions import detect_contradictions
from nomark_engine.schema import (
    ContextCounts,
    LedgerEntry,
    LedgerEntryAsn,
    LedgerEntryMap,
    LedgerEntryPref,
    SigAsn,
    SigMap,
    SigPref,
)

NOW = datetime(2026, 4, 11, tzinfo=timezone.utc)


def make_pref(**overrides) -> SigPref:
    defaults = dict(
        dim="tone",
        target="direct",
        w=0.9,
        n=20,
        src=ContextCounts(chat=8, code=12),
        ctd=0,
        scope="*",
        decay=0.95,
        last="2026-04-10",
    )
    defaults.update(overrides)
    return SigPref(**defaults)


def pref_entry(pref: SigPref) -> LedgerEntry:
    return LedgerEntryPref(type="pref", data=pref)


def test_returns_no_conflicts_when_entries_agree_or_cover_different_dimensions() -> None:
    entries = [
        pref_entry(make_pref(dim="tone", target="direct")),
        pref_entry(make_pref(dim="format", target="bullets")),
        pref_entry(make_pref(dim="tone", target="direct", last="2026-04-01")),
    ]
    assert detect_contradictions(entries, now=NOW) == []


def test_does_not_flag_scoped_overrides() -> None:
    entries = [
        pref_entry(make_pref(dim="tone", target="direct", scope="*")),
        pref_entry(make_pref(dim="tone", target="playful", scope="context:chat")),
        pref_entry(make_pref(dim="tone", target="terse", scope="context:code")),
    ]
    assert detect_contradictions(entries, now=NOW) == []


def test_flags_same_scope_contradiction() -> None:
    entries = [
        pref_entry(make_pref(dim="tone", target="direct", scope="*", n=20, w=0.9, last="2026-04-10")),
        pref_entry(make_pref(dim="tone", target="friendly", scope="*", n=3, w=0.5, last="2026-03-01")),
    ]
    result = detect_contradictions(entries, now=NOW)
    assert len(result) == 1
    conflict = result[0]
    assert conflict.dimension == "tone"
    assert conflict.scope == "*"
    assert len(conflict.entries) == 2
    assert conflict.resolution.recommended.pref.target == "direct"
    assert conflict.resolution.margin > 0


def test_flags_multi_way_contradiction() -> None:
    entries = [
        pref_entry(make_pref(dim="format", target="bullets", scope="context:code", n=15, last="2026-04-10")),
        pref_entry(make_pref(dim="format", target="prose", scope="context:code", n=8, last="2026-04-05")),
        pref_entry(make_pref(dim="format", target="table", scope="context:code", n=4, last="2026-03-20")),
    ]
    result = detect_contradictions(entries, now=NOW)
    assert len(result) == 1
    conflict = result[0]
    assert len(conflict.entries) == 3
    assert conflict.resolution.recommended.pref.target == "bullets"
    assert {e.pref.target for e in conflict.entries} == {"bullets", "prose", "table"}


def test_filters_stale_entries_below_threshold() -> None:
    entries = [
        pref_entry(make_pref(dim="tone", target="direct", scope="*", w=0.9, decay=0.95)),
        pref_entry(make_pref(dim="tone", target="stale-ghost", scope="*", w=0.2, decay=0.1)),
    ]
    assert detect_contradictions(entries, now=NOW) == []


def test_confidence_tiebreak_reason() -> None:
    entries = [
        pref_entry(make_pref(
            dim="verbosity", target="short", scope="*", n=10, w=0.8,
            last="2026-04-10", src=ContextCounts(chat=5, code=5),
        )),
        pref_entry(make_pref(
            dim="verbosity", target="long", scope="*", n=10, w=0.8,
            last="2026-04-10", src=ContextCounts(chat=5, code=5),
        )),
    ]
    result = detect_contradictions(entries, now=NOW)
    assert len(result) == 1
    conflict = result[0]
    assert len(conflict.entries) == 2
    assert conflict.resolution.margin <= 0.05
    assert "tiebreak" in conflict.resolution.reason.lower()


def test_ignores_non_pref_entries() -> None:
    entries: list[LedgerEntry] = [
        LedgerEntryMap(
            type="map",
            data=SigMap(
                trigger="shorter",
                pattern_type="rewrite_request",
                intent=["reduce"],
                conf=0.9,
                n=4,
                last="2026-04-01",
            ),
        ),
        LedgerEntryAsn(
            type="asn",
            data=SigAsn(
                field="language",
                default="typescript",
                accuracy=0.9,
                total=10,
                correct=9,
                last="2026-04-01",
            ),
        ),
    ]
    assert detect_contradictions(entries, now=NOW) == []
