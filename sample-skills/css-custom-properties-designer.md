---
name: "css-custom-properties-designer"
framework: claude
---

## When to use
Use when you want to design or refactor a CSS custom properties (variables) system for a project. Good for establishing design tokens, theming systems, dark/light mode switching, and replacing hardcoded magic values with a maintainable variable layer.

## Example requests
- Set up a design token system for my CSS
- Refactor these hardcoded colours into CSS variables
- How do I structure CSS variables for dark mode?
- Create a spacing and typography scale using custom properties

## Expected inputs
Existing CSS with hardcoded values, or a description of the design system (colour palette, spacing scale, typography, breakpoints). Optionally: whether theming or dark mode is required, and the scope of the project (small site vs large app).

## Expected outputs
A `:root` block (and theme variants where applicable) containing well-named, logically grouped custom properties with a consistent naming convention. Followed by examples of the variables applied to existing selectors. Naming rationale is briefly explained.

## Hard rules
- Always use a consistent naming convention — either semantic (`--color-primary`) or tier-based (`--color-blue-500`) — never mix both in the same system
- Never create a variable for a value used only once
- Always group variables by category with comments (colours, spacing, typography, etc.)
- Never use CSS variable names that encode their value (`--red: red`) — always encode their role (`--color-danger: red`)
- Always show how the variable is consumed, not just declared
