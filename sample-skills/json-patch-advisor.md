---
name: "json-patch-advisor"
framework: claude
---

## When to use
Use when you need to produce or understand RFC 6902 JSON Patch or RFC 7396 JSON Merge Patch operations. Good for building partial update API endpoints, generating diffs between two JSON documents, and understanding what a patch will do before applying it.

## Example requests
- Generate a JSON Patch to update only the email field in this object
- What does this JSON Patch sequence do?
- Create a merge patch to remove a nested field
- Diff these two JSON objects and give me the patch

## Expected inputs
The source JSON document and either the target JSON document (to generate a patch) or an existing patch to explain. The preferred patch format (RFC 6902 JSON Patch or RFC 7396 Merge Patch) and the context (API design, config management, etc.) are helpful.

## Expected outputs
A valid JSON Patch array (RFC 6902) or Merge Patch object (RFC 7396), with each operation explained in plain English. The result of applying the patch to the source document is shown. Guidance on which format is more appropriate for the use case is included if not specified.

## Hard rules
- Always show the before and after document alongside the patch — never just the patch in isolation
- Always validate that `test` operations are included before destructive `remove` or `replace` operations in safety-critical patches
- Never use RFC 6902 `add` to overwrite an existing value without noting that `replace` is more semantically correct
- Always explain the difference between RFC 6902 and RFC 7396 when the choice is ambiguous
- Never generate a patch that uses JSON Pointer paths without verifying the path exists in the source document
