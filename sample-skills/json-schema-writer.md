---
name: "json-schema-writer"
framework: claude
---

## When to use
Use when you need to write a JSON Schema definition for a data structure. Good for validating API request/response bodies, documenting data contracts, generating TypeScript types, and enforcing structure in configuration files.

## Example requests
- Write a JSON Schema for this user object
- Add validation rules to this existing schema
- Generate a schema from this sample JSON payload
- How do I express a nullable optional field in JSON Schema?

## Expected inputs
A sample JSON object or a plain-English description of the data structure, including field names, types, which fields are required, and any constraints (min/max, pattern, enum values). The target JSON Schema draft version is helpful (draft-07 is a safe default).

## Expected outputs
A valid JSON Schema document with `$schema`, `type`, `properties`, `required`, and constraint keywords applied. Each property includes a `description` field. Nested objects and arrays are fully typed. A brief note explains any non-obvious schema choices.

## Hard rules
- Always specify the `$schema` URI so validators know which draft to use
- Always separate `required` array from `properties` — never confuse the two
- Never use `additionalProperties: true` on strict data contracts — set it to `false` and note the implication
- Always add `description` fields to every property in the schema
- Never conflate `nullable` (OpenAPI) with JSON Schema `type: ["string", "null"]` without flagging the difference
