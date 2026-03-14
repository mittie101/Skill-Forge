---
name: "html-email-template-writer"
framework: claude
---

## When to use
Use when you need to build or fix an HTML email template that renders correctly across email clients (Gmail, Outlook, Apple Mail, etc.). Good for transactional emails, newsletters, and marketing campaigns where cross-client compatibility is critical.

## Example requests
- Build a transactional order confirmation email template
- Why is my email broken in Outlook?
- Convert this web HTML into an email-safe version
- Create a responsive two-column newsletter layout

## Expected inputs
A description of the email's purpose and content sections, any branding colours or fonts, and optionally existing HTML or a design reference. Mention which email clients must be supported if known.

## Expected outputs
A complete, self-contained HTML email using table-based layout, inline CSS, web-safe fonts with fallbacks, and a plain-text fallback summary. Includes comments flagging any Outlook-specific MSO conditional comments used and notes on tested client compatibility.

## Hard rules
- Always use table-based layout — never use CSS Grid or Flexbox in email HTML
- Always inline all CSS — never rely on `<style>` blocks for email clients that strip them
- Never use JavaScript in email templates
- Always include a plain-text version note or fallback content
- Always set explicit `width` and `height` on images
- Never use external fonts without a web-safe fallback stack
