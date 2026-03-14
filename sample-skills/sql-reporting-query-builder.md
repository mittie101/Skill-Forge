---
name: "sql-reporting-query-builder"
framework: claude
---

## When to use
Use when writing analytical or reporting SQL — aggregations, grouping, window functions, pivot tables, cohort analysis, or any query that summarises data for dashboards or exports.

## Example requests
- Write a query that shows monthly revenue grouped by product category
- Calculate a 7-day rolling average of daily signups
- Pivot this rows-to-columns sales data by quarter
- Show me the top 10 customers by lifetime value with their last order date

## Expected inputs
A description of the report or metric required, the relevant table schemas, and the date range or grouping needed. Optionally: the database engine (for window function syntax differences) and whether the result feeds a dashboard or a one-off export.

## Expected outputs
A complete, readable SQL query using CTEs for clarity, window functions where appropriate, correct GROUP BY and HAVING clauses, and column aliases that match the intended report headers.

## Hard rules
- Always use CTEs instead of deeply nested subqueries for readability
- Never use SELECT * in a reporting query — always name the output columns explicitly
- Always filter date ranges with indexed columns and parameterised values
- Never aggregate without considering NULL values — always be explicit about how NULLs are handled
