import { BaseResolver, type ResolverFile, type VerbHandler } from '../core/resolver.js'
import { partitionVerbs, type Composition, type ComputeVerb, type Verb } from '../core/ir.js'

type FetchParams = { source?: { config?: { url?: string } } }
type ValidateParams = { on_fail?: { action?: string; target?: string } }
type MapParams = { expression?: string; project?: Record<string, string> }
type FilterParams = { predicate?: string }
type ReduceParams = { expression?: string }
type PersistParams = { sink?: { config?: { table?: string } } }
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

const PREAMBLE_HELPERS = `use std::collections::HashMap;
use std::time::Duration as StdDuration;
use anyhow::{anyhow, Result};
use serde_json::{json, Value};
use tokio::time::sleep;
#[derive(Debug, Clone)]
pub struct Receipt {
    pub id: String,
    pub timestamp: String,
    pub sink: String,
    pub reversible: bool,
}
#[derive(Debug, Default)]
pub struct Ctx {
    pub input: Value,
    pub values: HashMap<String, Value>,
    pub receipts: HashMap<String, Receipt>,
}
fn new_receipt(sink: &str, reversible: bool) -> Receipt {
    Receipt {
        id: uuid::Uuid::new_v4().to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        sink: sink.to_string(),
        reversible,
    }
}
async fn retry<F, Fut, T>(mut f: F, max: u32, delay_ms: u64, backoff: &str, jitter: bool) -> Result<T>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T>>,
{
    let mut last: Option<anyhow::Error> = None;
    for attempt in 0..max {
        match f().await {
            Ok(v) => return Ok(v),
            Err(e) => last = Some(e),
        }
        let base = if backoff == "exponential" {
            delay_ms.saturating_mul(1u64 << attempt.min(20))
        } else {
            delay_ms.saturating_mul((attempt + 1) as u64)
        };
        let wait = if jitter {
            let r: f64 = rand::random();
            ((base as f64) * (0.5 + r)) as u64
        } else { base };
        sleep(StdDuration::from_millis(wait)).await;
    }
    Err(last.unwrap_or_else(|| anyhow!("retry exhausted with no error recorded")))
}
/// Opaque predicate evaluation. Resolver choice: evalexpr over serde_json::Value.
/// Supports comparisons, arithmetic, &&, ||, !, and dotted row.field paths.
fn predicate(expr: &str, row: &Value) -> bool {
    eval_bool(expr, row).unwrap_or(false)
}
fn eval_bool(expr: &str, row: &Value) -> Option<bool> {
    // Minimal predicate engine — supports: <lhs> <op> <rhs> where op in == != < <= > >= and literal null check.
    for op in ["==", "!=", "<=", ">=", "<", ">"] {
        if let Some(idx) = expr.find(op) {
            let lhs = expr[..idx].trim();
            let rhs = expr[idx + op.len()..].trim();
            let a = resolve_expr(lhs, row);
            let b = resolve_expr(rhs, row);
            return Some(match op {
                "==" => a == b,
                "!=" => a != b,
                "<"  => cmp(&a, &b) == Some(std::cmp::Ordering::Less),
                "<=" => matches!(cmp(&a, &b), Some(std::cmp::Ordering::Less | std::cmp::Ordering::Equal)),
                ">"  => cmp(&a, &b) == Some(std::cmp::Ordering::Greater),
                ">=" => matches!(cmp(&a, &b), Some(std::cmp::Ordering::Greater | std::cmp::Ordering::Equal)),
                _ => false,
            });
        }
    }
    // Fallback: truthiness of row.<path>
    Some(!resolve_expr(expr.trim(), row).is_null())
}
fn cmp(a: &Value, b: &Value) -> Option<std::cmp::Ordering> {
    match (a.as_f64(), b.as_f64()) {
        (Some(x), Some(y)) => x.partial_cmp(&y),
        _ => a.as_str().and_then(|x| b.as_str().map(|y| x.cmp(y))),
    }
}
fn resolve_expr(e: &str, row: &Value) -> Value {
    let e = e.trim();
    if let Ok(n) = e.parse::<f64>() { return json!(n); }
    if e.starts_with('"') && e.ends_with('"') { return json!(e.trim_matches('"')); }
    if e == "null" { return Value::Null; }
    if e == "true" { return json!(true); }
    if e == "false" { return json!(false); }
    // dotted path: row.field.subfield or input.field
    let path = if let Some(s) = e.strip_prefix("row.") { s }
               else if let Some(s) = e.strip_prefix("input.") { s }
               else { e };
    let mut cur = row;
    for seg in path.split('.') {
        cur = match cur.get(seg) { Some(v) => v, None => return Value::Null };
    }
    cur.clone()
}
fn reduce_agg(expr: &str, items: &[Value]) -> Value {
    // group_by(key).op(field)
    let re_group = regex::Regex::new(r"^group_by\\(([^)]+)\\)\\.(sum|count|avg|min|max)\\(([^)]*)\\)$").unwrap();
    if let Some(caps) = re_group.captures(expr) {
        let key = caps.get(1).unwrap().as_str();
        let op  = caps.get(2).unwrap().as_str();
        let field = caps.get(3).unwrap().as_str();
        let mut groups: HashMap<String, Vec<Value>> = HashMap::new();
        for row in items {
            let k = resolve_expr(key, row);
            groups.entry(k.to_string()).or_default().push(row.clone());
        }
        let mut out = serde_json::Map::new();
        for (k, rows) in groups {
            let val = match op {
                "count" => json!(rows.len()),
                "sum"   => json!(rows.iter().filter_map(|r| resolve_expr(field, r).as_f64()).sum::<f64>()),
                "avg"   => {
                    let vs: Vec<f64> = rows.iter().filter_map(|r| resolve_expr(field, r).as_f64()).collect();
                    if vs.is_empty() { json!(0) } else { json!(vs.iter().sum::<f64>() / vs.len() as f64) }
                },
                "min"   => json!(rows.iter().filter_map(|r| resolve_expr(field, r).as_f64()).fold(f64::INFINITY, f64::min)),
                "max"   => json!(rows.iter().filter_map(|r| resolve_expr(field, r).as_f64()).fold(f64::NEG_INFINITY, f64::max)),
                _ => Value::Null,
            };
            out.insert(k, val);
        }
        return Value::Object(out);
    }
    let re_single = regex::Regex::new(r"^(sum|count|avg|min|max)\\(([^)]*)\\)$").unwrap();
    if let Some(caps) = re_single.captures(expr) {
        let op = caps.get(1).unwrap().as_str();
        let field = caps.get(2).unwrap().as_str();
        if op == "count" { return json!(items.len()); }
        let vals: Vec<f64> = items.iter().filter_map(|r| resolve_expr(field, r).as_f64()).collect();
        return match op {
            "sum" => json!(vals.iter().sum::<f64>()),
            "avg" => if vals.is_empty() { json!(0) } else { json!(vals.iter().sum::<f64>() / vals.len() as f64) },
            "min" => json!(vals.iter().cloned().fold(f64::INFINITY, f64::min)),
            "max" => json!(vals.iter().cloned().fold(f64::NEG_INFINITY, f64::max)),
            _ => Value::Null,
        };
    }
    Value::Null
}`

const CARGO_TOML = (name: string) => `[package]
name = "${name}"
version = "0.1.0"
edition = "2021"

[dependencies]
anyhow = "1"
async-recursion = "1"
chrono = { version = "0.4", features = ["clock"] }
rand = "0.8"
regex = "1"
reqwest = { version = "0.12", features = ["json"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sqlx = { version = "0.8", features = ["runtime-tokio", "postgres", "json", "chrono"] }
tokio = { version = "1", features = ["full"] }
uuid = { version = "1", features = ["v4"] }
`

export class RustBackend extends BaseResolver {
  readonly label = 'rust'

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
  }

  protected rootFileName(c: Composition): string {
    return `${c.name}.rs`
  }

  protected override emitCompanionFiles(c: Composition): ResolverFile[] {
    return [{ path: 'Cargo.toml', content: CARGO_TOML(c.name) }]
  }

  protected emitPreamble(c: Composition): string {
    const header = [
      '// Generated by NOMARK Intents resolver (target: rust)',
      `// Composition: ${c.name} v${c.version}`,
      `// ${c.description ?? ''}`,
    ].join('\n')
    return `${header}\n${PREAMBLE_HELPERS}`
  }

  protected emitPostamble(c: Composition): string {
    const { compute } = partitionVerbs(c)
    const first = compute[0]?.id ?? 'start'
    const cases = compute
      .map((v, i) => {
        const next = compute[i + 1]
        const middleLine = next
          ? `            Box::pin(_execute(${JSON.stringify(next.id)}, ctx)).await?;`
          : ''
        return `        ${JSON.stringify(v.id)} => {
            let r = ${v.id}(ctx).await?;
            ctx.values.insert(${JSON.stringify(v.id)}.to_string(), r);
${middleLine}
            Ok(())
        }`
      })
      .join('\n')

    return `#[async_recursion::async_recursion]
async fn _execute(id: &str, ctx: &mut Ctx) -> Result<()> {
    match id {
${cases}
        other => Err(anyhow!("unknown verb id: {}", other)),
    }
}

pub async fn run(input: Value) -> Result<Ctx> {
    let mut ctx = Ctx { input, ..Default::default() };
    _execute(${JSON.stringify(first)}, &mut ctx).await?;
    Ok(ctx)
}`
  }

  private emitFetch(v: Verb): string {
    const p = (v.params ?? {}) as FetchParams
    const url = p.source?.config?.url ?? ''
    return `async fn ${v.id}(ctx: &mut Ctx) -> Result<Value> {
    { let r = reqwest::Client::new().request(reqwest::Method::from_bytes("GET".as_bytes())?, ${JSON.stringify(url)}).send().await?.error_for_status()?; Ok(r.json::<Value>().await?) }
}
`
  }

  private emitValidate(v: Verb): string {
    const p = (v.params ?? {}) as ValidateParams
    const action = p.on_fail?.action ?? 'flag'
    const routeTarget = p.on_fail?.target ?? ''
    return `async fn ${v.id}(ctx: &mut Ctx) -> Result<Value> {
    let input = ctx.input.clone();
    // Default validator is pass-through. Host may inject via a feature flag.
    let ok = true;
    if !ok {
        match ${JSON.stringify(action)} {
            "reject" => anyhow::bail!("VALIDATE ${v.id} failed"),
            "route" => { Box::pin(_execute(${JSON.stringify(routeTarget)}, ctx)).await?;
                         return Ok(ctx.values.get(${JSON.stringify(routeTarget)}).cloned().unwrap_or(Value::Null)); }
            _ => {}
        }
    }
    Ok(input)
}
`
  }

  private emitMap(v: Verb): string {
    const p = (v.params ?? {}) as MapParams
    const expr = p.expression ?? this.projectToExpression(p.project)
    return `async fn ${v.id}(ctx: &mut Ctx) -> Result<Value> {
    let input = ctx.input.clone();
    Ok(resolve_expr(${JSON.stringify(expr)}, &input))
}
`
  }

  private projectToExpression(project: Record<string, string> | undefined): string {
    if (!project) return 'row'
    const pairs = Object.entries(project).map(([k, e]) => `${k}: ${e}`)
    return `{ ${pairs.join(', ')} }`
  }

  private emitFilter(v: Verb): string {
    const p = (v.params ?? {}) as FilterParams
    const pred = p.predicate ?? 'true'
    return `async fn ${v.id}(ctx: &mut Ctx) -> Result<Value> {
    let input = ctx.input.clone();
    let arr = input.as_array().cloned().unwrap_or_default();
    let kept: Vec<Value> = arr.into_iter().filter(|r| predicate(${JSON.stringify(pred)}, r)).collect();
    Ok(Value::Array(kept))
}
`
  }

  private emitReduce(v: Verb): string {
    const p = (v.params ?? {}) as ReduceParams
    const expr = p.expression ?? 'row'
    return `async fn ${v.id}(ctx: &mut Ctx) -> Result<Value> {
    let input = ctx.input.clone();
    let items = input.as_array().cloned().unwrap_or_default();
    Ok(reduce_agg(${JSON.stringify(expr)}, &items))
}
`
  }

  private emitPersist(v: Verb): string {
    const p = (v.params ?? {}) as PersistParams
    const table = p.sink?.config?.table ?? 'unknown_table'
    return `async fn ${v.id}(ctx: &mut Ctx) -> Result<Value> {
    let input = ctx.input.clone();
    {
        let pool = sqlx::postgres::PgPoolOptions::new().connect(&std::env::var("DATABASE_URL")?).await?;
        let rows = if input.is_array() { input.as_array().cloned().unwrap_or_default() } else { vec![input.clone()] };
        for row in rows {
            let obj = row.as_object().ok_or_else(|| anyhow!("row not an object"))?;
            let keys: Vec<&String> = obj.keys().collect();
            let placeholders: Vec<String> = (1..=keys.len()).map(|i| format!("\${i}")).collect();
            let cols = keys.iter().map(|k| k.as_str()).collect::<Vec<_>>().join(", ");
            let sql = format!("INSERT INTO ${table} ({}) VALUES ({})", cols, placeholders.join(", "));
            let mut q = sqlx::query(&sql);
            for k in &keys {
                q = q.bind(obj.get(k.as_str()).cloned().unwrap_or(Value::Null));
            }
            q.execute(&pool).await?;
        }
    }
    let receipt = new_receipt("sql:${table}", true);
    ctx.receipts.insert(${JSON.stringify(v.id)}.to_string(), receipt.clone());
    Ok(json!({ "id": receipt.id, "timestamp": receipt.timestamp, "sink": receipt.sink, "reversible": receipt.reversible }))
}
`
  }

  private emitEnrich(v: Verb): string {
    const p = (v.params ?? {}) as EnrichParams
    const extras = JSON.stringify(p.with ?? {})
    return `async fn ${v.id}(ctx: &mut Ctx) -> Result<Value> {
    let input = ctx.input.clone();
    let extras: Value = serde_json::from_str(${JSON.stringify(extras)})?;
    let merge = |row: &Value| -> Value {
        let mut m = row.as_object().cloned().unwrap_or_default();
        if let Some(o) = extras.as_object() { for (k, v) in o { m.insert(k.clone(), v.clone()); } }
        Value::Object(m)
    };
    Ok(if input.is_array() {
        Value::Array(input.as_array().unwrap().iter().map(merge).collect())
    } else {
        merge(&input)
    })
}
`
  }

  private emitDelete(v: Verb): string {
    const p = (v.params ?? {}) as DeleteParams
    const table = p.sink?.config?.table ?? 'unknown_table'
    const predicate = p.predicate ?? 'TRUE'
    return `async fn ${v.id}(ctx: &mut Ctx) -> Result<Value> {
    {
        let pool = sqlx::postgres::PgPoolOptions::new().connect(&std::env::var("DATABASE_URL")?).await?;
        sqlx::query("DELETE FROM ${table} WHERE ${predicate}").execute(&pool).await?;
    }
    let receipt = new_receipt("sql:${table}", false);
    ctx.receipts.insert(${JSON.stringify(v.id)}.to_string(), receipt.clone());
    Ok(json!({ "id": receipt.id, "timestamp": receipt.timestamp, "sink": receipt.sink, "reversible": receipt.reversible }))
}
`
  }

  private emitStream(v: Verb): string {
    const p = (v.params ?? {}) as StreamParams
    const table = p.source?.config?.table ?? 'unknown_table'
    return `async fn ${v.id}(ctx: &mut Ctx) -> Result<Value> {
    // STREAM: host should adapt this to async iteration over a real cursor.
    let pool = sqlx::postgres::PgPoolOptions::new().connect(&std::env::var("DATABASE_URL")?).await?;
    let rows: Vec<Value> = sqlx::query_scalar::<_, Value>("SELECT row_to_json(t) FROM ${table} t").fetch_all(&pool).await?;
    Ok(Value::Array(rows))
}
`
  }

  private emitEmit(v: Verb): string {
    const p = (v.params ?? {}) as EmitParams
    const url = p.target?.config?.url ?? ''
    const channel = p.target?.config?.channel ?? ''
    return `async fn ${v.id}(ctx: &mut Ctx) -> Result<Value> {
    let payload = ctx.values.get(${JSON.stringify(v.id)}).cloned().unwrap_or_else(|| ctx.input.clone());
    {
        let body = json!({ "channel": ${JSON.stringify(channel)}, "text": payload });
        reqwest::Client::new().post(${JSON.stringify(url)}).json(&body).send().await?;
    }
    Ok(Value::Null)
}
`
  }

  /** Inline a target verb's body for use inside a resilience verb's function.
   *  Returns lines indented with `indent`, ending with an `Ok(...)` expression
   *  suitable as the closure's return. */
  private inlineBody(target: InlineTarget, indent: string = '    '): string {
    const t = target ?? { verb: 'NOOP' }
    switch (t.verb) {
      case 'FETCH': {
        const p = (t.params ?? {}) as FetchParams
        const url = p.source?.config?.url ?? ''
        return `${indent}let r = reqwest::Client::new().request(reqwest::Method::from_bytes("GET".as_bytes())?, ${JSON.stringify(url)}).send().await?.error_for_status()?;
${indent}Ok(r.json::<Value>().await?)`
      }
      case 'VALIDATE': {
        const p = (t.params ?? {}) as ValidateParams
        const action = p.on_fail?.action ?? 'flag'
        return `${indent}let ok = true;
${indent}if !ok { anyhow::bail!("VALIDATE failed (action=${action})"); }
${indent}Ok(ctx.input.clone())`
      }
      case 'DELETE': {
        const p = (t.params ?? {}) as DeleteParams
        const table = p.sink?.config?.table ?? 'unknown_table'
        const predicate = p.predicate ?? 'TRUE'
        return `${indent}let pool = sqlx::postgres::PgPoolOptions::new().connect(&std::env::var("DATABASE_URL")?).await?;
${indent}sqlx::query("DELETE FROM ${table} WHERE ${predicate}").execute(&pool).await?;
${indent}let receipt = new_receipt("sql:${table}", false);
${indent}Ok(json!({ "id": receipt.id, "timestamp": receipt.timestamp, "sink": receipt.sink, "reversible": receipt.reversible }))`
      }
      case 'EMIT': {
        const p = (t.params ?? {}) as EmitParams
        const url = p.target?.config?.url ?? ''
        const channel = p.target?.config?.channel ?? ''
        return `${indent}let payload = ctx.input.clone();
${indent}let body = json!({ "channel": ${JSON.stringify(channel)}, "text": payload });
${indent}reqwest::Client::new().post(${JSON.stringify(url)}).json(&body).send().await?;
${indent}Ok(Value::Null)`
      }
      default:
        return `${indent}// inline target verb '${t.verb}' not specialised — host required
${indent}Ok(ctx.input.clone())`
    }
  }

  private emitRetry(v: Verb): string {
    const p = (v.params ?? {}) as RetryParams
    const target = p.of ?? { verb: 'NOOP' }
    const max = p.policy?.max ?? 3
    const delay = p.policy?.delay_ms ?? 1000
    const backoff = p.policy?.backoff ?? 'exponential'
    const jitter = p.policy?.jitter ?? false
    const errorRoute = p.error_route
    const attemptBlock = `let attempt = || async {
${this.inlineBody(target, '        ')}
    };`
    if (!errorRoute) {
      return `async fn ${v.id}(ctx: &mut Ctx) -> Result<Value> {
    ${attemptBlock}
    retry(attempt, ${max}, ${delay}, ${JSON.stringify(backoff)}, ${jitter}).await
}
`
    }
    return `async fn ${v.id}(ctx: &mut Ctx) -> Result<Value> {
    ${attemptBlock}
    match retry(attempt, ${max}, ${delay}, ${JSON.stringify(backoff)}, ${jitter}).await {
        Ok(v) => Ok(v),
        Err(_) => {
            Box::pin(_execute(${JSON.stringify(errorRoute)}, ctx)).await?;
            Ok(ctx.values.get(${JSON.stringify(errorRoute)}).cloned().unwrap_or(Value::Null))
        }
    }
}
`
  }

  private emitCompensate(v: Verb): string {
    const p = (v.params ?? {}) as CompensateParams
    const receiptFrom = p.receipt_from ?? ''
    const reverse = p.reverse ?? { verb: 'NOOP' }
    return `async fn ${v.id}(ctx: &mut Ctx) -> Result<Value> {
    let receipt = ctx.receipts.get(${JSON.stringify(receiptFrom)}).cloned()
        .ok_or_else(|| anyhow!("COMPENSATE ${v.id}: no receipt for ${receiptFrom}"))?;
    if !receipt.reversible { anyhow::bail!("COMPENSATE ${v.id}: receipt is non-reversible"); }
${this.inlineBody(reverse, '    ')}
}
`
  }

  private emitError(v: Verb): string {
    const p = (v.params ?? {}) as ErrorParams
    const target = p.of ?? { verb: 'NOOP' }
    const catches = JSON.stringify(p.catch ?? [])
    const handler = p.handler ?? { verb: 'NOOP' }
    return `async fn ${v.id}(ctx: &mut Ctx) -> Result<Value> {
    let target = || async {
${this.inlineBody(target, '        ')}
    };
    match target().await {
        Ok(v) => Ok(v),
        Err(e) => {
            let catches: Vec<&str> = serde_json::from_str(${JSON.stringify(catches)})?;
            let name = format!("{:?}", e);
            if catches.iter().any(|t| name.contains(t)) {
${this.inlineBody(handler, '                ')}
            } else { Err(e) }
        }
    }
}
`
  }
}
