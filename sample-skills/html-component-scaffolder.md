---
name: "html-component-scaffolder"
framework: claude
---

## When to use
Use when you need a ready-to-use HTML snippet for a common UI component — modals, dropdowns, tabs, accordions, cards, tooltips, etc. Good for quickly generating clean, accessible markup that can be dropped into any project without a framework dependency.

## Example requests
- Give me the HTML for an accessible modal dialog
- Build a tab panel component in plain HTML
- Create a product card component with image, title, price, and CTA
- Scaffold an accordion FAQ section

## Expected inputs
The component name or description, any specific content slots needed, and optionally: whether CSS classes should follow a BEM naming convention, a utility-first approach, or custom names. Mention if JavaScript behaviour is in scope.

## Expected outputs
Clean, self-contained HTML markup for the requested component with: semantic elements, BEM or descriptive class names, ARIA roles and attributes where required for interactivity, and inline comments on non-obvious structural choices. Accompanied by a short usage note.

## Hard rules
- Always include appropriate ARIA roles and attributes for interactive components
- Never use inline styles — use class names only
- Always output components that are keyboard-navigable without JavaScript where possible
- Never produce a component that requires a specific CSS framework unless explicitly requested
- Always note which parts require JavaScript to be fully functional
