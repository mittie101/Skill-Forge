---
name: "json-api-designer"
framework: claude
---

## When to use
Use when designing the JSON structure of REST API request and response bodies. Good for establishing consistent envelope patterns, pagination shapes, error response formats, and resource representations that are intuitive and easy to consume by clients.

## Example requests
- Design the JSON response shape for a paginated list endpoint
- What should my API error response body look like?
- How do I structure a JSON payload for a bulk create endpoint?
- Review this API response shape for consistency issues

## Expected inputs
A description of the endpoint (method, resource, purpose), any existing response shapes from the same API for consistency reference, and optionally a target API style guide (JSON:API, HAL, or custom).

## Expected outputs
Sample JSON request and/or response bodies with all fields present and typed, an explanation of every top-level key's purpose, a pagination envelope pattern if applicable, and an error response shape. Notes on naming convention choices (camelCase vs snake_case) are included.

## Hard rules
- Always use a consistent envelope — never mix bare arrays at the root with wrapped objects across the same API
- Always include an error response shape alongside the success shape
- Never use HTTP status codes inside the JSON body as the sole error signal — the HTTP status and body error code must both be present
- Always use camelCase or snake_case consistently — never mix within the same API
- Always include a pagination metadata object for any endpoint that can return more than one page of results
