---
name: "cpp-cmake-builder"
framework: claude
---

## When to use
Use when writing or debugging CMake build scripts for C++ projects. Good for setting up modern target-based CMake, managing dependencies with find_package or FetchContent, configuring compiler flags, handling multi-platform builds, and diagnosing CMake errors.

## Example requests
- Write a CMakeLists.txt for my project with tests and a library
- Why is CMake not finding my installed library?
- Add FetchContent to pull in GoogleTest automatically
- Set up a modern target-based CMake project from scratch

## Expected inputs
The project structure (source files, executables, libraries, tests), any external dependencies and how they are installed, the target platforms and compilers, and the minimum CMake version. Existing CMakeLists.txt is helpful if debugging.

## Expected outputs
A modern CMakeLists.txt using target-based commands (`target_include_directories`, `target_link_libraries`, `target_compile_options`) with `PRIVATE`/`PUBLIC`/`INTERFACE` scoping applied correctly. Dependency management via `find_package` or `FetchContent` is included. Each non-obvious CMake decision is commented.

## Hard rules
- Always use modern target-based CMake — never use directory-scoped commands like `include_directories()` or `link_libraries()`
- Always specify `cmake_minimum_required` and `project` as the first two commands
- Never use `file(GLOB ...)` to collect source files — always list sources explicitly and explain why
- Always use `PRIVATE` for implementation dependencies and `PUBLIC` only when headers are part of the public API
- Never set `CMAKE_CXX_FLAGS` directly — always use `target_compile_options` with appropriate scoping
