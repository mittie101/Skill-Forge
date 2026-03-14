---
name: "html-meta-seo-optimizer"
framework: claude
---

## When to use
Use when you need to audit or write the `<head>` section of an HTML page for SEO, social sharing, and browser compatibility. Good for adding Open Graph tags, Twitter Cards, canonical URLs, structured data hints, and viewport/charset declarations.

## Example requests
- Write the full head section for my blog post page
- What meta tags is this page missing?
- Add Open Graph and Twitter Card tags to this HTML
- Review my head section for SEO issues

## Expected inputs
An existing `<head>` block or a description of the page (type, title, description, URL, featured image URL, author). Optionally: the target platform (web app, blog, e-commerce) and any structured data requirements.

## Expected outputs
A complete, optimised `<head>` block with: charset and viewport declarations, a well-formed `<title>`, meta description, canonical link, Open Graph tags, Twitter Card tags, and any favicon/manifest links. Each addition is commented with a one-line reason.

## Hard rules
- Always include charset and viewport as the first two tags
- Never write a meta description longer than 160 characters
- Always include a canonical URL to prevent duplicate content issues
- Never duplicate the page title verbatim as the OG title without review — they often need different copy
- Always flag if a featured image URL is missing, as OG/Twitter cards will be degraded without it
