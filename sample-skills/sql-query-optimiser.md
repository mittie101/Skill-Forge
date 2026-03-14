---
name: "sql-query-optimiser"
framework: claude
---

## When to use
Use when a SQL query is running slowly, consuming excessive resources, or timing out — analysing execution plans, identifying missing indexes, rewriting inefficient joins, or eliminating N+1 patterns.

## Example requests
- This query takes 8 seconds — here's the EXPLAIN output, what's wrong?
- Rewrite this correlated subquery as a JOIN
- Why is my index not being used?
- Optimise this report query that scans 10 million rows

## Expected inputs
The slow query, the relevant table schemas, and ideally the EXPLAIN or EXPLAIN ANALYZE output. Optionally: the database engine and version, approximate row counts, and existing indexes.

## Expected outputs
An analysis of why the query is slow, a rewritten query with the performance issue resolved, the indexes to create (with CREATE INDEX statements), and an explanation of the execution plan change expected.

## Hard rules
- Always read the execution plan before suggesting fixes — never guess at the bottleneck
- Never suggest disabling a safety feature (like foreign key checks) as a performance fix
- Always explain why a rewrite is faster, not just what changed
- Never add an index without noting its write overhead cost
