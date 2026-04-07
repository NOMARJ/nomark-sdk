# nomark-engine

Set up [`@nomark-ai/engine`](https://github.com/NOMARJ/nomark-sdk/tree/main/packages/engine) in your project — ledger, AI context, and quick-start in under 60 seconds.

## Usage

```bash
npx nomark-engine
```

This will:

1. Create a `nomark-ledger.jsonl` with a seed meta entry
2. Append AI context to your project config (CLAUDE.md, .cursor/rules, or .github/copilot-instructions.md)
3. Add the ledger to `.gitignore`
4. Print quick-start steps

## Options

```
npx nomark-engine                  # full setup
npx nomark-engine --context-only   # print AI context block to stdout
npx nomark-engine --no-ledger      # skip ledger creation
npx nomark-engine --help           # show help
```

## What happens next

```bash
# install the engine
npm install @nomark-ai/engine

# import your AI conversation history to build your preference ledger
npx nomark import --platform chatgpt --file export.json
npx nomark import --platform claude --file export.json

# view your resolved preference profile
npx nomark profile

# review and confirm low-confidence signals
npx nomark review
```

## AI context

Running `npx nomark-engine` appends a context block to your AI config file so your coding assistant knows how to use the engine. If no config file exists, pipe it manually:

```bash
npx nomark-engine --context-only >> CLAUDE.md
```

The context block covers the ledger format, signal types, scoring formula, scope matching, and usage patterns — enough for any AI assistant to integrate the resolver on the first prompt.

## License

Apache 2.0
