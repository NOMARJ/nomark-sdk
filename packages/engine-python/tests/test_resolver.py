"""Tests for MEE Resolver — ports packages/engine/tests/resolver.test.ts."""

from datetime import datetime, timezone

import pytest

from nomark_engine.schema import (
    SigPref, SigMap, SigAsn, SigMeta,
    ContextCounts, OutcomeCounts,
    LedgerEntryPref, LedgerEntryMap, LedgerEntryAsn, LedgerEntryMeta,
    LedgerEntry,
)
from nomark_engine.resolver import (
    scope_specificity, scope_matches, resolver_score,
    resolve_dimension, match_meaning_maps, find_defaults,
    create_resolver, ResolverConfig,
)

NOW = datetime(2026, 4, 6, tzinfo=timezone.utc)


def make_pref(**overrides) -> SigPref:
    defaults = dict(
        dim="tone", target="direct", w=0.87, n=20,
        src=ContextCounts(chat=8, code=12), ctd=1, scope="*",
        decay=0.97, last="2026-04-05",
    )
    defaults.update(overrides)
    return SigPref(**defaults)


class TestScopeSpecificity:
    def test_global(self):
        assert scope_specificity("*") == 0.3

    def test_single(self):
        assert scope_specificity("context:code") == 0.7

    def test_compound(self):
        assert scope_specificity("context:chat+topic:investor") == 1.0


class TestScopeMatches:
    def test_global_matches_everything(self):
        assert scope_matches("*", "code", "auth") is True
        assert scope_matches("*") is True

    def test_context_scope(self):
        assert scope_matches("context:code", "code") is True
        assert scope_matches("context:code", "chat") is False

    def test_compound_scope(self):
        assert scope_matches("context:chat+topic:investor", "chat", "investor") is True
        assert scope_matches("context:chat+topic:investor", "code", "investor") is False

    def test_no_filter(self):
        assert scope_matches("context:code") is True


class TestResolverScore:
    def test_higher_for_specific_scopes(self):
        g = resolver_score(make_pref(scope="*"), NOW)
        s = resolver_score(make_pref(scope="context:code"), NOW)
        c = resolver_score(make_pref(scope="context:code+topic:auth"), NOW)
        assert s.score > g.score
        assert c.score > s.score

    def test_higher_with_more_evidence(self):
        low = resolver_score(make_pref(n=2), NOW)
        high = resolver_score(make_pref(n=20), NOW)
        assert high.score > low.score

    def test_higher_for_recent(self):
        recent = resolver_score(make_pref(last="2026-04-05"), NOW)
        old = resolver_score(make_pref(last="2025-10-01"), NOW)
        assert recent.score > old.score

    def test_penalizes_contradictions(self):
        stable = resolver_score(make_pref(ctd=0), NOW)
        contradicted = resolver_score(make_pref(ctd=5), NOW)
        assert contradicted.score < stable.score

    def test_higher_with_more_sources(self):
        one = resolver_score(make_pref(src=ContextCounts(code=20)), NOW)
        two = resolver_score(make_pref(src=ContextCounts(code=10, chat=10)), NOW)
        assert two.score > one.score

    def test_includes_factor_breakdown(self):
        scored = resolver_score(make_pref(), NOW)
        assert scored.factors.specificity is not None
        assert scored.factors.evidence is not None
        assert scored.factors.recency is not None
        assert scored.factors.stability is not None
        assert scored.factors.portability is not None
        assert scored.factors.contradiction_penalty is not None

    def test_effective_weight(self):
        scored = resolver_score(make_pref(w=0.9, decay=0.95), NOW)
        assert scored.effective_w == pytest.approx(0.855, abs=0.01)


class TestResolveDimension:
    entries: list[LedgerEntry] = [
        LedgerEntryPref(data=make_pref(dim="tone", target="direct", scope="*", n=20)),
        LedgerEntryPref(data=make_pref(dim="tone", target="formal", scope="context:chat+topic:investor", n=6)),
        LedgerEntryPref(data=make_pref(dim="length", target="short", scope="*", n=15)),
    ]

    def test_resolves_highest_scoring(self):
        result = resolve_dimension(self.entries, "tone", now=NOW)
        assert result.winner is not None
        assert result.candidates == 2
        assert result.action == "use_winner"

    def test_prefers_scoped_match(self):
        result = resolve_dimension(self.entries, "tone", "chat", "investor", NOW)
        assert result.winner is not None
        assert result.winner.pref.scope == "context:chat+topic:investor"

    def test_returns_ask_no_candidates(self):
        result = resolve_dimension(self.entries, "audience", now=NOW)
        assert result.winner is None
        assert result.action == "ask"
        assert result.candidates == 0

    def test_detects_instability(self):
        weak: list[LedgerEntry] = [
            LedgerEntryPref(data=make_pref(dim="x", n=1, ctd=3, last="2025-06-01", src=ContextCounts())),
        ]
        result = resolve_dimension(weak, "x", now=NOW)
        assert result.unstable is True
        assert result.action == "ask"

    def test_filters_non_matching_scope(self):
        result = resolve_dimension(self.entries, "tone", "code", now=NOW)
        assert result.candidates == 1
        assert result.winner is not None
        assert result.winner.pref.scope == "*"


class TestMatchMeaningMaps:
    entries: list[LedgerEntry] = [
        LedgerEntryMap(data=SigMap(
            trigger="make it shorter", pattern_type="rewrite_request",
            intent=["reduce_length_40pct", "remove_examples", "keep_structure"],
            conf=0.91, n=8, scope="*", last="2026-04-03",
        )),
        LedgerEntryMap(data=SigMap(
            trigger="more professional", pattern_type="style_override",
            intent=["formal_register", "remove_contractions"],
            conf=0.85, n=5, last="2026-04-02",
        )),
    ]

    def test_matches_exact_phrase(self):
        matches = match_meaning_maps(self.entries, "please make it shorter")
        assert len(matches) == 1
        assert matches[0].trigger == "make it shorter"
        assert "reduce_length_40pct" in matches[0].intent

    def test_case_insensitive(self):
        matches = match_meaning_maps(self.entries, "Make It Shorter please")
        assert len(matches) == 1

    def test_no_match(self):
        matches = match_meaning_maps(self.entries, "add more detail")
        assert len(matches) == 0

    def test_multiple_matches(self):
        matches = match_meaning_maps(self.entries, "make it shorter and more professional")
        assert len(matches) == 2


class TestFindDefaults:
    entries: list[LedgerEntry] = [
        LedgerEntryPref(data=make_pref()),
        LedgerEntryAsn(data=SigAsn(
            field="audience", default="developers",
            accuracy=0.92, total=25, correct=23, last="2026-04-05",
        )),
    ]

    def test_extracts_defaults(self):
        defaults = find_defaults(self.entries)
        assert len(defaults) == 1
        assert defaults[0].field == "audience"
        assert defaults[0].default == "developers"
        assert defaults[0].accuracy == 0.92

    def test_ignores_non_asn(self):
        defaults = find_defaults([LedgerEntryPref(data=make_pref())])
        assert len(defaults) == 0


class TestCreateResolver:
    entries: list[LedgerEntry] = [
        LedgerEntryMeta(data=SigMeta(
            profile={"tone": "direct"}, signals=47,
            by_ctx=ContextCounts(chat=10, code=30, cowork=7),
            by_out=OutcomeCounts(accepted=30),
            avg_conf=0.82, avg_q=3.2, updated="2026-04-06",
        )),
        LedgerEntryPref(data=make_pref(dim="tone", target="direct", scope="*", n=20)),
        LedgerEntryPref(data=make_pref(dim="tone", target="formal", scope="context:chat+topic:investor", n=6)),
        LedgerEntryPref(data=make_pref(dim="length", target="short", scope="*", n=15)),
        LedgerEntryMap(data=SigMap(
            trigger="make it shorter", pattern_type="rewrite_request",
            intent=["reduce_length_40pct"], conf=0.91, n=8, scope="*", last="2026-04-03",
        )),
        LedgerEntryAsn(data=SigAsn(
            field="audience", default="developers",
            accuracy=0.92, total=25, correct=23, last="2026-04-05",
        )),
    ]

    def test_resolves_single_dimension(self):
        resolver = create_resolver(ResolverConfig(entries=self.entries, now=NOW))
        result = resolver.resolve("tone")
        assert result.winner is not None
        assert result.candidates == 2

    def test_resolves_all(self):
        resolver = create_resolver(ResolverConfig(entries=self.entries, now=NOW))
        result = resolver.resolve_all()
        assert "tone" in result.dimensions
        assert "length" in result.dimensions
        assert len(result.defaults) == 1
        assert result.meta.entry_count == 6

    def test_resolves_input_with_meaning_maps(self):
        resolver = create_resolver(ResolverConfig(entries=self.entries, now=NOW))
        result = resolver.resolve_input("make it shorter and direct")
        assert len(result.meaning_maps) == 1
        assert "reduce_length_40pct" in result.meaning_maps[0].intent
        assert result.dimensions["tone"].winner is not None

    def test_respects_context_filter(self):
        resolver = create_resolver(ResolverConfig(
            entries=self.entries, context="chat", topic="investor", now=NOW,
        ))
        result = resolver.resolve("tone")
        assert result.winner is not None
        assert result.winner.pref.scope == "context:chat+topic:investor"

    def test_returns_entries_copy(self):
        resolver = create_resolver(ResolverConfig(entries=self.entries, now=NOW))
        returned = resolver.get_entries()
        assert len(returned) == len(self.entries)
        assert returned is not self.entries
