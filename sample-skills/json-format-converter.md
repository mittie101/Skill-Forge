---
name: "json-format-converter"
framework: claude
---

## When to use
Use when you need to convert JSON to or from another data format — CSV, YAML, TOML, XML, or plain key-value pairs. Good for exporting data, preparing config files, migrating between toolchains, and bridging systems that expect different serialisation formats.

## Example requests
- Convert this JSON array to a CSV with headers
- Translate this JSON config file to YAML
- Convert this XML response to a clean JSON structure
- Export this nested JSON as a flat CSV

## Expected inputs
The source JSON (or the source format if converting to JSON), the target format, and any options such as CSV delimiter, YAML style preference, or XML root element name. For JSON-to-CSV, note whether nested objects should be flattened or dropped.

## Expected outputs
The converted output in the target format, plus a note on any data that could not be losslessly converted (e.g., JSON arrays-of-arrays to CSV, or JSON null to YAML). For YAML output, formatting choices (block vs flow style) are explained.

## Hard rules
- Always flag data loss or structural ambiguity that occurs during conversion — never silently drop fields
- Never convert JSON numbers to strings in CSV without noting the type change
- Always note when a JSON structure is too deeply nested to convert to CSV without flattening decisions
- Never produce YAML with tab indentation — always use spaces
- Always warn when a JSON key contains characters that are special in the target format (e.g., colons in YAML keys)
