# Daily Expense Tracker

A local, private expense-tracking application for recording and reviewing daily spending.

## Tech stack

- Java 17+ with the built-in `jdk.httpserver` module
- HTML5
- CSS3
- Vanilla JavaScript
- Local JSON file persistence
- No external dependencies, databases, accounts, or cloud services

## How it works

1. The Java server starts on `127.0.0.1:8000`.
2. It serves the frontend files from `src/static`.
3. The frontend communicates with the Java JSON API.
4. Expense records are stored in `expenses-java.json`.
5. Data is saved atomically to help prevent partial writes.
6. Monetary values are stored as integer cents to avoid floating-point rounding errors.

## Run locally

From the project root:

```powershell
javac --add-modules jdk.httpserver -d .build src\web.java
java -cp .build web

Open the application at:

Stop the server with Ctrl+C.

## Features

### Expense management

- Add expenses with:
  - Amount
  - Category
  - Description
  - Date
- View recorded expenses
- Edit existing expenses
- Delete expenses with confirmation
- Stable numeric expense IDs
- Automatic default date using the local calendar date

### Validation

- Positive amounts only
- Maximum amount of `999999999.99`
- Maximum two decimal places
- Rejects invalid dates
- Rejects blank categories and descriptions
- Category length limited to 80 characters
- Description length limited to 500 characters
- Clear validation and storage error messages

### Filtering and summaries

- Filter by month
- Filter by category
- Reset filters
- Display total spending
- Display transaction count
- Display average expense
- Display highest-spending category
- Display daily spending totals
- Display category spending totals
- Show empty states when no records match the filters

### User interface

- Responsive dashboard layout
- Add and edit expense dialogs
- Accessible labels and keyboard focus states
- Screen-reader-friendly status and error messages
- Loading, empty, success, and failure states
- Mobile, tablet, and desktop layouts
- No external fonts, CDNs, or frontend libraries

## Source structure

```text
src/
├── web.java
└── static/
    ├── index.html
    ├── app.js
    └── styles.css
```

- `src/web.java` contains the local HTTP server, API routes, validation, JSON serialization, and persistence.
- `src/static/index.html` contains the dashboard structure and forms.
- `src/static/app.js` handles API requests, filtering, summaries, charts, and user interactions.
- `src/static/styles.css` provides the responsive visual design and accessibility states.

## API operations

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/expenses` | List expenses and dashboard summaries |
| `POST` | `/api/expenses` | Create an expense |
| `PUT` | `/api/expenses/{id}` | Update an expense |
| `DELETE` | `/api/expenses/{id}` | Delete an expense |

Optional filters for listing expenses:

```text
/api/expenses?month=2026-11
/api/expenses?category=Food
/api/expenses?month=2026-11&category=Food
```

All data is intended for local, single-device use.
```ies
