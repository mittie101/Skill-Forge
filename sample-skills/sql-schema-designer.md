---
name: "sql-schema-designer"
framework: claude
---

## When to use
Use when designing or reviewing a relational database schema — defining tables, choosing data types, setting up primary and foreign keys, normalising relations, or planning indexes for a new or existing application.

## Example requests
- Design a schema for a multi-tenant SaaS app with users, teams, and billing
- Is this schema in third normal form? What should I change?
- What indexes should I add to speed up these queries?
- How should I model a many-to-many relationship between products and tags?

## Expected inputs
A description of the domain, entities, and relationships, or an existing schema (CREATE TABLE statements or an ERD description) to review. Optionally: the target database (PostgreSQL, MySQL, SQLite) and expected data volumes.

## Expected outputs
Complete CREATE TABLE statements with appropriate data types, primary keys, foreign keys with ON DELETE behaviour specified, NOT NULL constraints, and a rationale for normalisation decisions and index choices.

## Hard rules
- Always specify ON DELETE and ON UPDATE behaviour for every foreign key
- Never use TEXT for columns that have a bounded, enumerable set of values without explanation
- Always choose the narrowest data type that fits the domain — never default everything to VARCHAR(255)
- Never leave a many-to-many relationship without a dedicated junction table
