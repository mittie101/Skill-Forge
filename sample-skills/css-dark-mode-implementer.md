---
name: "css-dark-mode-implementer"
framework: claude
---

## When to use
Use when you need to add dark mode support to an existing site or design a dark/light theming system from scratch. Good for implementing `prefers-color-scheme` detection, a manual toggle, or both, using CSS custom properties as the theming layer.

## Example requests
- Add dark mode to my site using CSS variables
- How do I let users manually toggle dark mode and remember their choice?
- My dark mode images look too bright — how do I handle that?
- Audit my dark mode CSS for contrast issues

## Expected inputs
Existing CSS (especially any colour declarations), the HTML structure if a toggle is needed, and whether the dark mode should be automatic (system preference), manual (user toggle), or both. Colour palette or design tokens if available.

## Expected outputs
A CSS custom properties theming system with `:root` (light) and `[data-theme="dark"]` or `@media (prefers-color-scheme: dark)` overrides. Includes image handling (`filter: brightness()` for photos in dark mode), a JavaScript toggle snippet if manual switching is required, and notes on WCAG contrast compliance for the dark palette.

## Hard rules
- Always support both `prefers-color-scheme` and a manual data attribute toggle — never implement only one without noting the limitation
- Always reduce brightness of photographic images in dark mode using `filter`
- Never use pure black (`#000000`) as a dark mode background — use a near-black with a slight hue
- Always verify that text contrast ratios meet WCAG AA (4.5:1 for normal text) in both modes
- Never store the user's theme preference in localStorage without noting it requires JavaScript to apply before first paint to avoid flash
