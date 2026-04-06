"""Input classification (MEE Spec Section 1.1).

Ports packages/engine/src/classifier.ts.

Tier 0: Pass-through — already resolved. Confirmations, selections, JSON, exit codes.
Tier 1: Routing — match to established pattern. Skill invocations, continuations, corrections.
Tier 2: Extraction — full intent reconstruction through resolver + gate.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Literal, Protocol


InputTier = Literal[0, 1, 2]


@dataclass(frozen=True)
class ClassificationResult:
    tier: InputTier
    reason: str


class ClassifierRule(Protocol):
    tier: InputTier
    reason: str

    def test(self, input: str) -> bool: ...


@dataclass(frozen=True)
class _Rule:
    tier: InputTier
    reason: str
    _test: object  # callable

    def test(self, input: str) -> bool:
        return self._test(input)  # type: ignore[operator]


def _is_confirmation(s: str) -> bool:
    return bool(re.match(
        r"^(y|yes|no|n|ok|done|skip|cancel|approve|reject|confirm|confirmed)$",
        s.strip(), re.IGNORECASE,
    ))


def _is_numeric(s: str) -> bool:
    return bool(re.match(r"^[0-9]+$", s.strip()))


def _is_json(s: str) -> bool:
    t = s.strip()
    if not (t.startswith("{") or t.startswith("[")):
        return False
    try:
        json.loads(s)
        return True
    except (json.JSONDecodeError, ValueError):
        return False


def _is_exit(s: str) -> bool:
    return bool(re.match(r"^(exit|quit|bye|stop)\s*$", s.strip(), re.IGNORECASE))


def _is_hash(s: str) -> bool:
    return bool(re.match(r"^[a-f0-9]{6,40}$", s.strip(), re.IGNORECASE))


def _is_skill(s: str) -> bool:
    return bool(re.match(r"^/\w", s.strip()))


def _is_continuation(s: str) -> bool:
    return bool(re.match(
        r"^(continue|go ahead|proceed|next|keep going|resume)\s*$",
        s.strip(), re.IGNORECASE,
    ))


def _is_correction(s: str) -> bool:
    t = s.strip()
    return bool(
        re.match(r"^(no[,.]?\s+(not that|wrong|different|the other|I meant))", t, re.IGNORECASE)
        or re.match(r"^(actually|wait|hold on|scratch that|never\s?mind)", t, re.IGNORECASE)
    )


def _is_letter_selection(s: str) -> bool:
    t = s.strip()
    return 0 < len(t) <= 3 and bool(re.match(r"^[a-z]$", t, re.IGNORECASE))


_TIER_0_RULES: list[_Rule] = [
    _Rule(0, "confirmation", _is_confirmation),
    _Rule(0, "numeric_selection", _is_numeric),
    _Rule(0, "json_data", _is_json),
    _Rule(0, "exit_signal", _is_exit),
    _Rule(0, "hash_or_id", _is_hash),
]

_TIER_1_RULES: list[_Rule] = [
    _Rule(1, "skill_invocation", _is_skill),
    _Rule(1, "continuation", _is_continuation),
    _Rule(1, "correction", _is_correction),
    _Rule(1, "letter_selection", _is_letter_selection),
]


def classify(input: str, custom_rules: list[_Rule] | None = None) -> ClassificationResult:
    """Classify input into Tier 0 (pass-through), Tier 1 (routing), or Tier 2 (extraction)."""
    trimmed = input.strip()

    if not trimmed:
        return ClassificationResult(tier=0, reason="empty_input")

    if custom_rules:
        for rule in custom_rules:
            if rule.test(trimmed):
                return ClassificationResult(tier=rule.tier, reason=rule.reason)

    for rule in _TIER_0_RULES:
        if rule.test(trimmed):
            return ClassificationResult(tier=rule.tier, reason=rule.reason)

    for rule in _TIER_1_RULES:
        if rule.test(trimmed):
            return ClassificationResult(tier=rule.tier, reason=rule.reason)

    return ClassificationResult(tier=2, reason="substantive_input")
