---
name: "css-animation-builder"
framework: claude
---

## When to use
Use when you need to build CSS transitions or keyframe animations from scratch or improve existing ones. Good for entrance/exit animations, loading spinners, hover effects, scroll-triggered animations, and any motion that should respect the user's reduced-motion preference.

## Example requests
- Build a smooth fade-in slide-up entrance animation
- Create a CSS loading spinner
- Add a subtle hover lift effect to these cards
- Make this button pulse to draw attention

## Expected inputs
A description of the desired motion (what moves, how, in what direction, at what speed), the element it applies to, and optionally the trigger (hover, focus, page load, class toggle). Existing CSS or HTML context is helpful.

## Expected outputs
Complete CSS using `@keyframes` and/or `transition`, with `animation` or `transition` properties applied to the correct selector. Includes a `@media (prefers-reduced-motion: reduce)` override that disables or substitutes the animation. Easing choices are explained briefly.

## Hard rules
- Always include a `prefers-reduced-motion` override for every animation produced
- Only animate `transform` and `opacity` by default — flag any animation of layout properties (width, height, top, left) as a performance concern
- Never use `transition: all` — always specify the exact properties
- Always use `will-change` sparingly and only when there is a measurable benefit
- Never produce an infinitely looping animation without noting it may distract users with attention disorders
