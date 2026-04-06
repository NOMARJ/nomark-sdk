"""Ledger JSONL parser/writer with capacity constraints.

Ports packages/engine/src/ledger.ts.
"""

from __future__ import annotations

import json
import re

from .schema import LedgerEntry, SignalType, parse_ledger_entry

ENTRY_CAPS: dict[SignalType, int] = {
    "meta": 1,
    "pref": 20,
    "map": 10,
    "asn": 5,
    "rub": 4,
}

TOTAL_CAP = 40

_SIGNAL_PREFIX_RE = re.compile(r"^\[sig:(\w+)\]\s+(.+)$")


def parse_ledger_line(line: str) -> LedgerEntry | None:
    """Parse a single ledger line: `[sig:type] {json}`. Returns None for empty or unparseable lines."""
    trimmed = line.strip()
    if not trimmed:
        return None

    match = _SIGNAL_PREFIX_RE.match(trimmed)
    if not match:
        return None

    signal_type = match.group(1)
    try:
        data = json.loads(match.group(2))
    except (json.JSONDecodeError, ValueError):
        return None

    return parse_ledger_entry(signal_type, data)


def format_ledger_line(entry: LedgerEntry) -> str:
    """Format a ledger entry back to `[sig:type] {json}` string."""
    return f"[sig:{entry.type}] {json.dumps(entry.data.model_dump(exclude_none=True))}"


def parse_ledger(content: str) -> list[LedgerEntry]:
    """Parse a full ledger JSONL string into typed entries."""
    results: list[LedgerEntry] = []
    for line in content.split("\n"):
        entry = parse_ledger_line(line)
        if entry is not None:
            results.append(entry)
    return results


def write_ledger(entries: list[LedgerEntry]) -> str:
    """Serialize ledger entries to JSONL string with typed prefixes."""
    return "\n".join(format_ledger_line(e) for e in entries) + "\n"


def count_by_type(entries: list[LedgerEntry]) -> dict[SignalType, int]:
    """Count entries by type."""
    counts: dict[SignalType, int] = {"meta": 0, "pref": 0, "map": 0, "asn": 0, "rub": 0}
    for entry in entries:
        counts[entry.type] += 1
    return counts


def check_capacity(entries: list[LedgerEntry]) -> list[str]:
    """Check if ledger exceeds capacity constraints. Returns violations or empty list."""
    violations: list[str] = []
    counts = count_by_type(entries)

    if len(entries) > TOTAL_CAP:
        violations.append(f"total {len(entries)} exceeds cap {TOTAL_CAP}")

    for signal_type, cap in ENTRY_CAPS.items():
        count = counts.get(signal_type, 0)
        if count > cap:
            violations.append(f"{signal_type} count {count} exceeds cap {cap}")

    return violations


def estimate_tokens(entries: list[LedgerEntry]) -> int:
    """Estimate token count for ledger entries (~75 tokens per entry)."""
    return len(entries) * 75
