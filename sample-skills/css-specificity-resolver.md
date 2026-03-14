---
name: "css-specificity-resolver"
framework: claude
---

## When to use
Use when styles are not applying as expected due to specificity conflicts, cascade order issues, or overuse of `!important`. Good for untangling inherited styles, fixing third-party library overrides, and refactoring specificity-heavy CSS into a maintainable structure.

## Example requests
- Why is my style being overridden even though it comes last?
- How do I override Bootstrap styles without using !important?
- Calculate the specificity of these selectors
- Refactor this CSS to reduce specificity wars

## Expected inputs
The conflicting CSS selectors and rules, and optionally the HTML they target. A description of which style should win and which is incorrectly taking precedence. Third-party library names are helpful if overrides are involved.

## Expected outputs
A specificity breakdown for each selector in conflict (using the (a, b, c) notation), an explanation of why the current winner is winning, and a recommended fix that resolves the conflict at the lowest possible specificity level. Where `!important` is in use, a removal strategy is included.

## Hard rules
- Never recommend adding `!important` as a specificity fix — only flag its presence and suggest removal strategies
- Always show the specificity score numerically for every selector discussed
- Never suggest duplicating selectors to boost specificity (e.g., `.btn.btn`) without flagging it as a last resort
- Always recommend the lowest-specificity fix that solves the problem
- Always flag when the real fix is a refactor of selector architecture rather than a targeted override
