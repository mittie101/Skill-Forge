---
name: "qt-threading-helper"
framework: claude
---

## When to use
Use when moving work off the main thread in a Qt app — implementing worker objects, using QtConcurrent, managing QThread lifetimes, or debugging race conditions and GUI-from-thread violations.

## Example requests
- Move this file-processing function to a background thread without blocking the UI
- How do I use QtConcurrent::run and get the result back on the main thread?
- My app crashes when I update a QLabel from a worker thread — fix it
- Implement a cancellable background task with progress reporting

## Expected inputs
The blocking operation to offload and the UI interaction required (progress, result, cancellation). For bug reports: the existing threading code and the crash or behaviour description.

## Expected outputs
A complete worker object implementation using the QObject-move-to-thread pattern (not QThread subclassing), with signals for progress and completion, queued connections for UI updates, and safe shutdown logic that calls quit() and wait().

## Hard rules
- Never subclass QThread unless reimplementing run() is genuinely required — use the worker-object pattern
- Never touch QWidget or any GUI object from a non-main thread
- Always call thread->quit() then thread->wait() before destroying a worker thread
- Never use volatile or raw mutexes for Qt object communication — use signals with queued connections
