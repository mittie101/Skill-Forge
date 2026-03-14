---
name: "html-boilerplate-generator"
framework: claude
---

## When to use
Use when starting a new HTML project or page and you need a solid, production-ready starting template. Good for generating opinionated boilerplates that include correct meta tags, CSP placeholders, favicon links, skip navigation, and a sensible document outline.

## Example requests
- Give me a production-ready HTML boilerplate
- Create a starter template for a single-page app
- What does a modern HTML5 document shell look like?
- Generate a boilerplate with dark mode support built in

## Expected inputs
The type of project (static site, SPA shell, landing page, email — though email has its own skill), any specific requirements (dark mode, PWA manifest, CSP, analytics placeholder), and optionally the CSS approach (plain, Tailwind, custom properties).

## Expected outputs
A complete, commented HTML file from `<!DOCTYPE html>` to `</html>` with: correct lang attribute, charset and viewport, SEO meta placeholders, Open Graph placeholders, favicon links, a skip-navigation link, semantic landmark structure (`<header>`, `<main>`, `<footer>`), and clearly labelled placeholder comments for customisation points.

## Hard rules
- Always include `lang` attribute on `<html>` — flag if the target language is unknown
- Always include a skip-navigation link as the first focusable element in the body
- Never include jQuery or legacy polyfills in a modern boilerplate unless explicitly requested
- Always include a `<meta name="theme-color">` placeholder for mobile browser chrome
- Never output a boilerplate without at minimum charset, viewport, and a `<title>` tag
