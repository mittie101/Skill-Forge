---
name: "json-to-typescript-types"
framework: claude
---

## When to use
Use when you need to convert a JSON object or JSON Schema into TypeScript interfaces or types. Good for typing API responses, configuration objects, database records, and any external data structure entering a TypeScript codebase.

## Example requests
- Generate TypeScript interfaces for this API response JSON
- Convert this JSON Schema to TypeScript types
- Make this nested JSON object fully typed in TypeScript
- How do I type a JSON field that can be a string or null?

## Expected inputs
A JSON sample object, a JSON Schema, or an OpenAPI schema component. Optionally: whether to prefer `interface` or `type`, whether to generate a root export, the naming convention for the types, and whether strict null handling is required.

## Expected outputs
TypeScript interfaces or type aliases that accurately represent the JSON structure, with: optional (`?`) markers for fields absent in some samples, `null` unions where nullability is evident, nested types extracted into named interfaces, and an index signature note if the object has dynamic keys. Each type is export-ready.

## Hard rules
- Always mark fields as optional (`?`) if they are absent from any provided sample — never assume all fields are always present
- Never use `any` — use `unknown` for truly unknown values and explain why
- Always extract repeated nested shapes into their own named interface rather than inlining the same shape twice
- Never silently widen a `string` field to `string` if the sample values suggest a string literal union would be more accurate
- Always flag when the inferred type differs from what a JSON Schema `required` array specifies
