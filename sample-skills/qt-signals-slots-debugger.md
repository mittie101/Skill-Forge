---
name: "qt-signals-slots-debugger"
framework: claude
---

## When to use
Use when signals are not firing, slots are not being called, connections are silently failing, or you need help reasoning through cross-thread signal delivery and queued connections.

## Example requests
- My slot is never called — what's wrong with this connect()?
- How do I safely emit a signal from a worker thread to update the UI?
- Why does this connection fire multiple times?
- Convert these old SIGNAL()/SLOT() macros to the new pointer syntax

## Expected inputs
The relevant signal and slot declarations, the connect() call, and the surrounding context (object lifetimes, threads involved). Optionally: the Qt version and whether the connection is in the same or different thread.

## Expected outputs
The identified reason the connection is failing, a corrected connect() call using the modern pointer-to-member syntax, and an explanation of the connection type (direct, queued, blocking-queued) required for the threading context.

## Hard rules
- Always prefer the new pointer-to-member connect() syntax over SIGNAL()/SLOT() macros
- Never connect across threads without specifying Qt::QueuedConnection when needed
- Never ignore the return value of connect() during debugging — always assert or check it
- Always verify the receiver object has not been destroyed before the slot fires
