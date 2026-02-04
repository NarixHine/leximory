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
| `answersAtomFamily` | Family | LocalStorage | **Source of Truth.** Maps `paperId` -> `SectionAnswers`. Structure: `{ sectionId: { localQuestionNo: optionText } }` |
| `submittedAnswersAtom` | Global | Memory | Read-only copy of answers used during `revise` mode for comparison. Uses same `SectionAnswers` structure. |

#### Answer Structure

The answer schema uses a **section-based structure** to ensure reliability when options are shuffled or questions are added/removed:

```typescript
// SectionAnswers type
type SectionAnswers = Record<string, Record<number, string | null>>

// Example:
{
  "abc123": { 1: "word", 2: "hello" },  // Section "abc123" with local question numbers
  "xyz789": { 1: "option A text", 2: "option B text" }
}
```

- **sectionId**: The unique ID of the quiz section (from `data.id`)
- **localQuestionNo**: 1-based index within the section (not global question number)
- **optionText**: The actual answer text/word, not the marker (A, B, C, etc.)

### 2.2 Access Patterns

**Reading Answers:**
Do not read `answersAtomFamily` directly in components. Use the derived atom:

```typescript
const answers = useAtomValue(answersAtom); // returns SectionAnswers

// Access a specific answer:
const answer = answers[sectionId]?.[localQuestionNo]; // e.g., answers["abc123"]?.[1]
```

**Writing Answers:**
Use the dedicated setter atom to ensure referential integrity and correct paper ID targeting:

```typescript
const setAnswer = useSetAtom(setAnswerAtom);
// Usage - pass sectionId, localQuestionNo, and the actual option text:
setAnswer({ sectionId: "abc123", localQuestionNo: 1, option: "the actual answer text" });
```

> **Important:** Store the actual option text, not the marker letter (A, B, C). This ensures answers remain valid even when options are shuffled.

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

The fundamental unit of interaction. It handles the display logic for a specific question.

* **Props:** 
  * `displayNo` (Global question number for display)
  * `localNo` (1-based question number within the section, used for answer storage)
  * `groupId` (Section ID from `data.id`)
  * `blankCount` (Optional)
* **Modes:**
  * **Normal:** Wraps content in a `Popover` allowing interaction.
  * **Revise:** Displays correct/incorrect icons (`CheckCircleIcon`, `XCircleIcon`). Shows the user's answer vs. the correct key.



#### `MultipleChoice` (`paper/blank/index.tsx`)

Renders options (A, B, C, D) horizontally or in a grid.

* **Props:**
  * `displayNo` (Global question number for display)
  * `localNo` (1-based local question number for storage)
  * `options` (Array of option strings)
  * `groupId` (Section ID)
* **Normal:** Buttons change color on selection (`secondary`). Stores the **actual option text**, not the marker.
* **Revise:**
  * User Correct: Green Solid.
  * User Wrong: Red Solid (User selection) + Green Flat (Correct Answer).



#### `Choice` (`paper/choice.tsx`)

Vertical list layout for options, typically used in Reading/Listening comprehension.

* **Props:**
  * `localNo` (1-based local question number)
  * `options` (Array of option strings)
  * `groupId` (Section ID)
* **Logic:** Similar state handling to `MultipleChoice` but different visual presentation (List vs Grid).

#### `FillInTheBlank` (`paper/blank/index.tsx`)

Renders a text input.

* **Props:**
  * `displayNo` (Global question number for display)
  * `localNo` (1-based local question number for storage)
  * `groupId` (Section ID)
  * `blankCount` (Optional)
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
// displayNo is the global question number shown to users
// localNo is the 1-based index within the section (used for answer storage)
<MemoizedBlank displayNo={globalQuestionNumber} localNo={index + 1} groupId={data.id}>
  <PopoverContent>
    <MyCustomInput 
      sectionId={data.id} 
      localQuestionNo={index + 1} 
    />
  </PopoverContent>
</MemoizedBlank>
```

When using `replaceBlanks` or `extractBlanks` utilities, the callback now receives both display and local numbers:

```tsx
// The callback receives (displayNo, localNo, originalContent)
replaceBlanks(data.text, config.start ?? 1, (displayNo, localNo, originalContent) => {
  return <MultipleChoice 
    displayNo={displayNo} 
    localNo={localNo} 
    options={options} 
    groupId={data.id} 
  />
})
```

### 5.4 Utility Functions (`paper/generators/utils.ts`)

* `getQuestionStarts(quizData)`: Returns an array of start indices for each question group. Essential for continuous numbering across different question types.
* `getSectionKey(quizData, sectionId)`: Returns the answer key for a specific section as `Record<localNo, correctAnswerText>`.
* `getSectionBasedKey(quizData)`: Returns the complete answer key in section-based format: `{ sectionId: { localNo: correctAnswerText } }`.
* `checkAnswers(quizData, userAnswers)`: Checks section-based user answers against correct answers, returning `{ sectionId: { localNo: boolean } }`.
* `computeTotalScore(quizData, userAnswers)`: Computes total score from section-based answers.
* `matchColor(pattern, key)`: Helper to determine UI colors based on answer comparison. Works with option text strings.
