---
applyTo: "**/*.ts"
---
# Project coding standards for TypeScript and React

Apply the [general coding guidelines](./general-coding.instructions.md) to all code.

## TypeScript Guidelines
- Use TypeScript for all new code
- Follow functional programming principles where possible
- Use interfaces for data structures and type definitions
- Prefer immutable data (const, readonly)
- Use optional chaining (?.) and nullish coalescing (??) operators

## ES Module Guidelines
- **ALWAYS use `import` statements, NEVER use `require()`**
- The project is configured as ES modules (`"type": "module"` in package.json)
- Use `import fs from 'fs'` instead of `require('fs')`
- Use `import path from 'path'` instead of `require('path')`
- Use `import Database from 'better-sqlite3'` instead of `require('better-sqlite3')`
- All imports must use `.js` extension for local modules (e.g., `import { utils } from './utils.js'`)
- Use `import.meta.url` instead of `__dirname` for current file path
