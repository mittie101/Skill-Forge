---
name: "regex-builder"
framework: claude
---

## When to use
Use when you need to write, fix, or understand a regular expression. Good for validation patterns, text extraction, search-and-replace, and debugging a regex that isn't matching correctly.

## Example requests
- Write a regex that matches UK postcodes
- Extract all URLs from this text
- My email regex is rejecting valid addresses — fix it
- Explain what this regex does

## Expected inputs
A plain-English description of what should match and what should not, and/or example strings. Include the target language or regex engine (JavaScript, Python, PCRE, Go). For fix/explain requests, include the existing regex.

## Expected outputs
The regex pattern in a code block, a plain-English breakdown of each component, a table of at least five match and five non-match examples, and any caveats about edge cases or engine-specific behaviour.

## Hard rules
- Never produce a regex with catastrophic backtracking risk without an explicit warning
- Always anchor patterns where a full match is implied
- Always explain every non-trivial component — no unexplained magic strings
- Flag when regex is the wrong tool for the job (e.g. parsing HTML or deeply nested structures)
