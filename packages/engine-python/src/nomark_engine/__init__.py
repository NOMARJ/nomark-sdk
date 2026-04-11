"""NOMARK Engine — open-core agent outcome quality resolver."""

__version__ = "0.2.0"

from .schema import (
    Context, Outcome, RequestType, PatternType, RubricStage, SignalType, Scope,
    ContextCounts, OutcomeCounts,
    SigPref, SigMap, SigAsn, SigMeta, SigRub,
    LedgerEntryMeta, LedgerEntryPref, LedgerEntryMap, LedgerEntryAsn, LedgerEntryRub,
    LedgerEntry,
    parse_ledger_entry,
)
from .decay import compute_decay, effective_weight
from .ledger import (
    parse_ledger, write_ledger, parse_ledger_line, format_ledger_line,
    count_by_type, check_capacity, estimate_tokens,
    ENTRY_CAPS, TOTAL_CAP,
)
from .utility import utility_score, is_protected, prune_to_capacity
from .classifier import classify, ClassificationResult, InputTier
from .resolver import (
    scope_specificity, scope_matches, resolver_score,
    resolve_dimension, match_meaning_maps, find_defaults,
    create_resolver, Resolver, ResolverConfig, ResolverResult,
    DimensionResult, MeaningMapMatch, DefaultMatch, ScoredPref, ScoringFactors, ResolverMeta,
)
from .detect_contradictions import (
    detect_contradictions, Contradiction, ContradictionResolution,
)

__all__ = [
    # Schema types
    "Context", "Outcome", "RequestType", "PatternType", "RubricStage", "SignalType", "Scope",
    "ContextCounts", "OutcomeCounts",
    "SigPref", "SigMap", "SigAsn", "SigMeta", "SigRub",
    "LedgerEntryMeta", "LedgerEntryPref", "LedgerEntryMap", "LedgerEntryAsn", "LedgerEntryRub",
    "LedgerEntry",
    "parse_ledger_entry",
    # Decay
    "compute_decay", "effective_weight",
    # Ledger
    "parse_ledger", "write_ledger", "parse_ledger_line", "format_ledger_line",
    "count_by_type", "check_capacity", "estimate_tokens",
    "ENTRY_CAPS", "TOTAL_CAP",
    # Utility
    "utility_score", "is_protected", "prune_to_capacity",
    # Classifier
    "classify", "ClassificationResult", "InputTier",
    # Resolver
    "scope_specificity", "scope_matches", "resolver_score",
    "resolve_dimension", "match_meaning_maps", "find_defaults",
    "create_resolver", "Resolver", "ResolverConfig", "ResolverResult",
    "DimensionResult", "MeaningMapMatch", "DefaultMatch", "ScoredPref", "ScoringFactors", "ResolverMeta",
    # Contradictions
    "detect_contradictions", "Contradiction", "ContradictionResolution",
]
