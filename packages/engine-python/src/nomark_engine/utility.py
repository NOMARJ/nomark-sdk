"""Utility scoring and capacity-bounded pruning (MEE Spec Section 7.3).

Ports packages/engine/src/utility.ts.

U = (F x 0.25) + (I x 0.25) + (R x 0.20) + (P x 0.15) + (T x 0.15)
"""

from __future__ import annotations

from datetime import datetime, timezone

from .schema import LedgerEntry
from .ledger import ENTRY_CAPS, TOTAL_CAP


def utility_score(
    entry_data: dict,
    now: datetime | None = None,
) -> float:
    """Compute utility score for a ledger entry data dict."""
    if now is None:
        now = datetime.now(timezone.utc)

    last_str = entry_data.get("last", "")
    last = datetime.fromisoformat(last_str) if last_str else now
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    days_since_last = max(0.0, (now - last).total_seconds() / 86400)

    frequency = min(1.0, (entry_data.get("_uses_30d", 0)) / 10)
    impact = entry_data.get("_impact", 0.5)
    recency = max(0.0, 1.0 - days_since_last / 180)

    n = entry_data.get("n", entry_data.get("total", 0))
    ctd = entry_data.get("ctd", 0)

    portability = 0.0
    src = entry_data.get("src")
    if src and isinstance(src, dict):
        portability = sum(1 for v in src.values() if isinstance(v, (int, float)) and v > 0) / 3

    stability = (1.0 - (ctd / n)) if n > 0 else 0.5

    return (frequency * 0.25) + (impact * 0.25) + (recency * 0.20) + (portability * 0.15) + (stability * 0.15)


def is_protected(entry: LedgerEntry) -> bool:
    """Check if an entry is protected from pruning."""
    if entry.type == "meta":
        return True
    if entry.type == "rub" and entry.data.stage in ("proven", "trusted"):
        return True
    if entry.type == "pref" and entry.data.n >= 15 and entry.data.ctd == 0:
        return True
    return False


def _entry_data_dict(entry: LedgerEntry) -> dict:
    """Get entry data as a plain dict for utility scoring."""
    return entry.data.model_dump(exclude_none=True)


def prune_to_capacity(
    entries: list[LedgerEntry],
    now: datetime | None = None,
) -> tuple[list[LedgerEntry], list[LedgerEntry]]:
    """Prune entries to fit within capacity constraints.

    Returns (kept, evicted). Removes lowest-utility entries first, never removes protected entries.
    """
    if now is None:
        now = datetime.now(timezone.utc)

    kept = list(entries)
    evicted: list[LedgerEntry] = []

    # Group by type
    by_type: dict[str, list[tuple[int, LedgerEntry, float]]] = {}
    for i, entry in enumerate(kept):
        t = entry.type
        if t not in by_type:
            by_type[t] = []
        by_type[t].append((i, entry, utility_score(_entry_data_dict(entry), now)))

    # Enforce per-type caps
    to_remove: set[int] = set()
    for signal_type, items in by_type.items():
        cap = ENTRY_CAPS.get(signal_type, 0)  # type: ignore[arg-type]
        if len(items) <= cap:
            continue
        items.sort(key=lambda x: x[2])  # sort by utility ascending
        removed = 0
        for idx, entry, _ in items:
            if len(items) - removed <= cap:
                break
            if not is_protected(entry):
                to_remove.add(idx)
                removed += 1

    # Remove in reverse order
    for idx in sorted(to_remove, reverse=True):
        evicted.append(kept.pop(idx))

    # Enforce total cap
    while len(kept) > TOTAL_CAP:
        lowest_idx = -1
        lowest_utility = float("inf")
        for i, entry in enumerate(kept):
            if is_protected(entry):
                continue
            u = utility_score(_entry_data_dict(entry), now)
            if u < lowest_utility:
                lowest_utility = u
                lowest_idx = i
        if lowest_idx == -1:
            break
        evicted.append(kept.pop(lowest_idx))

    return kept, evicted
