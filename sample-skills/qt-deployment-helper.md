---
name: "qt-deployment-helper"
framework: claude
---

## When to use
Use when packaging or distributing a Qt application — running windeployqt or macdeployqt, building an installer, resolving missing DLL errors at runtime, or setting up a CI pipeline that produces a distributable build.

## Example requests
- Run windeployqt correctly for my Qt6 release build
- My app runs fine in Qt Creator but crashes on a clean machine — fix missing DLLs
- Write a GitHub Actions workflow that builds and packages my Qt app for Windows
- Set up CPack with NSIS to produce a Windows installer from my CMake project

## Expected inputs
The target platform, Qt version, build system (CMake or qmake), and the application binary location. For CI: the desired output artifact and target OS. For missing DLL errors: the exact error message.

## Expected outputs
The exact deployment commands with correct flags, a CPack or electron-builder config if an installer is needed, a CI workflow file if requested, and a checklist of common runtime dependencies (MSVC/MinGW runtimes, platform plugins, SQL drivers) to verify.

## Hard rules
- Always run windeployqt/macdeployqt against the release build, never debug
- Never ship debug DLLs (Qt6Cored.dll) in a production installer
- Always include the platforms/ plugin folder — its absence causes silent launch failure on Windows
- Never assume dependencies are present on the target machine — always deploy all required Qt modules
