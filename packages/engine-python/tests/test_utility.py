"""Tests for utility scoring + pruning — ports packages/engine/tests/utility.test.ts."""

from datetime import datetime, timezone

import pytest

from nomark_engine.schema import (
    SigPref, SigMeta, SigRub, ContextCounts, OutcomeCounts,
    LedgerEntryPref, LedgerEntryMeta, LedgerEntryRub, LedgerEntry,
)
from nomark_engine.utility import utility_score, is_protected, prune_to_capacity

NOW = datetime(2026, 4, 6, tzinfo=timezone.utc)


class TestUtilityScore:
    def test_scores_recent_high_frequency_high(self):
        score = utility_score({
            "last": "2026-04-05", "n": 20, "ctd": 0,
            "src": {"chat": 10, "code": 10},
            "_uses_30d": 10, "_impact": 0.8,
        }, NOW)
        assert score > 0.7

    def test_scores_old_unused_low(self):
        score = utility_score({
            "last": "2025-10-01", "n": 2, "ctd": 1,
            "src": {"chat": 2},
            "_uses_30d": 0, "_impact": 0.3,
        }, NOW)
        assert score < 0.3

    def test_defaults_impact_to_05(self):
        score = utility_score({"last": "2026-04-06", "n": 5, "ctd": 0}, NOW)
        assert score > 0

    def test_portability_increases_with_contexts(self):
        one = utility_score({"last": "2026-04-06", "n": 5, "ctd": 0, "src": {"code": 5}}, NOW)
        two = utility_score({"last": "2026-04-06", "n": 5, "ctd": 0, "src": {"code": 3, "chat": 2}}, NOW)
        three = utility_score({"last": "2026-04-06", "n": 5, "ctd": 0, "src": {"code": 2, "chat": 2, "cowork": 1}}, NOW)
        assert two > one
        assert three > two

    def test_stability_decreases_with_contradictions(self):
        stable = utility_score({"last": "2026-04-06", "n": 10, "ctd": 0}, NOW)
        unstable = utility_score({"last": "2026-04-06", "n": 10, "ctd": 5}, NOW)
        assert stable > unstable


def _make_meta() -> LedgerEntryMeta:
    return LedgerEntryMeta(data=SigMeta(
        profile={}, signals=0,
        by_ctx=ContextCounts(chat=0, code=0, cowork=0),
        by_out=OutcomeCounts(),
        avg_conf=0.5, avg_q=1.5, updated="2026-04-06",
    ))


def _make_pref(dim: str, n: int, last: str) -> LedgerEntryPref:
    return LedgerEntryPref(data=SigPref(
        dim=dim, target=dim, w=0.5, n=n,
        src=ContextCounts(code=n), ctd=0, scope="*",
        decay=0.9, last=last,
    ))


class TestIsProtected:
    def test_protects_meta(self):
        assert is_protected(_make_meta()) is True

    def test_protects_proven_rubrics(self):
        rub = LedgerEntryRub(data=SigRub(
            id="rub-001", fmt="report", stage="proven",
            uses=10, accepts=8, avg_ed=0.12,
            dims={"clarity": 0.5, "accuracy": 0.5},
            min=0.7, last="2026-04-01",
        ))
        assert is_protected(rub) is True

    def test_protects_high_evidence_zero_ctd(self):
        pref = LedgerEntryPref(data=SigPref(
            dim="tone", target="direct", w=0.95, n=20,
            src=ContextCounts(code=20), ctd=0, scope="*",
            decay=0.99, last="2026-04-05",
        ))
        assert is_protected(pref) is True

    def test_no_protect_low_evidence(self):
        pref = LedgerEntryPref(data=SigPref(
            dim="tone", target="direct", w=0.5, n=5,
            src=ContextCounts(code=5), ctd=0, scope="*",
            decay=0.9, last="2026-04-05",
        ))
        assert is_protected(pref) is False

    def test_no_protect_with_contradictions(self):
        pref = LedgerEntryPref(data=SigPref(
            dim="tone", target="direct", w=0.95, n=20,
            src=ContextCounts(code=20), ctd=1, scope="*",
            decay=0.99, last="2026-04-05",
        ))
        assert is_protected(pref) is False


class TestPruneToCapacity:
    def test_does_nothing_within_capacity(self):
        entries: list[LedgerEntry] = [_make_meta(), _make_pref("tone", 5, "2026-04-05")]
        kept, evicted = prune_to_capacity(entries, NOW)
        assert len(kept) == 2
        assert len(evicted) == 0

    def test_evicts_lowest_utility(self):
        entries: list[LedgerEntry] = [_make_meta()]
        for i in range(45):
            entries.append(_make_pref(f"dim-{i}", i + 1, "2026-04-05"))
        kept, evicted = prune_to_capacity(entries, NOW)
        assert len(kept) <= 40
        assert len(evicted) > 0

    def test_never_evicts_meta(self):
        entries: list[LedgerEntry] = [_make_meta()]
        for i in range(45):
            entries.append(_make_pref(f"dim-{i}", 1, "2025-01-01"))
        kept, _ = prune_to_capacity(entries, NOW)
        assert any(e.type == "meta" for e in kept)

    def test_never_evicts_protected_prefs(self):
        protected = LedgerEntryPref(data=SigPref(
            dim="protected", target="direct", w=0.95, n=20,
            src=ContextCounts(code=20), ctd=0, scope="*",
            decay=0.99, last="2026-04-05",
        ))
        entries: list[LedgerEntry] = [_make_meta(), protected]
        for i in range(45):
            entries.append(_make_pref(f"dim-{i}", 1, "2025-01-01"))
        kept, _ = prune_to_capacity(entries, NOW)
        assert any(e.type == "pref" and e.data.dim == "protected" for e in kept)
