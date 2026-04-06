/**
 * Minimal argument parser — no external dependencies.
 */

export type ParsedArgs = {
  command: string
  flags: Record<string, string | boolean>
  positional: string[]
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2) // skip node + script
  const flags: Record<string, string | boolean> = {}
  const positional: string[] = []

  // First non-flag arg is the command
  let command = ''
  let i = 0

  // Skip leading flags (--version, --help)
  while (i < args.length && args[i]!.startsWith('--')) {
    const arg = args[i]!
    const key = arg.slice(2)
    const eqIdx = key.indexOf('=')
    if (eqIdx >= 0) {
      flags[key.slice(0, eqIdx)] = key.slice(eqIdx + 1)
    } else {
      flags[key] = true
    }
    i++
  }

  if (i < args.length && !args[i]!.startsWith('--')) {
    command = args[i]!
    i++
  }
  while (i < args.length) {
    const arg = args[i]!
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const eqIdx = key.indexOf('=')
      if (eqIdx >= 0) {
        flags[key.slice(0, eqIdx)] = key.slice(eqIdx + 1)
      } else {
        const next = args[i + 1]
        if (next && !next.startsWith('--')) {
          flags[key] = next
          i++
        } else {
          flags[key] = true
        }
      }
    } else {
      positional.push(arg)
    }
    i++
  }

  return { command, flags, positional }
}

export function requireFlag(flags: Record<string, string | boolean>, key: string): string {
  const value = flags[key]
  if (typeof value !== 'string') {
    throw new Error(`Missing required flag: --${key}`)
  }
  return value
}
