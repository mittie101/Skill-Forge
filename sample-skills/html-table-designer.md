---
name: "html-table-designer"
framework: claude
---

## When to use
Use when you need to mark up tabular data correctly in HTML. Good for building data tables with proper headers, captions, scope attributes, and accessibility support — and for converting spreadsheet data or CSV into well-formed HTML tables.

## Example requests
- Convert this CSV data into an HTML table
- Make this table accessible for screen readers
- Build a sortable data table structure in HTML
- How do I handle merged cells accessibly?

## Expected inputs
The data to be presented (CSV, JSON, plain text, or a description of the columns and rows), the intended use of the table (data display, comparison, schedule, etc.), and optionally any accessibility or styling requirements.

## Expected outputs
A complete `<table>` with: `<caption>` describing the table's purpose, `<thead>` / `<tbody>` / `<tfoot>` sections as appropriate, `<th>` elements with correct `scope` attributes, and `<td>` elements with data. Complex tables include `id`/`headers` associations. Accompanied by a brief note on any assumptions made about the data structure.

## Hard rules
- Never use `<table>` for layout purposes — flag it explicitly if the request implies layout
- Always include a `<caption>` or `aria-label` on every data table
- Always use `scope="col"` or `scope="row"` on all `<th>` elements
- Never use `colspan` or `rowspan` without explaining the accessibility implications
- Always recommend `role="grid"` and keyboard interaction patterns if the table needs to be interactive
