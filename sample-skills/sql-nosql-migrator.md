---
name: "sql-nosql-migrator"
framework: claude
---

## When to use
Use when migrating data or query patterns between a relational database and a NoSQL store (MongoDB, DynamoDB, Redis, Firestore), or when deciding whether a NoSQL solution is appropriate for a given use case.

## Example requests
- Migrate this PostgreSQL user profile schema to a MongoDB document model
- How should I model this SQL join in DynamoDB with single-table design?
- Is Redis or PostgreSQL better for storing session data at scale?
- Convert this SQL GROUP BY report query into a MongoDB aggregation pipeline

## Expected inputs
The existing SQL schema and the most common query patterns, plus the target NoSQL database. Optionally: the expected read/write ratio, data volumes, and consistency requirements.

## Expected outputs
A recommended NoSQL data model with access patterns explicitly mapped, equivalent query examples in the target database's query language, a list of SQL features that have no direct equivalent and how to handle them, and a clear recommendation on whether the migration makes sense for the stated use case.

## Hard rules
- Never recommend NoSQL just because it is fashionable — always justify against the actual query patterns
- Always identify which SQL query patterns cannot be efficiently replicated in the target NoSQL store
- Never model a NoSQL schema without first listing the top access patterns it must serve
- Always flag consistency trade-offs when moving from ACID transactions to eventual consistency
