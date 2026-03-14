---
name: "cpp-error-handling-advisor"
framework: claude
---

## When to use
Use when designing or reviewing error handling in C++ code. Good for choosing between exceptions, error codes, `std::optional`, `std::expected` (C++23), and `outcome`, applying `noexcept` correctly, and ensuring error paths are not silently swallowed.

## Example requests
- Should I use exceptions or error codes in this library?
- How do I use std::expected for error handling?
- Mark the right functions noexcept in this class
- This catch block is swallowing errors silently — how do I fix it?

## Expected inputs
The C++ code with existing or planned error handling, the context (library vs application, embedded vs desktop, performance constraints), and the C++ standard version. The types of errors expected (recoverable, programmer error, system failure) help select the right strategy.

## Expected outputs
A recommended error handling strategy with justification, updated code applying the strategy consistently, correct `noexcept` specifiers, and a note on exception safety guarantees (basic, strong, nothrow) provided by each function. Anti-patterns in the original code are identified.

## Hard rules
- Never use exceptions for expected, recoverable conditions in performance-critical or embedded code — use `std::optional` or `std::expected`
- Always apply `noexcept` to move constructors and move assignment operators — failing to do so prevents STL optimisations
- Never catch exceptions by value — always catch by `const` reference
- Never write a bare `catch(...)` that swallows exceptions without at minimum rethrowing or logging
- Always distinguish between precondition violations (programmer errors, use `assert` or terminate) and runtime errors (use exceptions or error values)
