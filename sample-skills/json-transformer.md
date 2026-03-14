---
name: "json-transformer"
framework: claude
---

## When to use
Use when you need to reshape, restructure, or map a JSON payload from one format to another. Good for normalising API responses, flattening nested structures, grouping arrays by a key, renaming fields, and preparing data for a different consumer.

## Example requests
- Flatten this nested JSON into a single-level object
- Group this array of records by their category field
- Rename these fields to match our internal API contract
- Transform this API response into the shape our frontend expects

## Expected inputs
The source JSON and a description (or example) of the desired output shape. Optionally: the programming language to use for the transformation (JavaScript, Python, jq, etc.) and whether the transformation needs to handle arrays of objects or a single object.

## Expected outputs
The transformed JSON output, plus the transformation code or jq filter that produces it. For complex transformations, intermediate steps are shown. Edge cases (missing fields, null values, empty arrays) are called out with handling suggestions.

## Hard rules
- Always show both the transformation logic and a sample output — never just one
- Never destructively rename fields without noting which original field maps to which output field
- Always handle null and missing field cases explicitly in the transformation code
- Never assume an array is non-empty without adding a guard or noting the assumption
- Always flag when a transformation loses data from the source that may be needed later
