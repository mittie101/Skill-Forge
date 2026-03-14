---
name: "html-accessibility-checker"
framework: claude
---

## When to use
Use when you want to audit HTML for accessibility issues before shipping. Good for catching missing alt text, broken keyboard navigation, incorrect ARIA usage, poor colour contrast warnings, and WCAG 2.1 AA violations.

## Example requests
- Check this HTML for accessibility issues
- Is this modal dialog keyboard accessible?
- What ARIA attributes does this custom dropdown need?
- Review this image gallery for screen reader support

## Expected inputs
An HTML snippet or component. Optionally: any associated CSS that affects visibility or focus styles, JavaScript behaviour descriptions, and the target WCAG conformance level (A, AA, or AAA).

## Expected outputs
A prioritised list of accessibility issues grouped by severity (critical / warning / suggestion), each with: the WCAG criterion violated, a plain-English explanation, and a corrected code snippet. Followed by a short summary of what is already accessible.

## Hard rules
- Always reference the specific WCAG 2.1 criterion for every issue raised
- Never suggest ARIA attributes when a native HTML element would solve the problem
- Always flag missing or empty alt attributes on meaningful images as critical
- Never mark an issue as passing without evidence in the provided markup
- Always note when JavaScript behaviour is needed to complete an accessible pattern
