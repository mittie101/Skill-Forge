---
name: "sql-data-cleaner"
framework: claude
---

## When to use
Use when cleaning or transforming messy data in SQL — deduplicating rows, standardising formats, fixing nulls, parsing free-text fields, or preparing a dataset for analysis or migration.

## Example requests
- Deduplicate this table keeping the most recent row per user
- Standardise all phone numbers in this column to E.164 format
- Find and fix rows where email is present but malformed
- Split a comma-separated tags column into a normalised junction table

## Expected inputs
The table schema and a description of the data quality problem, or sample rows showing the dirty data and the desired clean output. Optionally: the database engine and whether changes should be applied in-place or to a new table.

## Expected outputs
A step-by-step SQL script: first a SELECT to preview affected rows, then the UPDATE or INSERT to apply the fix, wrapped in a transaction where appropriate, with a final SELECT to verify the result.

## Hard rules
- Always show a SELECT preview of affected rows before writing the UPDATE or DELETE
- Always wrap destructive data changes in a transaction with an explicit COMMIT or ROLLBACK
- Never delete duplicate rows without first confirming which row to keep
- Always back up or snapshot affected data before bulk updates on production
