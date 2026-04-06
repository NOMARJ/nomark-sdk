"""MEE Resolver — intent resolution from preference ledger.

Ports packages/engine/src/resolver.ts.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone

from .schema import LedgerEntry, SigPref, SigMap, SigAsn, LedgerEntryPref, LedgerEntryMap, LedgerEntryAsn
from .decay import effective_weight
from .ledger import parse_ledger


def scope_specificity(scope: str) -> float:
    if scope == "*":
        return 0.3
    if "+" in scope:
        return 1.0
    return 0.7


def scope_matches(scope: str, context: str | None = None, topic: str | None = None) -> bool:
    if scope == "*":
        return True

    for part in scope.split("+"):
        kv = part.split(":", 1)
        if len(kv) != 2:
            continue
        key, value = kv
        if key == "context" and context and value != context:
            return False
        if key == "topic" and topic and value != topic:
            return False

    return True


@dataclass(frozen=True)
class ScoringFactors:
    specificity: float
    evidence: float
    recency: float
    stability: float
    portability: float
    contradiction_penalty: float


@dataclass(frozen=True)
class ScoredPref:
    pref: SigPref
    score: float
    effective_w: float
    factors: ScoringFactors


def resolver_score(pref: SigPref, now: datetime | None = None) -> ScoredPref:
    """Score a preference entry using the five-factor weighted formula."""
    if now is None:
        now = datetime.now(timezone.utc)

    last = datetime.fromisoformat(pref.last)
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    days_since_last = max(0.0, (now - last).total_seconds() / 86400)

    specificity = scope_specificity(pref.scope)
    evidence = min(1.0, pref.n / 20)
    recency = max(0.0, 1.0 - days_since_last / 180)
    stability = (1.0 - (pref.ctd / pref.n)) if pref.n > 0 else 0.5

    portability = 0.0
    if pref.src:
        src_dict = pref.src.model_dump(exclude_none=True)
        portability = sum(1 for v in src_dict.values() if isinstance(v, (int, float)) and v > 0) / 3

    contradiction_penalty = pref.ctd * 0.15

    score = (
        (specificity * 0.30)
        + (evidence * 0.25)
        + (recency * 0.20)
        + (stability * 0.15)
        + (portability * 0.10)
        - contradiction_penalty
    )

    return ScoredPref(
        pref=pref,
        score=round(score * 1000) / 1000,
        effective_w=effective_weight(pref.w, pref.decay),
        factors=ScoringFactors(
            specificity=specificity,
            evidence=evidence,
            recency=recency,
            stability=stability,
            portability=portability,
            contradiction_penalty=contradiction_penalty,
        ),
    )


@dataclass(frozen=True)
class DimensionResult:
    dimension: str
    winner: ScoredPref | None
    runner_up: ScoredPref | None
    unstable: bool
    action: str  # 'use_winner' | 'ask'
    candidates: int


@dataclass(frozen=True)
class MeaningMapMatch:
    trigger: str
    intent: list[str]
    confidence: float
    scope: str


@dataclass(frozen=True)
class DefaultMatch:
    field: str
    default: str
    accuracy: float


@dataclass(frozen=True)
class ResolverMeta:
    entry_count: int
    estimated_tokens: int


@dataclass(frozen=True)
class ResolverResult:
    dimensions: dict[str, DimensionResult]
    meaning_maps: list[MeaningMapMatch]
    defaults: list[DefaultMatch]
    meta: ResolverMeta


def resolve_dimension(
    entries: list[LedgerEntry],
    dimension: str,
    context: str | None = None,
    topic: str | None = None,
    now: datetime | None = None,
) -> DimensionResult:
    if now is None:
        now = datetime.now(timezone.utc)

    candidates = [
        resolver_score(e.data, now)
        for e in entries
        if e.type == "pref" and e.data.dim == dimension and scope_matches(e.data.scope, context, topic)
    ]
    candidates.sort(key=lambda c: c.score, reverse=True)

    if not candidates:
        return DimensionResult(
            dimension=dimension, winner=None, runner_up=None,
            unstable=False, action="ask", candidates=0,
        )

    winner = candidates[0]
    runner_up = candidates[1] if len(candidates) > 1 else None
    unstable = winner.score < 0.4

    return DimensionResult(
        dimension=dimension, winner=winner, runner_up=runner_up,
        unstable=unstable, action="ask" if unstable else "use_winner",
        candidates=len(candidates),
    )


def match_meaning_maps(
    entries: list[LedgerEntry],
    input_text: str,
    context: str | None = None,
    topic: str | None = None,
) -> list[MeaningMapMatch]:
    normalized = input_text.lower().strip()

    results: list[MeaningMapMatch] = []
    for e in entries:
        if e.type != "map":
            continue
        data: SigMap = e.data
        entry_scope = data.scope or "*"
        if normalized.find(data.trigger.lower()) == -1:
            continue
        if not scope_matches(entry_scope, context, topic):
            continue
        results.append(MeaningMapMatch(
            trigger=data.trigger,
            intent=data.intent,
            confidence=data.conf,
            scope=entry_scope,
        ))

    return results


def find_defaults(entries: list[LedgerEntry]) -> list[DefaultMatch]:
    return [
        DefaultMatch(field=e.data.field, default=e.data.default, accuracy=e.data.accuracy)
        for e in entries
        if e.type == "asn"
    ]


_SIGNAL_PREFIX_RE = re.compile(r"^\[sig:(\w+)\]\s+(.+)$")


def _parse_ledger_content(content: str) -> list[LedgerEntry]:
    return parse_ledger(content)


@dataclass
class ResolverConfig:
    ledger_path: str | None = None
    ledger_content: str | None = None
    entries: list[LedgerEntry] | None = None
    context: str | None = None
    topic: str | None = None
    now: datetime | None = None


def _load_entries(config: ResolverConfig) -> list[LedgerEntry]:
    if config.entries is not None:
        return config.entries
    if config.ledger_content is not None:
        return _parse_ledger_content(config.ledger_content)
    return []


class Resolver:
    """Resolver instance created from configuration."""

    def __init__(self, config: ResolverConfig) -> None:
        self._entries = _load_entries(config)
        self._now = config.now or datetime.now(timezone.utc)
        self._context = config.context
        self._topic = config.topic

    def resolve(self, dimension: str) -> DimensionResult:
        return resolve_dimension(self._entries, dimension, self._context, self._topic, self._now)

    def resolve_all(self) -> ResolverResult:
        dimensions: set[str] = set()
        for entry in self._entries:
            if entry.type == "pref":
                dimensions.add(entry.data.dim)

        results: dict[str, DimensionResult] = {}
        for dim in dimensions:
            results[dim] = resolve_dimension(self._entries, dim, self._context, self._topic, self._now)

        return ResolverResult(
            dimensions=results,
            meaning_maps=[],
            defaults=find_defaults(self._entries),
            meta=ResolverMeta(
                entry_count=len(self._entries),
                estimated_tokens=len(self._entries) * 75,
            ),
        )

    def resolve_input(self, input_text: str) -> ResolverResult:
        dimensions: set[str] = set()
        for entry in self._entries:
            if entry.type == "pref":
                dimensions.add(entry.data.dim)

        dim_results: dict[str, DimensionResult] = {}
        for dim in dimensions:
            dim_results[dim] = resolve_dimension(self._entries, dim, self._context, self._topic, self._now)

        return ResolverResult(
            dimensions=dim_results,
            meaning_maps=match_meaning_maps(self._entries, input_text, self._context, self._topic),
            defaults=find_defaults(self._entries),
            meta=ResolverMeta(
                entry_count=len(self._entries),
                estimated_tokens=len(self._entries) * 75,
            ),
        )

    def get_entries(self) -> list[LedgerEntry]:
        return list(self._entries)


def create_resolver(config: ResolverConfig | None = None, **kwargs) -> Resolver:
    """Create a resolver instance from configuration."""
    if config is None:
        config = ResolverConfig(**kwargs)
    return Resolver(config)
