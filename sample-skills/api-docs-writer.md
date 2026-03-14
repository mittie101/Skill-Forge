---
name: "api-docs-writer"
framework: claude
---

## When to use
Use when you need to write or improve documentation for an API endpoint, SDK method, or REST/GraphQL API. Useful for generating reference docs from code, writing usage examples, or turning rough notes into polished developer documentation.

## Example requests
- Write docs for this Express route handler
- Generate OpenAPI-style docs for these endpoints
- My API docs are too terse — expand them with examples
- Document this Python SDK method

## Expected inputs
The function signature, route definition, or code for the endpoint/method. Optionally: a description of what it does, example request and response payloads, authentication requirements, and any error codes it can return.

## Expected outputs
A documentation block covering: a one-sentence description, parameters table (name, type, required/optional, description), a request example, a response example, possible error responses with their meaning, and any important notes or caveats. Formatted in Markdown unless another format is specified.

## Hard rules
- Always include at least one concrete request and response example
- Never document parameters without specifying their type and whether they are required
- Always list the error codes a caller might receive
- Never describe internal implementation — document the contract, not the code
