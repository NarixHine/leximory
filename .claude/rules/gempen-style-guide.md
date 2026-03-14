# 5. Coding Style & Conventions

-   **Quotes**: Use single quotes (`'`) where possible.
-   **Semicolons**: Do not use semicolons at the end of statements.
-   **Indentation**: 4 spaces.
-   **Line Length**: Maximum 100 characters.
-   **Commas**: No trailing commas.
-   **Class Names**: use `cn` utility (imported from `@heroui/theme`) for concatenation
-   **Components**:
    -   Use function declarations (`function MyComponent() {}`).
    -   Avoid default exports where possible.
    -   Destructure props in the function signature.
-   **State & Async Operations**:
    -   Minimize the use of `useEffect` and `useState`.
    -   Use `useAction` from `next-safe-action` for mutation and loading state
-   **Time in Milliseconds**: use `itty-time` to make it readable
-   **Language**: code in English but use Chinese for everything end-user facing
-   **HeroUI Components**: put icons in `startContent` and optionally enable `isIconOnly`; use `onPress` for button event handlers
-   Always append affix `Icon` to Phosphorous Icons imports
