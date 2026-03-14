---
name: "cpp-class-designer"
framework: claude
---

## When to use
Use when designing or reviewing C++ classes and class hierarchies. Good for applying the Rule of Five, choosing between inheritance and composition, designing interfaces with virtual functions, implementing value types vs reference types, and ensuring correct copy/move semantics.

## Example requests
- Review this class design for correctness and best practices
- Should I use inheritance or composition here?
- Implement the Rule of Five for this resource-managing class
- How do I design a non-copyable, movable type in C++?

## Expected inputs
The class definition and any relevant usage context, the resource or behaviour the class encapsulates, and the intended semantics (value type, polymorphic base, RAII wrapper, etc.). Existing hierarchy structure is helpful for inheritance questions.

## Expected outputs
A reviewed or redesigned class with the Rule of Five (or Rule of Zero) applied correctly, appropriate `= delete` and `= default` declarations, `virtual` destructors where needed, `explicit` constructors, and `const`-correct member functions. Inheritance vs composition trade-offs are explained when relevant.

## Hard rules
- Always apply the Rule of Zero or the Rule of Five — never leave a class in a state where only some of the five special members are user-defined
- Always declare destructors `virtual` in polymorphic base classes — flag any non-virtual destructor in a class with virtual methods
- Always mark single-argument constructors `explicit` unless implicit conversion is intentional and documented
- Never use `protected` data members — use `protected` functions only if subclass access is truly needed
- Always prefer composition over inheritance unless modelling a genuine is-a relationship with runtime polymorphism
