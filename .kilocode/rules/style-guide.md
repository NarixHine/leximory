# 5. Coding Style & Conventions

-   **Quotes**: Use single quotes (`'`) where possible.
-   **Semicolons**: Do not use semicolons at the end of statements.
-   **Indentation**: 4 spaces.
-   **Line Length**: Maximum 100 characters.
-   **Commas**: No trailing commas.
-   **Components**:
    -   Use function declarations (`function MyComponent() {}`).
    -   Use default exports (`export default MyComponent`).
    -   Destructure props in the function signature.
-   **State & Async Operations**:
    -   Minimize the use of `useEffect` and `useState`.
    -   Use `useTransition` for async operations to avoid hard loading states.
-   **Time in Milliseconds**: use `itty-time` to make it readable
-   **Language**: code in English but use Chinese for everything end-user facing