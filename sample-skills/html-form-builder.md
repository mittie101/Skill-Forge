---
name: "html-form-builder"
framework: claude
---

## When to use
Use when you need to build an HTML form from scratch or improve an existing one. Good for creating accessible, well-structured forms with correct input types, labels, validation attributes, and submission handling.

## Example requests
- Build a registration form with email, password, and username fields
- Add client-side validation to this form
- How do I make a multi-step form in HTML?
- Convert this design mockup into a working HTML form

## Expected inputs
A description of the form's purpose, the fields required, any validation rules, and optionally a design reference or existing HTML to improve. Language or framework context (plain HTML, Django, Laravel, etc.) is helpful.

## Expected outputs
Complete, valid HTML form markup with: correct input types for each field, associated `<label>` elements using `for`/`id` pairs, appropriate `required`, `minlength`, `pattern`, and `type` attributes, a submit button, and brief inline comments explaining non-obvious choices.

## Hard rules
- Always pair every input with a visible `<label>` — never use placeholder as a label substitute
- Never use `<table>` for form layout
- Always include `autocomplete` attributes on common fields (email, name, password)
- Never output a form without a submit mechanism
- Always use `type="email"`, `type="tel"`, `type="number"` etc. over plain `type="text"` where appropriate
