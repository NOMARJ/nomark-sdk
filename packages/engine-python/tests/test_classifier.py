"""Tests for input classifier — ports packages/engine/tests/classifier.test.ts."""

import pytest

from nomark_engine.classifier import classify, _Rule


class TestTier0:
    def test_classifies_confirmations(self):
        for word in ["y", "yes", "no", "n", "ok", "done", "skip", "cancel", "approve", "reject", "confirm"]:
            assert classify(word).tier == 0, f"Expected tier 0 for {word!r}"

    def test_classifies_numeric_selections(self):
        assert classify("3").tier == 0
        assert classify("42").tier == 0

    def test_classifies_json_data(self):
        assert classify('{"key": "value"}').tier == 0
        assert classify("[1, 2, 3]").tier == 0

    def test_classifies_exit_signals(self):
        assert classify("exit").tier == 0
        assert classify("quit").tier == 0

    def test_classifies_commit_hashes(self):
        assert classify("a1b2c3d4").tier == 0
        assert classify("60e2330e9abc1234567890abcdef1234567890ab").tier == 0

    def test_classifies_empty_input(self):
        assert classify("").tier == 0
        assert classify("   ").tier == 0


class TestTier1:
    def test_classifies_skill_invocations(self):
        assert classify("/commit").tier == 1
        assert classify("/autopilot tasks/prd.md").tier == 1

    def test_classifies_continuations(self):
        for word in ["continue", "go ahead", "proceed", "next", "keep going", "resume"]:
            assert classify(word).tier == 1, f"Expected tier 1 for {word!r}"

    def test_classifies_corrections(self):
        assert classify("no, not that").tier == 1
        assert classify("actually, I meant the other file").tier == 1
        assert classify("wait").tier == 1
        assert classify("scratch that").tier == 1
        assert classify("nevermind").tier == 1

    def test_classifies_letter_selections(self):
        assert classify("a").tier == 1
        assert classify("b").tier == 1


class TestTier2:
    def test_classifies_substantive_nl(self):
        assert classify("make the landing page better").tier == 2
        assert classify("refactor the auth middleware to use JWT").tier == 2
        assert classify("write a function that validates email addresses").tier == 2

    def test_classifies_questions(self):
        assert classify("how does the payment flow work?").tier == 2
        assert classify("what is the current test coverage?").tier == 2

    def test_returns_substantive_reason(self):
        result = classify("build a REST API for user management")
        assert result.tier == 2
        assert result.reason == "substantive_input"


class TestCustomRules:
    def test_custom_rules_take_priority(self):
        custom = [_Rule(2, "custom_extraction", lambda s: s.startswith("/custom"))]
        result = classify("/custom command", custom)
        assert result.tier == 2
        assert result.reason == "custom_extraction"

    def test_falls_through_to_defaults(self):
        custom = [_Rule(2, "never_matches", lambda _: False)]
        assert classify("yes", custom).tier == 0
