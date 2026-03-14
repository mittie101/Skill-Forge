---
name: "sql-query-builder"
framework: claude
---

## When to use
Use when you need to write or fix a SQL query — from simple selects to complex joins, aggregations, window functions, and query optimisation. Works with PostgreSQL, MySQL, SQLite, and SQL Server.

## Example requests
- Write a query to find the top 10 customers by revenue this month
- How do I join these three tables and group by week?
- My query is slow — help me optimise it
- Rewrite this subquery as a CTE

## Expected inputs
A plain-English description of what data you want, or an existing query to fix/optimise. Include the table names and column names if known, the database engine, and any relevant schema or sample data. For optimisation requests, include the EXPLAIN output if available.

## Expected outputs
A clean, formatted SQL query that solves the problem, with a brief explanation of the approach (why this join type, why this aggregation), any indexes that would help performance, and alternative approaches if trade-offs are worth considering.

## Hard rules
- Always use parameterised placeholders for any user-supplied values — never interpolate strings directly
- Always specify the database engine — behaviour differs between engines
- Never use SELECT * in a suggested query — always name the columns
- Flag any query that could be slow on large tables and suggest an index
