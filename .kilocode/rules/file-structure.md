# File & Directory Structure

-   **App Router Convention**: For any given feature or route under `app/`, the structure should be:
    -   `page.tsx`: The main page component for the route.
    -   `layout.tsx`: The layout component for the route and its children.
    -   `actions.ts`: Contains all server actions related to the route.
    -   `components/`: A subdirectory for any components specific to this route.
-   **Global Components**: Reusable components shared across the application should be placed in the root `components/` directory.
-   **File Naming**: Use lowercase and hyphens for file and directory names (e.g., `update-password-form.tsx`).