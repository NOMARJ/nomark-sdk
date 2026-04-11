"""Contradiction detection — ports packages/engine/src/detectContradictions.ts."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone

from .decay import effective_weight
from .resolver import ScoredPref, resolver_score
from .schema import LedgerEntry, SigPref


@dataclass(frozen=True)
class ContradictionResolution:
    recommended: ScoredPref
    reason: str
    margin: float


@dataclass(frozen=True)
class Contradiction:
    id: str
    dimension: str
    scope: str
    entries: list[ScoredPref]
    resolution: ContradictionResolution


_NON_WORD_RE = re.compile(r"[^\w]+")


def _sanitize_scope(scope: str) -> str:
    cleaned = _NON_WORD_RE.sub("_", scope).strip("_")
    return cleaned or "global"


def detect_contradictions(
    entries: list[LedgerEntry],
    now: datetime | None = None,
    min_effective_weight: float = 0.1,
) -> list[Contradiction]:
    """Detect contradictions within a ledger of signal entries.

    A contradiction exists when two or more ``pref`` entries share the same
    ``dim`` and ``scope`` but disagree on ``target``. Entries in different
    scopes are treated as clean scoped overrides and are NOT flagged.

    Each contradiction carries a resolution recommendation: the entry with
    the highest five-factor resolver score wins. ``margin`` is the score gap
    between winner and runner-up; a margin at or below 0.05 produces a
    confidence-tiebreak reason string.

    Stale entries whose effective weight (``w * decay``) falls below
    ``min_effective_weight`` are excluded before grouping.
    """
    if now is None:
        now = datetime.now(timezone.utc)

    active: list[SigPref] = []
    for entry in entries:
        if entry.type != "pref":
            continue
        if effective_weight(entry.data.w, entry.data.decay) < min_effective_weight:
            continue
        active.append(entry.data)

    groups: dict[tuple[str, str], list[SigPref]] = {}
    for pref in active:
        key = (pref.dim, pref.scope)
        groups.setdefault(key, []).append(pref)

    contradictions: list[Contradiction] = []
    for group in groups.values():
        if len(group) < 2:
            continue
        if len({p.target for p in group}) < 2:
            continue

        scored = sorted(
            (resolver_score(p, now) for p in group),
            key=lambda s: s.score,
            reverse=True,
        )

        winner = scored[0]
        runner_up = scored[1]
        margin = round((winner.score - runner_up.score) * 1000) / 1000

        if margin > 0.05:
            reason = (
                f'winner "{winner.pref.target}" beats "{runner_up.pref.target}" '
                f"by {margin} (score {winner.score} vs {runner_up.score})"
            )
        else:
            reason = (
                f'confidence tiebreak: "{winner.pref.target}" (score {winner.score}) '
                f'narrowly beats "{runner_up.pref.target}" (score {runner_up.score}) '
                f"— margin {margin}"
            )

        contradictions.append(
            Contradiction(
                id=f"ctd-{winner.pref.dim}-{_sanitize_scope(winner.pref.scope)}",
                dimension=winner.pref.dim,
                scope=winner.pref.scope,
                entries=scored,
                resolution=ContradictionResolution(
                    recommended=winner,
                    reason=reason,
                    margin=margin,
                ),
            )
        )

    return contradictions
