---
name: "css-grid-architect"
framework: claude
---

## When to use
Use when you need to design or implement a CSS Grid layout. Good for page-level layouts, dashboard grids, image galleries, card grids, and any two-dimensional arrangement where Grid is the right tool over Flexbox.

## Example requests
- Build a responsive magazine-style grid layout
- Create a 12-column grid system in pure CSS
- Lay out this dashboard with a sidebar and main content area using Grid
- How do I make grid items span multiple columns?

## Expected inputs
A description or sketch of the desired layout (number of columns, row behaviour, named areas, gaps), the content going into each grid cell, and optionally the responsive behaviour at different screen sizes.

## Expected outputs
Complete CSS Grid implementation using `grid-template-columns`, `grid-template-rows`, and `grid-template-areas` where appropriate. Includes responsive adjustments, named line or area references for clarity, and a brief explanation of why specific sizing functions (`fr`, `minmax`, `auto-fill`, `auto-fit`) were chosen.

## Hard rules
- Always prefer `fr` units over fixed pixel columns for flexible tracks
- Always use `grid-template-areas` for named, readable layout definitions when more than two areas are involved
- Never use negative line numbers in production code without a comment explaining the intent
- Always explain the difference between `auto-fill` and `auto-fit` when either is used
- Never use Grid for one-dimensional layouts where Flexbox is the simpler and more appropriate tool
