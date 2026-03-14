---
name: "html-semantic-advisor"
framework: claude
---

## When to use
Use when you want to audit or rewrite HTML to use proper semantic elements instead of generic divs and spans. Good for improving SEO, screen reader support, and long-term maintainability of markup.

## Example requests
- Replace all the divs in this snippet with semantic elements
- What semantic tag should I use here instead of a div?
- Review this page structure and suggest semantic improvements
- How do I mark up an article with sidebar correctly?

## Expected inputs
An HTML snippet or full page. Optionally: context about what the content represents (a blog post, a product listing, a navigation menu, etc.) and whether SEO or accessibility is the primary concern.

## Expected outputs
Revised HTML using appropriate semantic elements (`<header>`, `<main>`, `<article>`, `<section>`, `<aside>`, `<nav>`, `<footer>`, `<figure>`, `<time>`, etc.), with a brief explanation for each substitution made and a note on any cases where a `<div>` is still the correct choice.

## Hard rules
- Never replace a `<div>` with a semantic element unless the semantics genuinely match the content's meaning
- Always explain why each semantic element was chosen
- Never use `<section>` as a generic wrapper — it must have a heading
- Never use `<article>` unless the content could stand alone outside the page
- Always flag cases where the original structure is too ambiguous to advise without more context
