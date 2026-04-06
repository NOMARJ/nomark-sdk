"""Continuous decay computation (MEE Spec Section 8).

Ports packages/engine/src/decay.ts.

Base: max(0.1, 0.98^(days/30))
Contradiction acceleration: decay * 0.85 when recent_contradictions >= 2
Reinforcement recovery: decay * 1.1 (capped 1.0) when reinforced within 7 days
Floor: 0.1 — never total erasure
"""

from __future__ import annotations

from datetime import datetime, timezone


def compute_decay(
    last_date: str,
    _contradictions: int,
    recent_contradictions: int,
    recent_reinforcement: bool,
    now: datetime | None = None,
) -> float:
    if now is None:
        now = datetime.now(timezone.utc)

    last = datetime.fromisoformat(last_date)
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    days_since_last = max(0.0, (now - last).total_seconds() / 86400)

    decay = max(0.1, 0.98 ** (days_since_last / 30))

    if recent_contradictions >= 2:
        decay = max(0.1, decay * 0.85)

    if recent_reinforcement:
        decay = min(1.0, decay * 1.1)

    return round(decay * 1000) / 1000


def effective_weight(w: float, decay: float) -> float:
    return round(w * decay * 1000) / 1000
