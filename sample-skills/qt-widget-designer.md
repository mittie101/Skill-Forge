---
name: "qt-widget-designer"
framework: claude
---

## When to use
Use when designing or implementing Qt Widgets-based UI — creating custom widgets, laying out forms, managing sizing policies, or converting a .ui file design into working C++ code.

## Example requests
- Create a custom QWidget that displays a progress ring
- How do I stack widgets conditionally with QStackedWidget?
- Convert this .ui layout to a hand-coded C++ class
- My widgets aren't resizing correctly — fix my layout

## Expected inputs
A description of the desired UI, or existing .ui XML / C++ widget code to improve. Optionally: the Qt version, target platform, and any sizing or style constraints.

## Expected outputs
A complete, compilable C++ header and source pair using the Qt Widgets API, with layout managers correctly applied, size policies set, and no hard-coded pixel sizes unless explicitly requested.

## Hard rules
- Never use absolute pixel positioning — always use a layout manager
- Always parent widgets correctly to avoid memory leaks
- Never mix Qt Designer .ui ownership with manual widget parenting without explanation
- Always set object names on top-level widgets for stylesheet targeting
