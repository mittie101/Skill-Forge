---
name: "css-bem-naming-advisor"
framework: claude
---

## When to use
Use when you want to apply, audit, or fix BEM (Block Element Modifier) naming conventions in a CSS codebase. Good for establishing consistent naming in a new project, refactoring ad-hoc class names, and helping teams agree on BEM interpretation for edge cases.

## Example requests
- Convert these class names to BEM
- Is my BEM naming correct for this component?
- How do I handle a modifier that only applies to a nested element in BEM?
- Review this stylesheet's naming conventions

## Expected inputs
HTML and/or CSS with existing class names, or a description of the component and its states and variants. Optionally: any existing naming conventions already in use and whether a specific BEM flavour (classic, two-dashes, etc.) is preferred.

## Expected outputs
Revised class names following BEM conventions applied to the provided HTML and CSS, with a brief rationale for each naming decision. Edge cases and common BEM pitfalls encountered in the input are called out explicitly, with the correct pattern shown.

## Hard rules
- Always use the `block__element--modifier` pattern consistently — never mix conventions within one component
- Never create elements of elements (e.g., `block__element__subelement`) — flatten the hierarchy instead
- Always note when a modifier is being confused for a block variant vs a state (e.g., `--active` vs `--large`)
- Never rename classes across a large codebase without flagging the refactor scope and risk
- Always explain why a class name is wrong, not just what to change it to
