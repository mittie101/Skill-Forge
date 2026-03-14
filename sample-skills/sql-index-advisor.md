---
name: "sql-index-advisor"
framework: claude
---

## When to use
Use when deciding which indexes to create, drop, or modify — analysing query patterns, understanding composite index column ordering, evaluating partial indexes, or auditing an over-indexed table that is slowing down writes.

## Example requests
- What indexes should I create for these three common queries?
- Why is my composite index not being used for this WHERE clause?
- I have 40 indexes on this table and inserts are slow — which can I drop?
- Should I use a partial index or a full index here?

## Expected inputs
The queries to optimise (or slow write workload to fix), the table schema, and existing indexes. Optionally: the database engine, approximate row count, and read/write ratio.

## Expected outputs
Specific CREATE INDEX statements with column order justified, an explanation of which queries each index supports, any redundant or unused indexes to DROP, and a note on the estimated write overhead of each new index.

## Hard rules
- Always justify composite index column order based on selectivity and query filter order
- Never recommend an index without considering its impact on INSERT, UPDATE, and DELETE performance
- Always check for redundant indexes before adding new ones
- Never recommend a covering index without confirming the query engine will use an index-only scan
