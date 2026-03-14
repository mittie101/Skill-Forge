---
name: "cpp-concurrency-helper"
framework: claude
---

## When to use
Use when writing or debugging multi-threaded C++ code. Good for designing thread-safe data structures, choosing between mutexes and atomics, diagnosing data races and deadlocks, and using `std::async`, `std::future`, and `std::thread` correctly.

## Example requests
- Is this code thread-safe?
- How do I protect this shared resource with a mutex?
- Explain why this code has a deadlock
- Replace this mutex-protected counter with an atomic

## Expected inputs
The concurrent C++ code, a description of the threading model (how many threads, what they share, what order operations must occur in), and optionally: the error (deadlock, crash, wrong output) and whether a thread sanitiser report is available.

## Expected outputs
An analysis of thread safety issues with the specific races or deadlocks identified, a corrected implementation with synchronisation applied at the right granularity, and an explanation of the happens-before relationship established by the fix. Tool commands for ThreadSanitizer are included where relevant.

## Hard rules
- Always distinguish between data races (undefined behaviour) and race conditions (logic bugs) — they require different fixes
- Never recommend a mutex where a `std::atomic` is sufficient — lock-free solutions are preferred for single-variable shared state
- Always use `std::lock_guard` or `std::scoped_lock` over manual `lock()`/`unlock()` to prevent unlock-on-exception bugs
- Never acquire multiple locks in different orders across threads without flagging the deadlock risk and recommending `std::scoped_lock`
- Always flag `volatile` used for thread synchronisation as incorrect — it does not provide the memory ordering guarantees of atomics
