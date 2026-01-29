# Quiz Generator System Documentation

## 1. System Overview

The Quiz Generator is a React-based system designed to render interactive quizzes, manage user state (answers), handle submission/revision modes, and integrate AI-assisted explanations. It utilizes **Jotai** for state management, **React Query** for async operations, and a Strategy Pattern to render different question types (Cloze, Reading, Grammar, etc.).

### Core Capabilities

* **Dual Rendering:** Supports Client-Side Rendering (Interactive) and Server-Side Rendering (Static/Print).
* **State Modes:** Handles input (`normal`), answer checking (`revise`), and teacher tracking (`track`).
* **Persistence:** Automatically syncs answers to `localStorage` via Jotai utils.
* **AI Integration:** "Ask AI" context-aware explanations for specific blanks/questions.

---

## 2. State Management (Jotai)

The system relies on a complex atom structure to manage the lifecycle of a quiz session.

### 2.1 Atom Architecture (`paper/atoms.ts`)

| Atom Name | Scope | Persistence | Description |
| --- | --- | --- | --- |
| `paperIdAtom` | Global | Memory | Stores current paper ID. Defaults to `DEFAULT-PAPER`. |
| `viewModeAtom` | Global | Memory | Controls UI state: `'normal'` (editing) or `'revise'` (reviewing). |
| `editoryItemsAtom` | Global | LocalStorage | Stores the raw Quiz Data (`QuizItems`). Key: `'editory-items'`. |
| `answersAtomFamily` | Family | LocalStorage | **Source of Truth.** Maps `paperId` -> `Record<QuestionNo, Answer>`. |
| `submittedAnswersAtom` | Global | Memory | Read-only copy of answers used during `revise` mode for comparison. |

### 2.2 Access Patterns

**Reading Answers:**
Do not read `answersAtomFamily` directly in components. Use the derived atom:

```typescript
const answers = useAtomValue(answersAtom); // returns Record<number, string | null>

```

**Writing Answers:**
Use the dedicated setter atom to ensure referential integrity and correct paper ID targeting:

```typescript
const setAnswer = useSetAtom(setAnswerAtom);
// Usage:
setAnswer({ questionId: 5, option: "B" });

```

---

## 3. Component Architecture

The rendering pipeline transforms raw `QuizData` into interactive UI components using a Strategy Pattern.

### 3.1 Entry Points (`paper/generators`)

* **`QuizPaperRSC` (`rsc.tsx`):**
* **Usage:** Server Components / Static generation.
* **Logic:** Renders the quiz structure without client-side state logic initially (for SEO/Print).


* **`QuizKey` (`index.tsx`):**
* **Usage:** Renders the answer key.


* **`QuestionProcessor`:**
* **Logic:** The middleware that calculates question numbering offsets (`getQuestionStarts`) and selects the correct strategy.



### 3.2 The Strategy Pattern (`paper/generators/strategies.tsx`)

The system maps `QuizDataType` strings to rendering logic.

* **Logic:** `applyStrategy(data, callback)`
* **Supported Types:**
* `choice`, `cloze`, `reading`, `grammar`, `listening`, `fishing`, `sentences`, `custom`.



### 3.3 Core UI Components

#### `Blank` (`paper/blank/index.tsx`)

The fundamental unit of interaction. It handles the display logic for a specific question number.

* **Props:** `number` (Question ID), `groupId` (Parent Item ID), `blankCount`.
* **Modes:**
* **Normal:** Wraps content in a `Popover` allowing interaction.
* **Revise:** Displays correct/incorrect icons (`CheckCircleIcon`, `XCircleIcon`). Shows the user's answer vs. the correct key.



#### `MultipleChoice` (`paper/blank/index.tsx`)

Renders options (A, B, C, D) horizontally or in a grid.

* **Normal:** Buttons change color on selection (`secondary`).
* **Revise:**
* User Correct: Green Solid.
* User Wrong: Red Solid (User selection) + Green Flat (Correct Answer).



#### `Choice` (`paper/choice.tsx`)

Vertical list layout for options, typically used in Reading/Listening comprehension.

* **Logic:** Similar state handling to `MultipleChoice` but different visual presentation (List vs Grid).

#### `FillInTheBlank` (`paper/blank/index.tsx`)

Renders a text input.

* **UX Feature:** Auto-focuses next input on `Enter` key press.

---

## 4. Feature: Ask AI

The system includes a context-aware AI tutor feature triggered from `revise` mode.

### 4.1 Data Flow

1. **Trigger:** User clicks "Ask AI" (`AskButton`).
2. **Context Assembly (`hooks.tsx`):**
* `useAsk` hook gathers: Question context, User Answer, Correct Answer, and text surrounding the blank.


3. **UI State:** `openAskAtom` opens the `Drawer` component (`blank/ask.tsx`).
4. **Streaming:** `Streamdown` component renders markdown streamed from `streamExplanationAction`.

### 4.2 Highlighting Logic (`paper/blank/hooks.tsx`)

The AI response can return specific text segments to highlight in the original passage.

* **Hook:** `useScrollToMatch`
* **Mechanism:** Searches the DOM tree for text nodes matching the returned string and scrolls them into view.

---

## 5. Developer Guides

### 5.1 Adding a New Question Strategy

1. **Define Schema:** Update `QuizDataType` in `@repo/schema/paper`.
2. **Update Config:** Add the type name and icon to `NAME_MAP` and `ICON_MAP` in `paper/generators/config.tsx`.
3. **Create Strategy:** In `paper/generators/strategies.tsx` (implied content), register a new strategy function that returns the UI component.
4. **Implement UI:** Use `MultipleChoice`, `FillInTheBlank`, or `Choice` components to ensure state wiring is handled automatically.

### 5.2 Type Definitions (`paper/generators/config.tsx`)

```typescript
type AlphabeticalMarker = 'A' | 'B' | ... | 'Z';

interface QuizData {
  id: string;
  type: 'cloze' | 'reading' | ...;
  // ... other properties from schema
}

```

### 5.3 Working with Blanks

When creating custom question layouts, always wrap the interactive element in the `Blank` component or use the `MemoizedBlank` wrapper to inherit View Mode logic automatically.

```tsx
// Example of a custom blank implementation
<MemoizedBlank number={questionIndex} groupId={data.id}>
  <PopoverContent>
    <MyCustomInput questionId={questionIndex} />
  </PopoverContent>
</MemoizedBlank>

```

### 5.4 Utility Functions (`paper/generators/utils.ts`)

* `getQuestionStarts(quizData)`: Returns an array of start indices for each question group. Essential for continuous numbering across different question types.
* `matchColor(...)`: Helper to determine UI colors based on `(userAnswer, correctAnswer)` tuples.
