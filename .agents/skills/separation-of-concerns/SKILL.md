---
name: separation-of-concerns
description: Guide for implementing Separation of Concerns - a software design principle that promotes organizing code into distinct sections, in the case of Next.js, separating server-side logic. Use when structuring Next.js applications to enhance maintainability, scalability, and readability.
---

Break down the app backend into three main layers: Database access layer (`/db`), Business logic layer (`/services`), and Server Components layer.

Database Access Layer (`/db`):
- Responsible for interacting with the database.
- Contains functions for CRUD operations and data retrieval.
- Example: `db/user.ts` for user-related database operations.

Business Logic Layer (`/services`):
- Contains the core application logic and rules.
- Uses `next-safe-actions` for handling server actions and side effects.
- Uses `better-auth` for handling authentication and Kilpi (reference `authorization-framework` skill) for handling authorization.
- Example: `services/user-service.ts` for user-related business logic.

Server Components Layer:
- Contains Next.js Server Components that handle rendering and server-side logic.
- Uses the Business Logic Layer or Database Access Layer to fetch data.
