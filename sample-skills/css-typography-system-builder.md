---
name: "css-typography-system-builder"
framework: claude
---

## When to use
Use when you need to design or audit a CSS typography system. Good for establishing type scales, line heights, font stacks, fluid sizing with `clamp()`, vertical rhythm, and consistent heading/body/label styles across a project.

## Example requests
- Build a type scale system using CSS custom properties
- Set up fluid typography that scales between mobile and desktop
- What font stack should I use for a professional sans-serif UI?
- Audit my typography CSS for consistency issues

## Expected inputs
Any existing typography CSS or design tokens, the desired aesthetic (editorial, UI, marketing, etc.), and optionally: brand fonts in use, target reading width, and whether the scale should be modular (ratio-based) or hand-tuned.

## Expected outputs
A complete CSS typography system with: a custom property scale for font sizes (using `clamp()` for fluid values), line height variables per size tier, a font stack for each role (body, heading, mono), and applied styles for `h1`–`h6`, `p`, `small`, `label`, and `code` elements. Sizing rationale is noted.

## Hard rules
- Always set `font-size` on `:root` in `rem`-friendly terms and derive all other sizes from it — never use `px` for body font size
- Never set `line-height` with a unit (px or em) on body text — always use a unitless multiplier
- Always include a `font-display: swap` note when web fonts are in use
- Never produce a type scale with fewer than 5 size steps for a full application UI
- Always flag when a chosen line length (via `max-width` or `ch` units) falls outside the 45–75 character optimal reading range
