"""Tests for schema types and validation — ports packages/engine/tests/schema.test.ts."""

import pytest
from pydantic import ValidationError

from nomark_engine.schema import (
    SigPref, SigMap, SigAsn, SigMeta, SigRub,
    ContextCounts, OutcomeCounts,
    LedgerEntryPref, LedgerEntryMap, LedgerEntryAsn, LedgerEntryMeta, LedgerEntryRub,
    parse_ledger_entry,
)


class TestSigPref:
    def test_validates_correct_preference(self):
        pref = SigPref(
            dim="tone", target="direct", w=0.87, n=20,
            src=ContextCounts(chat=8, code=12), ctd=1, scope="*",
            decay=0.97, last="2026-04-05",
        )
        assert pref.dim == "tone"
        assert pref.w == 0.87

    def test_rejects_missing_required_fields(self):
        with pytest.raises(ValidationError):
            SigPref(dim="tone")  # type: ignore[call-arg]

    def test_rejects_weight_out_of_range(self):
        with pytest.raises(ValidationError):
            SigPref(
                dim="tone", target="direct", w=1.5, n=20,
                src=ContextCounts(chat=8), ctd=0, scope="*", decay=0.9, last="2026-04-05",
            )

    def test_accepts_staged_flag(self):
        pref = SigPref(
            dim="tone", target="direct", w=0.5, n=1,
            src=ContextCounts(code=1), ctd=0, scope="*", decay=1.0,
            last="2026-04-06", staged=True,
        )
        assert pref.staged is True

    def test_accepts_compound_scope(self):
        pref = SigPref(
            dim="tone", target="formal", w=0.82, n=6,
            src=ContextCounts(chat=6), ctd=0, scope="context:chat+topic:investor",
            decay=0.99, last="2026-04-04",
        )
        assert pref.scope == "context:chat+topic:investor"


class TestSigMap:
    def test_validates_meaning_map(self):
        m = SigMap(
            trigger="make it shorter", pattern_type="rewrite_request",
            intent=["reduce_length_40pct", "remove_examples", "keep_structure"],
            conf=0.91, n=8, scope="*", last="2026-04-03",
        )
        assert m.trigger == "make it shorter"

    def test_rejects_invalid_pattern_type(self):
        with pytest.raises(ValidationError):
            SigMap(
                trigger="test", pattern_type="invalid_type",  # type: ignore[arg-type]
                intent=["x"], conf=0.5, n=1, last="2026-04-03",
            )


class TestSigAsn:
    def test_validates_assumption(self):
        asn = SigAsn(
            field="audience", default="developers",
            accuracy=0.92, total=25, correct=23, last="2026-04-05",
        )
        assert asn.accuracy == 0.92


class TestSigMeta:
    def test_validates_meta(self):
        meta = SigMeta(
            profile={"tone": "direct", "verbosity": "short"},
            signals=47, by_ctx=ContextCounts(chat=10, code=30, cowork=7),
            by_out=OutcomeCounts(accepted=30, edited=5, corrected=8, rejected=2, abandoned=2),
            avg_conf=0.82, avg_q=3.2, updated="2026-04-06",
        )
        assert meta.signals == 47

    def test_validates_cold_start(self):
        meta = SigMeta(
            profile={}, signals=0,
            by_ctx=ContextCounts(chat=0, code=0, cowork=0),
            by_out=OutcomeCounts(accepted=0, edited=0, corrected=0, rejected=0, abandoned=0),
            avg_conf=0.5, avg_q=1.5, updated="2026-04-06",
        )
        assert meta.avg_q == 1.5


class TestSigRub:
    def test_validates_rubric(self):
        rub = SigRub(
            id="rub-001", fmt="report", stage="proven",
            uses=10, accepts=8, avg_ed=0.12,
            dims={"clarity": 0.3, "completeness": 0.4, "accuracy": 0.3},
            min=0.7, last="2026-04-01",
        )
        assert rub.stage == "proven"


class TestLedgerEntry:
    def test_discriminates_by_type(self):
        entry = LedgerEntryPref(data=SigPref(
            dim="tone", target="direct", w=0.87, n=20,
            src=ContextCounts(chat=8, code=12), ctd=1, scope="*",
            decay=0.97, last="2026-04-05",
        ))
        assert entry.type == "pref"

    def test_parse_ledger_entry_valid(self):
        data = {
            "dim": "tone", "target": "direct", "w": 0.87, "n": 20,
            "src": {"chat": 8, "code": 12}, "ctd": 1, "scope": "*",
            "decay": 0.97, "last": "2026-04-05",
        }
        entry = parse_ledger_entry("pref", data)
        assert entry is not None
        assert entry.type == "pref"

    def test_parse_ledger_entry_unknown_type(self):
        assert parse_ledger_entry("unknown", {}) is None

    def test_parse_ledger_entry_invalid_data(self):
        assert parse_ledger_entry("pref", {"dim": "tone"}) is None
