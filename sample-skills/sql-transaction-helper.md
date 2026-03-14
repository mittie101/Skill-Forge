---
name: "sql-transaction-helper"
framework: claude
---

## When to use
Use when writing multi-step database operations that must succeed or fail together — implementing transactions, choosing isolation levels, handling deadlocks, or debugging lost updates and phantom reads.

## Example requests
- Wrap these three inserts in a transaction that rolls back on any error
- What isolation level should I use to prevent double-booking in a reservation system?
- My app gets deadlocks under load — how do I diagnose and fix them?
- Implement optimistic locking for concurrent edits to the same record

## Expected inputs
The sequence of SQL operations to protect and the consistency requirement. For deadlock debugging: the queries involved and the database engine. For isolation: the concurrency scenario and acceptable trade-offs.

## Expected outputs
A complete transaction block with the correct isolation level set, error handling that triggers a ROLLBACK, and an explanation of why the chosen isolation level prevents the stated concurrency problem without unnecessary locking overhead.

## Hard rules
- Always set the isolation level explicitly — never rely on the database default without understanding it
- Never hold a transaction open while waiting for user input or an external API call
- Always keep transactions as short as possible to minimise lock contention
- Never silently swallow a transaction error — always surface or log the failure before rolling back
