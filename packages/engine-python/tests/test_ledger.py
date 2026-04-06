"""Tests for ledger parser/writer — ports packages/engine/tests/ledger.test.ts."""

import json

import pytest

from nomark_engine.schema import (
    SigPref, SigMeta, SigMap, SigAsn,
    ContextCounts, OutcomeCounts,
    LedgerEntryPref, LedgerEntryMeta, LedgerEntryMap, LedgerEntryAsn,
    LedgerEntry,
)
from nomark_engine.ledger import (
    parse_ledger_line, format_ledger_line, parse_ledger, write_ledger,
    count_by_type, check_capacity, estimate_tokens,
    ENTRY_CAPS, TOTAL_CAP,
)

SAMPLE_PREF = LedgerEntryPref(data=SigPref(
    dim="tone", target="direct", w=0.87, n=20,
    src=ContextCounts(chat=8, code=12), ctd=1, scope="*",
    decay=0.97, last="2026-04-05",
))

SAMPLE_META = LedgerEntryMeta(data=SigMeta(
    profile={"tone": "direct"}, signals=47,
    by_ctx=ContextCounts(chat=10, code=30, cowork=7),
    by_out=OutcomeCounts(accepted=30, edited=5, corrected=8, rejected=2, abandoned=2),
    avg_conf=0.82, avg_q=3.2, updated="2026-04-06",
))

SAMPLE_MAP = LedgerEntryMap(data=SigMap(
    trigger="make it shorter", pattern_type="rewrite_request",
    intent=["reduce_length_40pct", "remove_examples"],
    conf=0.91, n=8, scope="*", last="2026-04-03",
))

SAMPLE_ASN = LedgerEntryAsn(data=SigAsn(
    field="audience", default="developers",
    accuracy=0.92, total=25, correct=23, last="2026-04-05",
))


class TestParseLedgerLine:
    def test_parses_valid_pref(self):
        line = f"[sig:pref] {json.dumps(SAMPLE_PREF.data.model_dump(exclude_none=True))}"
        result = parse_ledger_line(line)
        assert result is not None
        assert result.type == "pref"

    def test_parses_valid_meta(self):
        line = f"[sig:meta] {json.dumps(SAMPLE_META.data.model_dump(exclude_none=True))}"
        result = parse_ledger_line(line)
        assert result is not None
        assert result.type == "meta"

    def test_returns_none_for_empty(self):
        assert parse_ledger_line("") is None
        assert parse_ledger_line("  ") is None

    def test_returns_none_without_prefix(self):
        assert parse_ledger_line("just some text") is None
        assert parse_ledger_line('{"json": true}') is None

    def test_returns_none_for_malformed_json(self):
        assert parse_ledger_line("[sig:pref] not-json") is None

    def test_returns_none_for_unknown_type(self):
        assert parse_ledger_line("[sig:unknown] {}") is None


class TestFormatLedgerLine:
    def test_formats_pref(self):
        line = format_ledger_line(SAMPLE_PREF)
        assert line.startswith("[sig:pref] {")
        assert '"dim":"tone"' in line.replace(" ", "").replace(": ", ":")

    def test_roundtrips(self):
        line = format_ledger_line(SAMPLE_PREF)
        parsed = parse_ledger_line(line)
        assert parsed is not None
        assert parsed.type == SAMPLE_PREF.type
        assert parsed.data.model_dump(exclude_none=True) == SAMPLE_PREF.data.model_dump(exclude_none=True)


class TestParseLedger:
    def test_parses_multi_line(self):
        content = "\n".join([
            format_ledger_line(SAMPLE_META),
            format_ledger_line(SAMPLE_PREF),
            format_ledger_line(SAMPLE_MAP),
            "",
        ])
        entries = parse_ledger(content)
        assert len(entries) == 3
        assert entries[0].type == "meta"
        assert entries[1].type == "pref"
        assert entries[2].type == "map"

    def test_skips_malformed(self):
        content = "\n".join([
            format_ledger_line(SAMPLE_META),
            "garbage line",
            format_ledger_line(SAMPLE_PREF),
        ])
        entries = parse_ledger(content)
        assert len(entries) == 2

    def test_handles_empty(self):
        assert len(parse_ledger("")) == 0


class TestWriteLedger:
    def test_serializes_to_jsonl(self):
        entries: list[LedgerEntry] = [SAMPLE_META, SAMPLE_PREF]
        content = write_ledger(entries)
        lines = content.strip().split("\n")
        assert len(lines) == 2
        assert lines[0].startswith("[sig:meta]")
        assert lines[1].startswith("[sig:pref]")

    def test_ends_with_newline(self):
        content = write_ledger([SAMPLE_META])
        assert content.endswith("\n")

    def test_roundtrips(self):
        original: list[LedgerEntry] = [SAMPLE_META, SAMPLE_PREF, SAMPLE_MAP, SAMPLE_ASN]
        content = write_ledger(original)
        parsed = parse_ledger(content)
        assert len(parsed) == len(original)
        for orig, pars in zip(original, parsed):
            assert orig.type == pars.type


class TestCountByType:
    def test_counts_correctly(self):
        entries: list[LedgerEntry] = [SAMPLE_META, SAMPLE_PREF, SAMPLE_PREF, SAMPLE_MAP, SAMPLE_ASN]
        counts = count_by_type(entries)
        assert counts == {"meta": 1, "pref": 2, "map": 1, "asn": 1, "rub": 0}


class TestCheckCapacity:
    def test_valid_ledger(self):
        assert check_capacity([SAMPLE_META, SAMPLE_PREF]) == []

    def test_detects_total_cap(self):
        entries: list[LedgerEntry] = [SAMPLE_META]
        for i in range(TOTAL_CAP):
            entries.append(LedgerEntryPref(data=SigPref(
                dim=f"dim-{i}", target="x", w=0.5, n=1,
                src=ContextCounts(), ctd=0, scope="*", decay=0.9, last="2026-04-05",
            )))
        violations = check_capacity(entries)
        assert any("total" in v for v in violations)

    def test_detects_per_type_cap(self):
        entries: list[LedgerEntry] = [SAMPLE_META, SAMPLE_META]
        violations = check_capacity(entries)
        assert any("meta" in v for v in violations)


class TestEstimateTokens:
    def test_estimates_75_per_entry(self):
        assert estimate_tokens([SAMPLE_META, SAMPLE_PREF]) == 150

    def test_estimates_0_for_empty(self):
        assert estimate_tokens([]) == 0
