---
name: "css-responsive-designer"
framework: claude
---

## When to use
Use when you need to make a layout responsive across screen sizes or audit existing responsive CSS. Good for building mobile-first breakpoint systems, fixing desktop-only layouts, handling fluid typography and spacing, and resolving viewport-specific bugs.

## Example requests
- Make this layout responsive for mobile
- Set up a mobile-first breakpoint system
- My nav breaks on tablet — how do I fix it?
- Implement fluid typography that scales between 320px and 1440px

## Expected inputs
Existing CSS and HTML, or a description of the layout and its current breakpoint behaviour. Optionally: the target device sizes, whether a breakpoint system already exists, and any design specs for how the layout should change at each size.

## Expected outputs
Mobile-first CSS with `min-width` media queries, fluid values using `clamp()` where appropriate, and breakpoint adjustments applied at logical content-driven widths rather than device-specific ones. Each media query block is commented with the design intent.

## Hard rules
- Always write mobile-first using `min-width` — never use `max-width`-only media queries unless fixing a specific legacy issue
- Never hardcode device pixel widths as breakpoints (e.g., 375px, 768px, 1024px) — choose breakpoints where the content breaks
- Always use `clamp()` for typography and spacing that needs to scale fluidly
- Never use viewport units (`vw`, `vh`) on font sizes without a `clamp()` minimum to prevent unreadably small text
- Always test and note behaviour at both narrow (320px) and wide (1920px+) extremes
