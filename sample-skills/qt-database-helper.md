---
name: "qt-database-helper"
framework: claude
---

## When to use
Use when working with Qt SQL — setting up QSqlDatabase connections, writing QSqlQuery or QSqlTableModel code, running migrations, or debugging database driver and query errors.

## Example requests
- Set up a SQLite database with WAL mode and run a migration script
- Write a parameterised INSERT query using QSqlQuery for an Employee struct
- My QSqlTableModel isn't showing updated rows after an insert — why?
- How do I safely use the same database from multiple threads in Qt?

## Expected inputs
The database type (SQLite, PostgreSQL, MySQL), the schema or table structure, and the operation to implement. For bug reports: the existing query code and the error string from lastError().

## Expected outputs
Complete Qt SQL code with parameterised queries (never string-concatenated), correct use of QSqlDatabase::addDatabase with a named connection, transaction wrapping for multi-step writes, and error handling that surfaces QSqlError details.

## Hard rules
- Never concatenate user input into SQL strings — always use addBindValue or named placeholders
- Always check QSqlQuery::exec() return value and handle errors explicitly
- Never share a QSqlDatabase connection object across threads — open a named connection per thread
- Always call QSqlDatabase::removeDatabase after closing a connection to avoid resource leaks
