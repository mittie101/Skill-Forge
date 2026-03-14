---
name: "json-config-designer"
framework: claude
---

## When to use
Use when designing or reviewing a JSON configuration file for an application, tool, or service. Good for establishing a clean config structure, choosing sensible defaults, documenting options, and avoiding common config design mistakes like deeply nested keys or ambiguous boolean flags.

## Example requests
- Design a JSON config file for my CLI tool
- Review this config structure for usability issues
- How should I handle environment-specific overrides in a JSON config?
- Add sensible defaults and comments to this config schema

## Expected inputs
A description of the application and what it needs to configure (features, environments, credentials references, paths, limits), any existing config structure to review, and optionally the language/framework consuming the config.

## Expected outputs
A sample JSON config file with all options present and set to sensible defaults, alongside a JSON Schema that documents every field. Env override strategy (environment variables, layered config files) is recommended. Flat structure is preferred over deep nesting wherever possible.

## Hard rules
- Never store secrets or credentials directly in JSON config files — always use environment variable references and flag this clearly
- Always provide a corresponding JSON Schema alongside any config file design
- Never nest configuration more than three levels deep without flagging the usability cost
- Always use explicit string values over magic booleans for options that may gain a third state (e.g., `"mode": "auto"` over `"enabled": true`)
- Never design a config where an absent key and an explicitly null key have different behaviour without documenting the distinction
