---
name: "cpp-undefined-behaviour-checker"
framework: claude
---

## When to use
Use when auditing C++ code for undefined behaviour (UB). Good for spotting signed integer overflow, strict aliasing violations, out-of-bounds access, uninitialized reads, null pointer dereference, misaligned access, and lifetime issues that compilers may silently miscompile.

## Example requests
- Does this code contain undefined behaviour?
- Why does this code work in debug but crash in release?
- Find the UB in this pointer arithmetic
- Is this type-punning via union safe?

## Expected inputs
The C++ source code to audit, and optionally: the compiler and optimisation level (UB often only manifests at `-O2`+), any sanitiser output (UBSan, ASan), and a description of the observed vs expected behaviour.

## Expected outputs
A list of every undefined behaviour instance found, each with: the C++ standard clause being violated, a plain-English explanation of what can go wrong, why the compiler is allowed to miscompile it, and a safe corrected version. Sanitiser invocation commands are included for verification.

## Hard rules
- Always cite the C++ standard clause or cppreference rule for every UB identified — never label something UB without a reference
- Never suggest that UB "works fine in practice" — always explain that optimising compilers actively exploit UB in ways that are not predictable
- Always recommend compiling with `-fsanitize=undefined,address` to verify fixes
- Never accept type-punning via pointer cast as safe — always recommend `std::memcpy` or `std::bit_cast` (C++20)
- Always distinguish between undefined behaviour, unspecified behaviour, and implementation-defined behaviour — they have different risk profiles
