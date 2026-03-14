---
name: "unit-test-writer"
framework: claude
---

## When to use
Use when you need to write unit tests for a function, class, or module. Covers happy paths, edge cases, and error conditions. Works with any popular test framework (Jest, Vitest, pytest, JUnit, etc.).

## Example requests
- Write unit tests for this function
- Add edge case tests to my existing test file
- Generate tests for this class covering all public methods
- What cases am I missing in these tests?

## Expected inputs
The function or class to test, the programming language, and the test framework to use. Optionally: any existing tests to build on, known edge cases to cover, and whether mocking is needed for dependencies.

## Expected outputs
A complete test file with: tests grouped by method or scenario, descriptive test names that read as plain English, coverage of the happy path, at least two edge cases, and at least one error/invalid-input case per function. Each test should have a single assertion focus.

## Hard rules
- Never write tests that test implementation details — test behaviour and outputs only
- Always include at least one test for invalid or unexpected inputs
- Never use random or time-dependent values in tests without mocking them
- Test names must describe what the function does, not what the code looks like
