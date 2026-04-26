import { BaseResolver, type VerbHandler } from '../core/resolver.js'
import { buildLinearChain, hasFlowVerbs, partitionVerbs, type Composition, type ComputeVerb, type Verb } from '../core/ir.js'

type FetchParams = { source?: { type?: string; config?: { url?: string } } }
type ValidateParams = {
  rules?: unknown[]
  on_fail?: { action?: string; target?: string }
}
type MapParams = { expression?: string; project?: Record<string, string> }
type FilterParams = { predicate?: string }
type ReduceParams = { expression?: string }
type PersistParams = { sink?: { type?: string; config?: { table?: string } } }
type EmitParams = { target?: { config?: { url?: string; channel?: string } } }
type EnrichParams = { with?: Record<string, unknown> }
type DeleteParams = { sink?: { config?: { table?: string } }; predicate?: string }
type StreamParams = { source?: { config?: { table?: string } }; batch_size?: number }
type InlineTarget = { verb: string; params?: Record<string, unknown> }
type RetryParams = {
  of?: InlineTarget
  policy?: { max?: number; delay_ms?: number; backoff?: 'linear' | 'exponential'; jitter?: boolean }
  error_route?: string
}
type CompensateParams = {
  receipt_from?: string
  reverse?: InlineTarget
  idempotent?: boolean
  reason?: string
}
type ErrorParams = {
  of?: InlineTarget
  catch?: string[]
  handler?: InlineTarget
  terminate_on_match?: boolean
}
type AwaitParams = { event?: { topic?: string }; timeout_ms?: number; timeout_route?: string }
type BranchParams = { conditions?: { when?: string; then?: string }[]; default?: string }
type SplitParams = { strategy?: string; targets?: string[] }
type MergeParams = { sources?: string[]; strategy?: string; timeout_ms?: number; combine?: string; from?: string }
type GateParams = { actor?: { role?: string; id?: string }; prompt?: string; options?: string[]; timeout_ms?: number; default_route?: string }
type SignalParams = { system?: string; signal?: { type?: string; url?: string }; timeout_ms?: number; timeout_route?: string }
type TerminateParams = { reason?: string; status?: string; cleanup?: string[] }

const PREAMBLE_HELPERS = `from __future__ import annotations
import asyncio
import dataclasses
import json
import os
import random
import re
import time
import uuid
from typing import Any, Callable, Dict, List, Optional
@dataclasses.dataclass
class Ctx:
    input: Any = None
    values: Dict[str, Any] = dataclasses.field(default_factory=dict)
    receipts: Dict[str, Dict[str, Any]] = dataclasses.field(default_factory=dict)
async def _retry(fn: Callable[[], Any], max_attempts: int, delay_ms: int,
                 backoff: str = "exponential", jitter: bool = False) -> Any:
    last_err: Optional[BaseException] = None
    for attempt in range(max_attempts):
        try:
            return await fn()
        except Exception as e:
            last_err = e
        base = delay_ms * (2 ** attempt) if backoff == "exponential" else delay_ms * (attempt + 1)
        wait = base * (0.5 + random.random()) if jitter else base
        await asyncio.sleep(wait / 1000.0)
    raise last_err  # type: ignore[misc]
def _receipt(sink: str, reversible: bool = True) -> Dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sink": sink,
        "reversible": reversible,
    }
def _predicate(expr: str, row: Any) -> bool:
    """Opaque expression evaluator — spec §3.1. Resolver chose Python eval."""
    return bool(eval(expr, {"__builtins__": {}}, {"row": row, "r": row}))
def _project(expr: str, input: Any) -> Any:
    return eval(expr, {"__builtins__": {"len": len, "sum": sum, "min": min, "max": max}},
                {"input": input, "row": input, "r": input})
def _reduce(expr: str, items: List[Any], initial: Any) -> Any:
    m = re.match(r"^group_by\\(([^)]+)\\)\\.(sum|count|avg|min|max)\\(([^)]*)\\)$", expr)
    if m:
        key_expr, op, field = m.group(1), m.group(2), m.group(3)
        groups: Dict[Any, List[Any]] = {}
        for row in items:
            k = _project(key_expr, row)
            groups.setdefault(k, []).append(row)
        out: Dict[str, Any] = {}
        for k, rows in groups.items():
            if op == "count":
                out[str(k)] = len(rows)
                continue
            vals = [_project(field, r) for r in rows]
            if op == "sum": out[str(k)] = sum(vals)
            elif op == "avg": out[str(k)] = sum(vals) / len(vals)
            elif op == "min": out[str(k)] = min(vals)
            elif op == "max": out[str(k)] = max(vals)
        return out
    m2 = re.match(r"^(sum|count|avg|min|max)\\(([^)]*)\\)$", expr)
    if m2:
        op, field = m2.group(1), m2.group(2)
        if op == "count": return len(items)
        vals = [_project(field, r) for r in items]
        if op == "sum": return sum(vals)
        if op == "avg": return sum(vals) / len(vals) if vals else 0
        if op == "min": return min(vals) if vals else None
        if op == "max": return max(vals) if vals else None
    # generic lambda fallback: expr must name 'acc' and 'row'
    acc = initial
    for row in items:
        acc = eval(expr, {"__builtins__": {}}, {"acc": acc, "row": row})
    return acc`

/** Python-dict-style literal for rules array. `json.dumps` style: spaces after `:` and `,`. */
function pyLit(v: unknown): string {
  if (v === null) return 'None'
  if (typeof v === 'string') return JSON.stringify(v)
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'True' : 'False'
  if (Array.isArray(v)) return `[${v.map(pyLit).join(', ')}]`
  if (typeof v === 'object') {
    const pairs = Object.entries(v as Record<string, unknown>).map(
      ([k, val]) => `${JSON.stringify(k)}: ${pyLit(val)}`,
    )
    return `{${pairs.join(', ')}}`
  }
  return 'None'
}

export class PythonBackend extends BaseResolver {
  readonly label = 'python'

  protected handlers: Partial<Record<ComputeVerb, VerbHandler>> = {
    FETCH: (v) => this.emitFetch(v),
    VALIDATE: (v) => this.emitValidate(v),
    MAP: (v) => this.emitMap(v),
    FILTER: (v) => this.emitFilter(v),
    REDUCE: (v) => this.emitReduce(v),
    PERSIST: (v) => this.emitPersist(v),
    EMIT: (v) => this.emitEmit(v),
    ENRICH: (v) => this.emitEnrich(v),
    DELETE: (v) => this.emitDelete(v),
    STREAM: (v) => this.emitStream(v),
    RETRY: (v) => this.emitRetry(v),
    COMPENSATE: (v) => this.emitCompensate(v),
    ERROR: (v) => this.emitError(v),
    AWAIT: (v) => this.emitAwait(v),
    BRANCH: (v) => this.emitBranch(v),
    SPLIT: (v) => this.emitSplit(v),
    MERGE: (v) => this.emitMerge(v),
    GATE: (v) => this.emitGate(v),
    SIGNAL: (v) => this.emitSignal(v),
    TERMINATE: (v) => this.emitTerminate(v),
  }

  protected override bodySeparator(): string {
    return '\n\n'
  }

  protected rootFileName(c: Composition): string {
    return `${c.name}.py`
  }

  protected emitPreamble(c: Composition): string {
    const header = [
      '"""',
      'Generated by NOMARK Intents resolver (target: python).',
      `Composition: ${c.name} v${c.version}`,
      c.description ?? '',
      '"""',
    ].join('\n')
    return `${header}\n${PREAMBLE_HELPERS}`
  }

  protected emitPostamble(c: Composition): string {
    const { compute } = partitionVerbs(c)
    if (!hasFlowVerbs(c)) {
      // Linear form (BC-preserved): identical to pre-W5 emission.
      const first = compute[0]?.id ?? 'start'
      const cases = compute
        .map((v, i) => {
          const next = compute[i + 1]
          const middleLine = next
            ? `await _execute(${JSON.stringify(next.id)}, ctx)`
            : 'return'
          return `    if vid == ${JSON.stringify(v.id)}:
        ctx.values[${JSON.stringify(v.id)}] = await ${v.id}(ctx)
        ${middleLine}
        return`
        })
        .join('\n')

      return `async def _execute(vid: str, ctx: Ctx) -> None:
${cases}
    raise ValueError(f"unknown verb id: {vid}")

async def run(input: Any = None) -> Ctx:
    ctx = Ctx(input=input)
    await _execute(${JSON.stringify(first)}, ctx)
    return ctx


if __name__ == "__main__":
    asyncio.run(run())
`
    }

    // Graph form: linear chain respects SPLIT-children + self-dispatching verbs.
    const chain = buildLinearChain(c)
    const cases = compute
      .map((v) => {
        const linearNext = chain.next.get(v.id)
        const middleLine = linearNext
          ? `await _execute(${JSON.stringify(linearNext)}, ctx)`
          : 'return'
        return `    if vid == ${JSON.stringify(v.id)}:
        ctx.values[${JSON.stringify(v.id)}] = await ${v.id}(ctx)
        ${middleLine}
        return`
      })
      .join('\n')

    return `class _TerminateError(Exception):
    def __init__(self, reason: str, status: str):
        super().__init__(f"__TERMINATE: {reason}")
        self.reason = reason
        self.status = status

async def _execute(vid: str, ctx: Ctx) -> None:
${cases}
    raise ValueError(f"unknown verb id: {vid}")

async def run(input: Any = None) -> Ctx:
    ctx = Ctx(input=input)
    try:
        await _execute(${JSON.stringify(chain.entry ?? 'start')}, ctx)
    except _TerminateError:
        pass
    return ctx


if __name__ == "__main__":
    asyncio.run(run())
`
  }

  private emitFetch(v: Verb): string {
    const p = (v.params ?? {}) as FetchParams
    const url = p.source?.config?.url ?? ''
    return `async def ${v.id}(ctx: Ctx) -> Any:
    import httpx
    async with httpx.AsyncClient() as client:
        r = await client.request("GET", ${JSON.stringify(url)}, json=None)
        r.raise_for_status()
        return r.json()
`
  }

  private emitValidate(v: Verb): string {
    const p = (v.params ?? {}) as ValidateParams
    const rules = pyLit(p.rules ?? [])
    const action = p.on_fail?.action ?? 'flag'
    const routeTarget = p.on_fail?.target ?? ''
    return `async def ${v.id}(ctx: Ctx) -> Any:
    input = ctx.input
    rules = ${rules}
    validator = globals().get("__validator__")
    ok = validator(rules, input) if validator else True
    if not ok:
        action = ${JSON.stringify(action)}
        if action == "reject":
            raise ValueError("VALIDATE ${v.id} failed")
        if action == "route":
            await _execute(${JSON.stringify(routeTarget)}, ctx)
            return ctx.values.get(${JSON.stringify(routeTarget)})
        if action == "flag":
            return {**(input if isinstance(input, dict) else {"value": input}), "__flagged": True}
    return input
`
  }

  private emitMap(v: Verb): string {
    const p = (v.params ?? {}) as MapParams
    const expr = p.expression ?? this.projectToExpression(p.project)
    return `async def ${v.id}(ctx: Ctx) -> Any:
    input = ctx.input
    return _project(${JSON.stringify(expr)}, input)
`
  }

  private projectToExpression(project: Record<string, string> | undefined): string {
    if (!project) return 'row'
    const pairs = Object.entries(project).map(([k, e]) => `${k}: ${e}`)
    return `{ ${pairs.join(', ')} }`
  }

  private emitFilter(v: Verb): string {
    const p = (v.params ?? {}) as FilterParams
    const pred = p.predicate ?? 'True'
    return `async def ${v.id}(ctx: Ctx) -> List[Any]:
    input = ctx.input or []
    return [row for row in input if _predicate(${JSON.stringify(pred)}, row)]
`
  }

  private emitReduce(v: Verb): string {
    const p = (v.params ?? {}) as ReduceParams
    const expr = p.expression ?? 'row'
    return `async def ${v.id}(ctx: Ctx) -> Any:
    input = ctx.input or []
    return _reduce(${JSON.stringify(expr)}, input, None)
`
  }

  private emitPersist(v: Verb): string {
    const p = (v.params ?? {}) as PersistParams
    const table = p.sink?.config?.table ?? 'unknown_table'
    return `async def ${v.id}(ctx: Ctx) -> Any:
    input = ctx.input
    import asyncpg
    conn = await asyncpg.connect(os.environ.get("DATABASE_URL", ""))
    try:
        rows = input if isinstance(input, list) else [input]
        for row in rows:
            keys = list(row.keys())
            placeholders = ", ".join(f"$" + str(i+1) for i in range(len(keys)))
            cols = ", ".join(keys)
            sql = f'INSERT INTO ${table} ({cols}) VALUES ({placeholders})'
            await conn.execute(sql, *[row[k] for k in keys])
    finally:
        await conn.close()
    receipt = _receipt("sql:${table}")
    ctx.receipts[${JSON.stringify(v.id)}] = receipt
    return receipt
`
  }

  private emitEnrich(v: Verb): string {
    const p = (v.params ?? {}) as EnrichParams
    const extras = pyLit(p.with ?? {})
    return `async def ${v.id}(ctx: Ctx) -> Any:
    input = ctx.input
    extras = ${extras}
    if isinstance(input, list):
        return [{**(r if isinstance(r, dict) else {"value": r}), **extras} for r in input]
    return {**(input if isinstance(input, dict) else {"value": input}), **extras}
`
  }

  private emitDelete(v: Verb): string {
    const p = (v.params ?? {}) as DeleteParams
    const table = p.sink?.config?.table ?? 'unknown_table'
    const predicate = p.predicate ?? 'TRUE'
    return `async def ${v.id}(ctx: Ctx) -> Any:
    import asyncpg
    conn = await asyncpg.connect(os.environ.get("DATABASE_URL", ""))
    try:
        await conn.execute('DELETE FROM ${table} WHERE ${predicate}')
    finally:
        await conn.close()
    receipt = _receipt("sql:${table}", False)
    ctx.receipts[${JSON.stringify(v.id)}] = receipt
    return receipt
`
  }

  private emitStream(v: Verb): string {
    const p = (v.params ?? {}) as StreamParams
    const table = p.source?.config?.table ?? 'unknown_table'
    return `async def ${v.id}(ctx: Ctx) -> List[Any]:
    # STREAM: host should adapt this to async iteration over a real cursor.
    import asyncpg
    conn = await asyncpg.connect(os.environ.get("DATABASE_URL", ""))
    try:
        rows = await conn.fetch('SELECT * FROM ${table}')
        return [dict(r) for r in rows]
    finally:
        await conn.close()
`
  }

  private emitEmit(v: Verb): string {
    const p = (v.params ?? {}) as EmitParams
    const url = p.target?.config?.url ?? ''
    const channel = p.target?.config?.channel ?? ''
    return `async def ${v.id}(ctx: Ctx) -> None:
    payload = ctx.values.get(${JSON.stringify(v.id)}, ctx.input)
    import httpx
    async with httpx.AsyncClient() as client:
        body = {"channel": ${JSON.stringify(channel)}, "text": payload if isinstance(payload, str) else json.dumps(payload)}
        await client.post(${JSON.stringify(url)}, json=body)
`
  }

  /** Inline a target verb's body into a parent (RETRY/COMPENSATE/ERROR) function.
   *  Returns lines indented with `indent`. Caller wraps the indented block. */
  private inlineBody(target: InlineTarget, indent: string = '    '): string {
    const t = target ?? { verb: 'NOOP' }
    switch (t.verb) {
      case 'FETCH': {
        const p = (t.params ?? {}) as FetchParams
        const url = p.source?.config?.url ?? ''
        return `${indent}import httpx
${indent}async with httpx.AsyncClient() as client:
${indent}    r = await client.request("GET", ${JSON.stringify(url)}, json=None)
${indent}    r.raise_for_status()
${indent}    return r.json()`
      }
      case 'VALIDATE': {
        const p = (t.params ?? {}) as ValidateParams
        const rules = pyLit(p.rules ?? [])
        const action = p.on_fail?.action ?? 'flag'
        return `${indent}rules = ${rules}
${indent}validator = globals().get("__validator__")
${indent}ok = validator(rules, ctx.input) if validator else True
${indent}if not ok:
${indent}    raise ValueError("VALIDATE failed (action=${action})")
${indent}return ctx.input`
      }
      case 'DELETE': {
        const p = (t.params ?? {}) as DeleteParams
        const table = p.sink?.config?.table ?? 'unknown_table'
        const predicate = p.predicate ?? 'TRUE'
        return `${indent}import asyncpg
${indent}conn = await asyncpg.connect(os.environ.get("DATABASE_URL", ""))
${indent}try:
${indent}    await conn.execute('DELETE FROM ${table} WHERE ${predicate}')
${indent}finally:
${indent}    await conn.close()
${indent}return _receipt("sql:${table}", False)`
      }
      case 'EMIT': {
        const p = (t.params ?? {}) as EmitParams
        const url = p.target?.config?.url ?? ''
        const channel = p.target?.config?.channel ?? ''
        return `${indent}payload = ctx.input
${indent}import httpx
${indent}async with httpx.AsyncClient() as client:
${indent}    body = {"channel": ${JSON.stringify(channel)}, "text": payload if isinstance(payload, str) else json.dumps(payload)}
${indent}    await client.post(${JSON.stringify(url)}, json=body)
${indent}return None`
      }
      default:
        return `${indent}# inline target verb '${t.verb}' not specialised — host required
${indent}return ctx.input`
    }
  }

  private emitRetry(v: Verb): string {
    const p = (v.params ?? {}) as RetryParams
    const target = p.of ?? { verb: 'NOOP' }
    const max = p.policy?.max ?? 3
    const delay = p.policy?.delay_ms ?? 1000
    const backoff = p.policy?.backoff ?? 'exponential'
    const jitter = p.policy?.jitter ? 'True' : 'False'
    const errorRoute = p.error_route
    if (!errorRoute) {
      return `async def ${v.id}(ctx: Ctx) -> Any:
    async def _attempt():
${this.inlineBody(target, '        ')}
    return await _retry(_attempt, ${max}, ${delay}, ${JSON.stringify(backoff)}, ${jitter})
`
    }
    return `async def ${v.id}(ctx: Ctx) -> Any:
    async def _attempt():
${this.inlineBody(target, '        ')}
    try:
        return await _retry(_attempt, ${max}, ${delay}, ${JSON.stringify(backoff)}, ${jitter})
    except Exception:
        await _execute(${JSON.stringify(errorRoute)}, ctx)
        return ctx.values.get(${JSON.stringify(errorRoute)})
`
  }

  private emitCompensate(v: Verb): string {
    const p = (v.params ?? {}) as CompensateParams
    const receiptFrom = p.receipt_from ?? ''
    const reverse = p.reverse ?? { verb: 'NOOP' }
    return `async def ${v.id}(ctx: Ctx) -> Any:
    receipt = ctx.receipts.get(${JSON.stringify(receiptFrom)})
    if not receipt:
        raise RuntimeError("COMPENSATE ${v.id}: no receipt for ${receiptFrom}")
    if not receipt.get("reversible"):
        raise RuntimeError("COMPENSATE ${v.id}: receipt is non-reversible")
${this.inlineBody(reverse, '    ')}
`
  }

  private emitError(v: Verb): string {
    const p = (v.params ?? {}) as ErrorParams
    const target = p.of ?? { verb: 'NOOP' }
    const catches = pyLit(p.catch ?? [])
    const handler = p.handler ?? { verb: 'NOOP' }
    return `async def ${v.id}(ctx: Ctx) -> Any:
    try:
${this.inlineBody(target, '        ')}
    except Exception as e:
        catches = ${catches}
        if any(t == type(e).__name__ or t == getattr(e, "code", None) for t in catches):
${this.inlineBody(handler, '            ')}
        raise
`
  }

  private emitBranch(v: Verb): string {
    const p = (v.params ?? {}) as BranchParams
    const conds = (p.conditions ?? []).map(
      (c) =>
        `    if _predicate(${JSON.stringify(c.when ?? 'False')}, ctx.input):
        await _execute(${JSON.stringify(c.then ?? '')}, ctx)
        return ctx.values.get(${JSON.stringify(c.then ?? '')})`,
    ).join('\n')
    const fallback = p.default
      ? `    await _execute(${JSON.stringify(p.default)}, ctx)
    return ctx.values.get(${JSON.stringify(p.default)})`
      : '    return None'
    return `async def ${v.id}(ctx: Ctx) -> Any:
${conds}
${fallback}
`
  }

  private emitSplit(v: Verb): string {
    const p = (v.params ?? {}) as SplitParams
    const targets = pyLit(p.targets ?? [])
    const strategy = JSON.stringify(p.strategy ?? 'parallel')
    return `async def ${v.id}(ctx: Ctx) -> List[Any]:
    targets = ${targets}
    strategy = ${strategy}
    _ = strategy  # 'parallel' | 'broadcast' | 'partition' — host may inspect
    async def _branch(t: str) -> Any:
        branch_ctx = Ctx(input=ctx.input)
        await _execute(t, branch_ctx)
        return branch_ctx.values.get(t)
    results = await asyncio.gather(*[_branch(t) for t in targets])
    ctx.values[${JSON.stringify(v.id)} + ":branches"] = list(results)
    return list(results)
`
  }

  private emitMerge(v: Verb): string {
    const p = (v.params ?? {}) as MergeParams
    const sources = pyLit(p.sources ?? [])
    const strategy = p.strategy ?? 'all'
    const splitId = p.from ?? ''
    return `async def ${v.id}(ctx: Ctx) -> Any:
    sources = ${sources}
    _ = sources
    branches = ctx.values.get(${JSON.stringify(splitId)} + ":branches", [])
    if ${JSON.stringify(strategy)} == "first":
        return branches[0] if branches else None
    if ${JSON.stringify(strategy)} == "majority":
        from collections import Counter
        counts = Counter(json.dumps(b, sort_keys=True) for b in branches)
        if not counts: return None
        return json.loads(counts.most_common(1)[0][0])
    flat: List[Any] = []
    for b in branches:
        if isinstance(b, list): flat.extend(b)
        else: flat.append(b)
    return flat
`
  }

  private emitGate(v: Verb): string {
    const p = (v.params ?? {}) as GateParams
    const prompt = p.prompt ?? ''
    const options = pyLit(p.options ?? [])
    const actor = pyLit(p.actor ?? {})
    const timeout = p.timeout_ms ?? 0
    const fallback = p.default_route ?? ''
    const timeoutSec = timeout ? timeout / 1000.0 : 'None'
    return `async def ${v.id}(ctx: Ctx) -> Any:
    gate = globals().get("__gate__")
    decision = None
    if gate:
        try:
            decision = await asyncio.wait_for(
                gate({"prompt": ${JSON.stringify(prompt)}, "options": ${options}, "actor": ${actor}}, ctx.input),
                timeout=${timeoutSec},
            )
        except asyncio.TimeoutError:
            decision = None
    if decision is None and ${JSON.stringify(fallback)}:
        await _execute(${JSON.stringify(fallback)}, ctx)
        return ctx.values.get(${JSON.stringify(fallback)})
    return decision
`
  }

  private emitAwait(v: Verb): string {
    const p = (v.params ?? {}) as AwaitParams
    const topic = p.event?.topic ?? ''
    const timeout = p.timeout_ms ?? 0
    const route = p.timeout_route ?? ''
    const timeoutSec = timeout ? timeout / 1000.0 : 'None'
    return `async def ${v.id}(ctx: Ctx) -> Any:
    await_fn = globals().get("__await__")
    ev = None
    if await_fn:
        try:
            ev = await asyncio.wait_for(await_fn({"topic": ${JSON.stringify(topic)}}, ctx), timeout=${timeoutSec})
        except asyncio.TimeoutError:
            ev = None
    if ev is None and ${JSON.stringify(route)}:
        await _execute(${JSON.stringify(route)}, ctx)
        return ctx.values.get(${JSON.stringify(route)})
    return ev
`
  }

  private emitSignal(v: Verb): string {
    const p = (v.params ?? {}) as SignalParams
    const system = p.system ?? ''
    const signal = pyLit(p.signal ?? {})
    const timeout = p.timeout_ms ?? 0
    const route = p.timeout_route ?? ''
    const timeoutSec = timeout ? timeout / 1000.0 : 'None'
    return `async def ${v.id}(ctx: Ctx) -> Any:
    signal_fn = globals().get("__signal__")
    r = None
    if signal_fn:
        try:
            r = await asyncio.wait_for(signal_fn(${JSON.stringify(system)}, ${signal}, ctx), timeout=${timeoutSec})
        except asyncio.TimeoutError:
            r = None
    if r is None and ${JSON.stringify(route)}:
        await _execute(${JSON.stringify(route)}, ctx)
        return ctx.values.get(${JSON.stringify(route)})
    return r
`
  }

  private emitTerminate(v: Verb): string {
    const p = (v.params ?? {}) as TerminateParams
    const reason = p.reason ?? ''
    const status = p.status ?? 'failed'
    const cleanup = pyLit(p.cleanup ?? [])
    return `async def ${v.id}(ctx: Ctx) -> Any:
    cleanup = ${cleanup}
    for cid in cleanup:
        await _execute(cid, ctx)
    raise _TerminateError(${JSON.stringify(reason)}, ${JSON.stringify(status)})
`
  }
}
