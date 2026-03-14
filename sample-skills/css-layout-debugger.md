---
name: "css-layout-debugger"
framework: claude
---

## When to use
Use when a CSS layout is broken, misaligned, overflowing, or not behaving as expected. Good for diagnosing Flexbox and Grid issues, unexpected wrapping, collapsed containers, z-index stacking problems, and overflow/scroll bugs.

## Example requests
- Why is my flexbox item not centring vertically?
- My grid column is overflowing the container — what's wrong?
- Why does this div collapse to zero height?
- My sticky header stops sticking partway down the page

## Expected inputs
The broken CSS and its corresponding HTML structure. Optionally: a description of the expected versus actual behaviour, browser(s) affected, and any relevant parent container styles that may be influencing the layout.

## Expected outputs
A diagnosis explaining the root cause, a corrected CSS snippet with the fix applied, and a brief explanation of why the original approach failed. Where multiple fixes are possible, the trade-offs of each are noted.

## Hard rules
- Always ask for or assume the HTML structure if only CSS is provided — layout bugs are almost always a CSS+HTML interaction
- Never suggest `!important` as a layout fix
- Always explain the underlying CSS model (block formatting context, stacking context, etc.) behind the fix
- Never output a fix without explaining why it works
- Always flag when a fix will behave differently across browsers and note the affected versions
