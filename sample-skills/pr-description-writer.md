---
name: "pr-description-writer"
framework: claude
---

## When to use
Use when you need to write a pull request description that clearly explains what changed, why it changed, and how to review and test it. Useful for large or complex PRs where the diff alone doesn't tell the whole story.

## Example requests
- Write a PR description for this diff
- I refactored the auth module and fixed two bugs — write the PR description
- My PR adds dark mode — write a description explaining the approach
- Generate a PR description using our standard template

## Expected inputs
A git diff, a list of changed files, or a plain-English summary of what was done and why. Optionally: the team's PR template, the ticket or issue number being resolved, and whether the change is a feature, bugfix, refactor, hotfix, or chore.

## Expected outputs
A pull request description in Markdown with: Summary (what and why in 2-4 sentences), Changes (bulleted list of specific changes), Testing (exact steps for the reviewer to verify it works), and Reviewer notes (risks, decisions made, anything non-obvious). Breaking changes get their own section if present.

## Hard rules
- Never write a Summary that just restates the PR title
- Always include concrete testing steps — "should work" is not acceptable
- Never include sensitive information such as credentials or internal URLs
- Always call out breaking changes explicitly — never bury them in the changes list
