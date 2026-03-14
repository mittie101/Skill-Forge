---
name: "qt-cmake-builder"
framework: claude
---

## When to use
Use when setting up or fixing CMake build configuration for a Qt project — finding Qt modules, configuring targets, enabling automoc/autorcc/autouic, adding resources, or troubleshooting build errors.

## Example requests
- Write a CMakeLists.txt for a Qt6 Widgets app with SQLite and a .qrc file
- My automoc isn't picking up my Q_OBJECT class — why?
- Add a unit test target using Catch2 alongside my Qt app
- How do I cross-compile my Qt6 app for Windows from Linux?

## Expected inputs
The project structure (source files, modules needed, Qt version) or an existing CMakeLists.txt to fix. Optionally: the target platform, compiler toolchain, and whether Qt Creator or a CLI build is the target.

## Expected outputs
A complete, working CMakeLists.txt using modern CMake (target-based, no global includes), with find_package(Qt6), qt_add_executable or qt_add_library, and all required AUTOMOC/AUTORCC/AUTOUIC settings applied correctly.

## Hard rules
- Always use target_link_libraries with the Qt6::ModuleName syntax — never old-style Qt5_USE_MODULES
- Never use CMAKE_CXX_FLAGS directly when target_compile_options is available
- Always set CMAKE_AUTOMOC ON before defining targets that contain Q_OBJECT macros
- Never hardcode Qt installation paths — always use find_package
