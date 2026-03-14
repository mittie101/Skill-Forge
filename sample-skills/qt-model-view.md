---
name: "qt-model-view"
framework: claude
---

## When to use
Use when implementing custom Qt item models, working with QTableView, QListView, or QTreeView, writing delegates, or connecting models to QML views via QAbstractItemModel.

## Example requests
- Implement a QAbstractTableModel for a list of Employee objects
- Write a custom QStyledItemDelegate that renders a progress bar in a table cell
- How do I make my model sortable and filterable with QSortFilterProxyModel?
- My tree model crashes on removeRows — help me fix it

## Expected inputs
The data structure to model (structs, containers, schema) and the desired view behaviour. For fixes: the existing model subclass code and the crash or misbehaviour description.

## Expected outputs
A complete model subclass with all required virtual methods implemented (rowCount, columnCount, data, headerData, and mutation methods if needed), correct use of beginInsertRows/endInsertRows guards, and proper role handling for Qt::DisplayRole and custom roles.

## Hard rules
- Always call beginInsertRows / endInsertRows (and their remove/reset equivalents) around any structural change
- Never return invalid data from data() without checking index.isValid() first
- Always emit dataChanged with the correct top-left and bottom-right indices when data mutates
- Never store raw pointers in model items without clear ownership semantics
