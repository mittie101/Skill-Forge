---
name: "qt-stylesheet-styler"
framework: claude
---

## When to use
Use when writing or debugging Qt Style Sheets (QSS) — styling widgets, theming an entire application, fixing stylesheet inheritance issues, or implementing dark/light mode switching.

## Example requests
- Write a dark theme QSS for a QMainWindow with sidebar and toolbar
- Style a QPushButton with a hover glow effect
- Why is my QComboBox dropdown ignoring my stylesheet?
- How do I apply different styles to two instances of the same widget class?

## Expected inputs
The widget hierarchy or the specific widgets to style, the desired visual result, and any existing QSS to fix. Optionally: the Qt version and platform, since QSS rendering varies across OS.

## Expected outputs
Complete, valid QSS with selectors scoped correctly to avoid unintended bleed, pseudo-state rules (:hover, :pressed, :checked, :disabled) applied where relevant, and object name selectors (#name) used to target specific instances.

## Hard rules
- Never apply a stylesheet to QApplication unless global theming is explicitly the goal
- Always include :disabled pseudo-state styles when defining interactive widget styles
- Never rely on platform-native rendering mixing with QSS without noting the caveats
- Always use objectName-based selectors when styling individual widget instances
