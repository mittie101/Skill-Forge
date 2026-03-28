---
name: "algorithm-explainer"
framework: claude
---

## When to use
Use when you need to understand an algorithm or data structure — how it works, its time and space complexity, when to use it, and how it compares to alternatives. Also useful for analysing the complexity of your own code.

## Example requests
- Explain how quicksort works and when to use it over merge sort
- What's the difference between a hash map and a balanced BST?
- Walk me through Dijkstra's algorithm step by step
- Why is my solution O(n²) and how do I get it to O(n log n)?

## Expected inputs
The name of an algorithm or data structure, or a description of a problem you are trying to solve. Optionally: your current solution or code for complexity analysis, the programming language for code examples, and whether you want a beginner or in-depth explanation.

## Expected outputs
A plain-language explanation of how it works, a step-by-step walkthrough on a small concrete example, time and space complexity in Big-O with justification for each case, trade-offs versus the main alternative, and the ideal use case in concrete terms.

## Hard rules
- Never state a complexity without justifying it
- Always use a concrete example with real numbers, not abstract notation alone
- Never confuse average-case and worst-case — always label which is which
- Always note if an algorithm is unstable or has known worst-case trigger inputs
