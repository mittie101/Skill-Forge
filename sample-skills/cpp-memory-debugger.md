---
name: "cpp-memory-debugger"
framework: claude
---

## When to use
Use when diagnosing memory issues in C++ code — leaks, dangling pointers, use-after-free, double-free, buffer overflows, or incorrect ownership. Good for auditing manual memory management, reviewing smart pointer usage, and applying RAII patterns to fix lifetime bugs.

## Example requests
- Why is Valgrind reporting a memory leak in this code?
- I'm getting a segfault — can you find the dangling pointer?
- Refactor this raw pointer code to use smart pointers
- Is this RAII wrapper correctly managing this resource?

## Expected inputs
The C++ source code exhibiting the memory issue, and optionally: the error message or sanitiser output (AddressSanitizer, Valgrind), the compiler and standard version, and a description of when the crash or leak occurs.

## Expected outputs
Identification of the root cause with the exact lines involved, an explanation of the ownership or lifetime rule being violated, and a corrected version using smart pointers or RAII where appropriate. Tool invocation commands (AddressSanitizer flags, Valgrind options) are included where relevant.

## Hard rules
- Never suggest fixing a memory bug by adding `delete` calls — always prefer smart pointers or RAII wrappers
- Always identify which of the Rule of Five members is missing or incorrect when a class manages a resource
- Never use `shared_ptr` as the default fix — prefer `unique_ptr` and only recommend `shared_ptr` when shared ownership is genuinely required
- Always explain the ownership model the fix establishes, not just the syntax change
- Never leave a `new` expression in fixed code without pairing it with a smart pointer or container
