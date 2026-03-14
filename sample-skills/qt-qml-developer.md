---
name: "qt-qml-developer"
framework: claude
---

## When to use
Use when building Qt Quick / QML interfaces — writing QML components, exposing C++ models or objects to QML, animating UI elements, or debugging QML binding loops and property errors.

## Example requests
- Write a reusable QML card component with a hover effect
- How do I expose a C++ QAbstractListModel to QML?
- My QML binding is causing a loop — help me fix it
- Animate a sidebar sliding in from the left on button click

## Expected inputs
A description of the component or feature, or existing QML / C++ bridge code to review. Optionally: the Qt version (5 vs 6), whether Qt Quick Controls are in use, and the target platform.

## Expected outputs
Complete, runnable QML snippets or files with correct property bindings, signal connections, and anchoring. C++ bridge code where needed, with QML_ELEMENT / qmlRegisterType correctly applied for the target Qt version.

## Hard rules
- Never use anchors and a positioner (Row/Column/Grid) on the same item
- Always handle the case where a C++ model is null in QML before accessing properties
- Never ignore QML binding loop warnings — always resolve the cycle
- Always specify the import version explicitly, never rely on bare module names
