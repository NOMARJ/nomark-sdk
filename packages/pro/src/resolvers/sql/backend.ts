import { BaseResolver, type ResolverWarning, type VerbHandler } from '../core/resolver.js'
import type { Composition, ComputeVerb, Verb } from '../core/ir.js'

type MapParams = { project?: Record<string, string> }
type FilterParams = { predicate?: string }
type ReduceParams = {
  group_by?: string | string[]
  agg?: Record<string, string>
}
type PersistParams = {
  sink?: { config?: { table?: string } }
  mode?: string
}
type EnrichParams = { with?: Record<string, unknown> }
type DeleteParams = { sink?: { config?: { table?: string } }; predicate?: string }
type StreamParams = { source?: { config?: { table?: string } }; batch_size?: number }

/** Fixed-spec warning emitted for every EMIT verb in SQL output.
 *  Matches the manifest fixture byte-for-byte — do not rephrase. */
export const SQL_EMIT_WARNING = (verbId: string): ResolverWarning => ({
  code: 'VERB_UNEXPRESSIBLE_IN_SQL',
  message: `verb EMIT (${verbId}) cannot be expressed in SQL compute — add a host layer to drive this step`,
  verb_id: verbId,
})

/** Fixed-spec warnings for resilience verbs. SQL has no native retry,
 *  receipt-tracking, or error-routing — host runtime required. */
const SQL_RETRY_WARNING = (verbId: string): ResolverWarning => ({
  code: 'VERB_UNEXPRESSIBLE_IN_SQL',
  message: `verb RETRY (${verbId}) cannot retry in SQL compute — host required`,
  verb_id: verbId,
})

const SQL_COMPENSATE_WARNING = (verbId: string): ResolverWarning => ({
  code: 'VERB_UNEXPRESSIBLE_IN_SQL',
  message: `verb COMPENSATE (${verbId}) requires runtime receipt tracking — host required`,
  verb_id: verbId,
})

const SQL_ERROR_WARNING = (verbId: string): ResolverWarning => ({
  code: 'VERB_UNEXPRESSIBLE_IN_SQL',
  message: `verb ERROR (${verbId}) requires error routing in host runtime`,
  verb_id: verbId,
})

const SQL_FLOW_WARNING = (verbName: string, verbId: string): ResolverWarning => ({
  code: 'VERB_UNEXPRESSIBLE_IN_SQL',
  message: `verb ${verbName} (${verbId}) is a flow-control verb — host runtime required`,
  verb_id: verbId,
})

type DialectConfig = {
  label: string
  headerTarget: string
  quote: (ident: string) => string
  placeholder: string
  emitView: (name: string, body: string) => string
}

const POSTGRES: DialectConfig = {
  label: 'sql-postgres',
  headerTarget: 'sql/postgres',
  quote: (i) => `"${i}"`,
  placeholder: '$1',
  emitView: (name, body) => `CREATE OR REPLACE VIEW ${name} AS ${body};`,
}

const SQLITE: DialectConfig = {
  label: 'sql-sqlite',
  headerTarget: 'sql/sqlite',
  quote: (i) => `"${i}"`,
  placeholder: '?',
  emitView: (name, body) => `CREATE OR REPLACE VIEW ${name} AS ${body};`,
}

const MYSQL: DialectConfig = {
  label: 'sql-mysql',
  headerTarget: 'sql/mysql',
  quote: (i) => `\`${i}\``,
  placeholder: '?',
  emitView: (name, body) => `DROP VIEW IF EXISTS ${name};\nCREATE VIEW ${name} AS ${body};`,
}

abstract class SqlBase extends BaseResolver {
  protected abstract readonly dialect: DialectConfig

  get label(): string {
    return this.dialect.label
  }

  protected handlers: Partial<Record<ComputeVerb, VerbHandler>> = {
    FETCH: (v) => this.emitFetch(v),
    VALIDATE: (v) => this.emitValidate(v),
    MAP: (v) => this.emitMap(v),
    FILTER: (v) => this.emitFilter(v),
    REDUCE: (v) => this.emitReduce(v),
    PERSIST: (v) => this.emitPersist(v),
    EMIT: (v, ctx) => {
      ctx.warn(SQL_EMIT_WARNING(v.id))
      return this.emitEmit(v)
    },
    ENRICH: (v) => this.emitEnrich(v),
    DELETE: (v) => this.emitDelete(v),
    STREAM: (v) => this.emitStream(v),
    RETRY: (v, ctx) => {
      ctx.warn(SQL_RETRY_WARNING(v.id))
      return `-- RETRY ${v.id}: not expressible in SQL compute. Host runtime required.`
    },
    COMPENSATE: (v, ctx) => {
      ctx.warn(SQL_COMPENSATE_WARNING(v.id))
      return `-- COMPENSATE ${v.id}: receipt tracking + reverse op handled by host runtime.`
    },
    ERROR: (v, ctx) => {
      ctx.warn(SQL_ERROR_WARNING(v.id))
      return `-- ERROR ${v.id}: try/catch + handler routing handled by host runtime.`
    },
    AWAIT: (v, ctx) => {
      ctx.warn(SQL_FLOW_WARNING('AWAIT', v.id))
      return `-- AWAIT ${v.id}: blocking on event/time/signal handled by host runtime.`
    },
    BRANCH: (v, ctx) => {
      ctx.warn(SQL_FLOW_WARNING('BRANCH', v.id))
      return `-- BRANCH ${v.id}: conditional path selection handled by host runtime.`
    },
    SPLIT: (v, ctx) => {
      ctx.warn(SQL_FLOW_WARNING('SPLIT', v.id))
      return `-- SPLIT ${v.id}: parallel fan-out handled by host runtime.`
    },
    MERGE: (v, ctx) => {
      ctx.warn(SQL_FLOW_WARNING('MERGE', v.id))
      return `-- MERGE ${v.id}: parallel fan-in handled by host runtime.`
    },
    GATE: (v, ctx) => {
      ctx.warn(SQL_FLOW_WARNING('GATE', v.id))
      return `-- GATE ${v.id}: human-in-the-loop decision handled by host runtime.`
    },
    SIGNAL: (v, ctx) => {
      ctx.warn(SQL_FLOW_WARNING('SIGNAL', v.id))
      return `-- SIGNAL ${v.id}: external system dispatch handled by host runtime.`
    },
    TERMINATE: (v, ctx) => {
      ctx.warn(SQL_FLOW_WARNING('TERMINATE', v.id))
      return `-- TERMINATE ${v.id}: ROLLBACK and abort transaction.\nROLLBACK;`
    },
  }

  protected override bodySeparator(): string {
    return '\n\n'
  }

  protected rootFileName(c: Composition): string {
    return `${c.name}.sql`
  }

  protected emitPreamble(c: Composition): string {
    return `-- Generated by NOMARK Intents resolver (target: ${this.dialect.headerTarget})
-- Composition: ${c.name} v${c.version}
-- ${c.description ?? ''}
BEGIN;`
  }

  protected emitPostamble(_c: Composition): string {
    return `COMMIT;`
  }

  private emitFetch(v: Verb): string {
    return `-- FETCH ${v.id}\nSELECT * FROM ${this.dialect.quote('src')};`
  }

  private emitValidate(v: Verb): string {
    return `-- VALIDATE ${v.id}: rules must be enforced by host or CHECK constraints at schema time.`
  }

  private emitMap(v: Verb): string {
    const p = (v.params ?? {}) as MapParams
    const project = p.project ?? {}
    const columns = Object.entries(project)
      .map(([alias, expr]) => `${expr} AS ${this.dialect.quote(alias)}`)
      .join(', ')
    const body = `SELECT ${columns} FROM source`
    return `-- MAP ${v.id}\n${this.dialect.emitView(`v_${v.id}`, body)}`
  }

  private emitFilter(v: Verb): string {
    const p = (v.params ?? {}) as FilterParams
    const pred = p.predicate ?? 'TRUE'
    const body = `SELECT * FROM source WHERE ${pred}`
    return `-- FILTER ${v.id}\n${this.dialect.emitView(`v_${v.id}`, body)}`
  }

  private emitReduce(v: Verb): string {
    const p = (v.params ?? {}) as ReduceParams
    const keys = Array.isArray(p.group_by) ? p.group_by : p.group_by ? [p.group_by] : []
    const aggs = Object.entries(p.agg ?? {}).map(
      ([alias, expr]) => `${expr} AS ${this.dialect.quote(alias)}`,
    )
    const selectCols = [
      ...keys.map((k) => this.dialect.quote(k)),
      ...aggs,
    ].join(', ')
    const groupCols = keys.map((k) => this.dialect.quote(k)).join(', ')
    const body = `SELECT ${selectCols} FROM source GROUP BY ${groupCols}`
    return `-- REDUCE ${v.id}\n${this.dialect.emitView(`v_${v.id}`, body)}`
  }

  private emitPersist(v: Verb): string {
    const p = (v.params ?? {}) as PersistParams
    const table = p.sink?.config?.table ?? 'unknown_table'
    const mode = p.mode ?? 'insert'
    return `-- PERSIST ${v.id} (mode: ${mode})
INSERT INTO ${this.dialect.quote(table)} (${this.dialect.quote('*unknown_columns*')}) VALUES (${this.dialect.placeholder});`
  }

  private emitEmit(v: Verb): string {
    return `-- EMIT (${v.id}) not expressible as SQL. Host runtime required.`
  }

  private emitEnrich(v: Verb): string {
    const p = (v.params ?? {}) as EnrichParams
    const extras = Object.entries(p.with ?? {})
      .map(([alias, expr]) => `${this.sqlLiteral(expr)} AS ${this.dialect.quote(alias)}`)
      .join(', ')
    const body = extras
      ? `SELECT *, ${extras} FROM source`
      : `SELECT * FROM source`
    return `-- ENRICH ${v.id}\n${this.dialect.emitView(`v_${v.id}`, body)}`
  }

  private emitDelete(v: Verb): string {
    const p = (v.params ?? {}) as DeleteParams
    const table = p.sink?.config?.table ?? 'unknown_table'
    const predicate = p.predicate ?? 'TRUE'
    return `-- DELETE ${v.id}\nDELETE FROM ${this.dialect.quote(table)} WHERE ${predicate};`
  }

  private emitStream(v: Verb): string {
    const p = (v.params ?? {}) as StreamParams
    const table = p.source?.config?.table ?? 'unknown_table'
    return `-- STREAM ${v.id}: cursor/iteration handled by host.\nSELECT * FROM ${this.dialect.quote(table)};`
  }

  /** Render an ENRICH `with` value as a SQL literal/expression.
   *  Strings are passed through verbatim (treated as SQL expressions like `now()`);
   *  numbers/booleans are emitted as literals. Mirrors how the procedural backends
   *  splat the dict into the row map. */
  private sqlLiteral(v: unknown): string {
    if (typeof v === 'string') return v
    if (typeof v === 'number') return String(v)
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
    if (v === null) return 'NULL'
    return `'${JSON.stringify(v).replace(/'/g, "''")}'`
  }
}

export class PostgresBackend extends SqlBase {
  protected readonly dialect = POSTGRES
}

export class SqliteBackend extends SqlBase {
  protected readonly dialect = SQLITE
}

export class MysqlBackend extends SqlBase {
  protected readonly dialect = MYSQL
}
