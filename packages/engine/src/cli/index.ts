#!/usr/bin/env node

import { parseArgs } from './args.js'
import { configCommand } from './config.js'
import { importCommand } from './import.js'
import { profileCommand } from './profile.js'
import { reviewCommand } from './review.js'

const VERSION = '0.1.0'

const HELP = `
  nomark — agent outcome quality engine

  Usage:
    npx nomark <command> [options]

  Commands:
    config     Configure model and API key
    import     Import AI conversation history
    profile    View your preference profile
    review     Review low-confidence signals

  Options:
    --help     Show help
    --version  Show version

  Examples:
    npx nomark config --model claude --api-key $ANTHROPIC_API_KEY
    npx nomark import --platform chatgpt --file export.json
    npx nomark profile
    npx nomark review
`

function main(): void {
  const { command, flags } = parseArgs(process.argv)

  if (flags['version']) {
    console.log(VERSION)
    return
  }

  if (flags['help'] || !command) {
    console.log(HELP)
    return
  }

  try {
    switch (command) {
      case 'config':
        configCommand(flags)
        break
      case 'import':
        importCommand(flags)
        break
      case 'profile':
        profileCommand(flags)
        break
      case 'review':
        reviewCommand(flags)
        break
      default:
        console.error(`Unknown command: ${command}`)
        console.log(HELP)
        process.exit(1)
    }
  } catch (err) {
    if (err instanceof Error) {
      console.error(`Error: ${err.message}`)
    }
    process.exit(1)
  }
}

main()
