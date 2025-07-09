# 1. High-Level Architecture

Leximory is a modern, AI-powered language learning platform built on a decoupled architecture.

-   **Frontend**: A Next.js 15+ application using the App Router, TypeScript, and HeroUI for components. State is managed primarily with Jotai.
-   **Backend**: A collection of serverless functions, server actions, and API routes responsible for business logic.
-   **Data Persistence**: Supabase is the primary service for the database (Postgres) and user authentication. Upstash Redis is used for caching.
-   **Asynchronous Tasks**: Inngest is used for handling background jobs like AI processing, notifications, and content generation.
-   **AI Integration**: The Vercel AI SDK is used to interface with AI models for features like text annotation.

# 2. Core Architectural Principles

-   **Strict Separation of Concerns**: Adhere to the established separation of logic.
    -   All direct database queries **must** be located in the `server/db/` directory.
    -   Server Actions **must** be defined in `actions.ts` files within the relevant `app/` subdirectory. These actions should call the query functions from `server/db/`.
    -   Client-side components should interact with the backend via Server Actions or, where necessary, API routes.
-   **Server Components by Default**: Leverage Next.js server components for performance. Only use the `'use client'` directive when client-side interactivity or hooks (`useState`, `useEffect`, `useTransition`) are absolutely necessary.
-   **Modularity**: Keep components and functions small, focused, and reusable.

# 3. Key Module Interactions

-   **Annotation Flow**: A user action on the frontend can trigger a server action, which in turn calls an Inngest function (e.g., `inngest/annotate.ts`). This background job then uses modules from `server/ai/` and `server/db/` to perform the annotation and save the result.
-   **The "Creem" Service**: The codebase includes a `lib/creem-sdk/` and an API route at `app/api/creem/`. This is a recognized part of the system. Interactions with this service should be handled through the existing SDK.