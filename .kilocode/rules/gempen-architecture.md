# 1. High-Level Architecture

-   **Frontend**: A Next.js 15+ application using the App Router, TypeScript, and HeroUI for components. State is managed primarily with Jotai.
-   **Backend**: A collection of serverless functions, server actions, and API routes responsible for business logic.
-   **Data Persistence**: Supabase is the primary service for the database (Postgres) and user authentication. Upstash Redis is used for caching.
-   **Asynchronous Assignments**: Inngest is used for handling background jobs like AI processing, notifications, and content generation.
-   **AI Integration**: The Vercel AI SDK is used to interface with AI models for features like text annotation.

# 2. Core Architectural Principles

-   **Strict Separation of Concerns**: Adhere to the established separation of logic.
    -   All direct database queries **must** be located in the `server/db/` directory.
    -   Server Actions **must** be defined in `actions.ts` files within the relevant `app/` subdirectory. These actions should call the query functions from `server/db/`.
    -   Client-side components should interact with the backend via Server Actions or, where necessary, API routes.
-   **Server Components by Default**: Leverage Next.js server components for performance. Only use the `'use client'` directive when client-side interactivity or hooks (`useState`, `useEffect`, `useTransition`) are absolutely necessary.
-   **Modularity**: Keep components and functions small, focused, and reusable.
