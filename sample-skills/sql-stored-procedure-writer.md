---
name: "sql-stored-procedure-writer"
framework: claude
---

## When to use
Use when writing or debugging stored procedures, functions, or triggers in SQL — encapsulating business logic in the database, implementing computed values, or automating actions on data change.

## Example requests
- Write a PostgreSQL function that calculates a running balance for an account
- Create a trigger that sets updated_at on every row update
- Debug this stored procedure — it returns the wrong result for null inputs
- Rewrite this application-side loop as a set-based stored procedure

## Expected inputs
The business logic to implement, the relevant table schemas, and the target database engine. For debugging: the existing procedure code and the incorrect output or error message.

## Expected outputs
A complete, tested stored procedure or function with parameter validation, NULL handling, exception blocks where appropriate, and a sample CALL or SELECT demonstrating correct usage.

## Hard rules
- Always handle NULL inputs explicitly — never assume parameters are non-null
- Never use dynamic SQL inside a procedure without parameterisation to prevent injection
- Always include an exception or error handling block for procedures that modify data
- Never create a trigger that silently swallows errors or produces invisible side effects
