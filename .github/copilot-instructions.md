# Copilot Rules for Next.js Application

## Code Style Guidelines

1. Always use *single* quotes where possible
2. No semicolons at the end of statements
3. Use 4 spaces for indentation
4. Maximum line length of 100 characters
5. Use LF line endings
6. No trailing commas
7. Always use Next.js 15 promise-based page props

## Component Structure

1. Use function declarations instead of arrow functions for components
2. Export components as default exports
3. Destructure props in function parameters
4. Use TypeScript types for props and state
5. Keep components focused and modular

## File Organization

1. Components should be in their own directories
2. Keep related components together
3. Use lowercase and hyphens for file names

## React/Next.js Conventions

1. Use `'use client'` directive for client components
2. Follow Next.js 15+ app directory structure
3. Use server components by default
4. Implement proper error boundaries
5. Use proper loading states
6. All direct database queries must be in `@/server/db`
7. For every folder under `/app`,  use `page.tsx` for the page component, `actions.ts` for server actions (which should call queries in `@/server/db`), `layout.tsx` for layout components, and `/components` for other components

## Best Practices

1. Keep components small and focused
2. Use proper TypeScript types
3. Implement proper error handling
4. Use proper state management
5. Follow React hooks rules
6. Use proper memoization when needed
7. Avoid loading states; use useTransition for async operations
8. Use as few useEffect & useState hooks as possible
9. Use `Zod` to validate props in server actions

## Tech Stack

1. Next.js 15+
2. TypeScript
3. Tailwind CSS
4. HeroUI (`@heroui/...`, formerly NextUI)
5. React Icons (`react-icons/pi`)
6. Vercel AI SDK
7. Supabase for authentication, database and storage
8. Upstash for Redis
9. Inngest for background jobs

## Utilities

1. Use `es-toolkit` for utility functions wherever possible. It provides a consistent set of utilities for common tasks.
2. Use `<Main>` / `<Center>` in `@/components/ui` on top of a layout/page, but avoid using it at both levels.
