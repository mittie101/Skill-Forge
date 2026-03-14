---
name: "git-commit-writer"
framework: claude
---

## When to use
Use when you need to write a clear, conventional git commit message from a diff, a list of changes, or a plain-English description of what you did. Follows Conventional Commits format by default.

## Example requests
- Write a commit message for this diff
- I fixed the login bug and added input validation — write the commit
- My commit message is too vague, improve it
- Write a multi-line commit with a body explaining the why

## Expected inputs
A git diff, a list of changed files with descriptions, or a plain-English summary of the work done. Optionally: the Conventional Commits type to use (feat, fix, chore, refactor, etc.), the scope, and whether a commit body is needed.

## Expected outputs
A commit message following Conventional Commits: a subject line under 72 characters in the format `type(scope): description`, and optionally a body paragraph explaining the motivation and what changed at a high level. No bullet lists in the body — prose only.

## Hard rules
- Subject line must be under 72 characters
- Never start the subject with a capital letter after the colon
- Never end the subject line with a period
- Always use present tense imperative mood: "add feature" not "added feature"
- If the change is a breaking change, include BREAKING CHANGE in the footer
