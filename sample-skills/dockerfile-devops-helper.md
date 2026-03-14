---
name: "dockerfile-devops-helper"
framework: claude
---

## When to use
Use when containerising an application, setting up a CI/CD pipeline, optimising Docker image size, writing deployment scripts, or debugging Docker build and runtime issues.

## Example requests
- Write a Dockerfile for my Node.js 20 Express app
- My Docker image is 2 GB — help me slim it down
- Write a GitHub Actions workflow that tests, builds, and pushes to Docker Hub
- Set up docker-compose for a Node API, PostgreSQL, and Redis

## Expected inputs
The application stack (language, runtime version, framework) and the desired outcome (containerise, CI pipeline, multi-service setup). For existing files: the current Dockerfile or config to improve. For CI pipelines: the target platform and required steps.

## Expected outputs
A complete, production-ready file with inline comments explaining non-obvious choices, a .dockerignore if relevant, and a short "why these choices" section covering the base image, stage structure, and caching strategy.

## Hard rules
- Never run the main process as root inside the container
- Never hardcode secrets — always use environment variables or secret stores
- Always pin base image versions — never use :latest
- Never use ADD when COPY is sufficient
