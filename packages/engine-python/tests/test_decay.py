"""Tests for decay computation — ports packages/engine/tests/decay.test.ts."""

import math
from datetime import datetime, timezone

import pytest

from nomark_engine.decay import compute_decay, effective_weight

TODAY = datetime(2026, 4, 6, tzinfo=timezone.utc)


class TestComputeDecay:
    def test_returns_approx_1_for_today(self):
        decay = compute_decay("2026-04-06", 0, 0, False, TODAY)
        assert decay == pytest.approx(1.0, abs=0.01)

    def test_decays_over_30_days(self):
        decay = compute_decay("2026-03-07", 0, 0, False, TODAY)
        assert decay < 1.0
        assert decay > 0.9

    def test_decays_over_180_days(self):
        decay = compute_decay("2025-10-08", 0, 0, False, TODAY)
        assert decay < 0.9
        assert decay >= 0.1

    def test_contradiction_acceleration(self):
        normal = compute_decay("2026-03-07", 0, 0, False, TODAY)
        accelerated = compute_decay("2026-03-07", 5, 2, False, TODAY)
        assert accelerated < normal
        assert accelerated == pytest.approx(normal * 0.85, abs=0.01)

    def test_no_acceleration_below_2_contradictions(self):
        normal = compute_decay("2026-03-07", 5, 1, False, TODAY)
        same = compute_decay("2026-03-07", 0, 0, False, TODAY)
        assert normal == pytest.approx(same, abs=0.001)

    def test_reinforcement_recovery(self):
        normal = compute_decay("2026-03-07", 0, 0, False, TODAY)
        reinforced = compute_decay("2026-03-07", 0, 0, True, TODAY)
        assert reinforced > normal
        assert reinforced == pytest.approx(min(1.0, normal * 1.1), abs=0.01)

    def test_caps_reinforcement_at_1(self):
        decay = compute_decay("2026-04-06", 0, 0, True, TODAY)
        assert decay <= 1.0

    def test_never_below_floor(self):
        decay = compute_decay("2020-01-01", 100, 50, False, TODAY)
        assert decay >= 0.1

    def test_both_contradiction_and_reinforcement(self):
        decay = compute_decay("2026-03-07", 5, 3, True, TODAY)
        base = max(0.1, 0.98 ** (30 / 30))
        with_ctd = max(0.1, base * 0.85)
        with_reinf = min(1.0, with_ctd * 1.1)
        assert decay == pytest.approx(with_reinf, abs=0.01)


class TestEffectiveWeight:
    def test_multiplies_weight_by_decay(self):
        assert effective_weight(0.9, 0.95) == 0.855

    def test_rounds_to_3_decimal_places(self):
        assert effective_weight(0.333, 0.777) == 0.259

    def test_returns_0_when_weight_is_0(self):
        assert effective_weight(0, 0.95) == 0
