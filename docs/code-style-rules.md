# Code Style Rules

Reference for all code created in this repository.

## TypeScript

- Enable `strict`, `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`.
- Never use `any`. Prefer `unknown` plus runtime validation.
- Use `import type { ... }` for type-only imports.
- Exported functions and constants must have explicit return/type annotations.
- Small, single-responsibility files and functions (SRP); no dead code (DRY).

## Formatting

- 2-space indentation, semicolons, single quotes.
- One statement per line; trailing commas in multiline literals.

## Data / Config

- `approved-content.json` is the single source of truth for the whitelist.
- Never commit secrets (API keys, tokens).
