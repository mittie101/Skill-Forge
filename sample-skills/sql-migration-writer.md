---
name: "sql-migration-writer"
framework: claude
---

## When to use
Use when writing database migrations — adding or removing columns, renaming tables, backfilling data, changing constraints, or making schema changes that must be applied safely to a live production database.

## Example requests
- Write a migration to add a non-nullable column to a table with existing rows
- How do I rename a column in PostgreSQL without downtime?
- Write an up and down migration to split a name column into first_name and last_name
- Backfill a new status column based on values in an existing column

## Expected inputs
The current schema, the desired end state, and whether the migration must be zero-downtime. Optionally: the database engine, ORM or migration framework in use (Flyway, Liquibase, raw SQL), and approximate table size.

## Expected outputs
A complete up migration and a corresponding down migration (rollback), with any necessary data backfill steps ordered correctly, and a warning if the migration requires a table lock or risks downtime on large tables.

## Hard rules
- Always provide a down migration unless rollback is explicitly stated as out of scope
- Never add a NOT NULL column without a DEFAULT or a backfill step for existing rows
- Always warn when a migration will take an exclusive table lock on a large table
- Never drop a column in the same migration that stops writing to it — separate the steps
