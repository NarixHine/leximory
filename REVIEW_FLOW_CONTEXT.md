# Review Flow Implementation Context

## Overview
An immersive, inline review experience for vocabulary learning that transforms the timeline view into an interactive lawn with animated cat character, AI-generated stories, and translation exercises.

## Architecture

### Frontend Components

#### 1. Experiment Page (`/app/experiment/`)
- **page.tsx**: Server component fetching timeline data
- **client.tsx**: Client wrapper with fade transitions between Timeline and ReviewFlow
- **data.ts**: Data fetching logic for 15-day word history

#### 2. Timeline Component (`components/timeline.tsx`)
- Area chart showing word count trend (from `/daily` page)
- Vertical divider line as timeline affordance
- Rows with:
  - Right-aligned dates (e.g., "周日 16日")
  - Left-aligned word pills
  - 3-segment progress bar (4 states: 0, 1/3, 2/3, full)
  - Cursor icon (incomplete) or Check icon (complete)
- Skips days with no words
- Clicking progress bar triggers ReviewFlow (inline fade transition)

#### 3. Review Flow (`components/review-flow.tsx`)
- Inline component (no navigation)
- Fades in over timeline (0.2s simple fade)
- Features:
  - **Lawn component**: Background with animated cat
  - **Fruit system**: Emojis drop from above when AI finishes generating
  - **Progress indicator**: Shows generation stage (story/translations/complete)
  - **Exit button**: Returns to timeline

#### 4. Lawn Component (`components/lawn.tsx`)
- Sprite-based animated cat (1408x768 sprite sheet, 3x3 grid)
- Click-to-move navigation
- Velocity curve: accelerate → constant → decelerate
- Dust particles when running
- Footstep sounds
- Fruit collision detection (reaches fruit → triggers interaction)

#### 5. Fruit Component (`components/fruit.tsx`)
- Spring animation dropping from top
- Periodic wiggle to attract attention
- Positioned randomly on lawn (15-85% x, 20-80% y)
- Emojis: 📖 for story, 🍎🍊🍋🍇🍓🫐 for translations

#### 6. Story Drawer (`components/story-drawer.tsx`)
- Vaul drawer (bottom sheet)
- Renders story with Markdown component
- Shows generated story with `<must>` highlighted words

#### 7. Translation Popover (`components/translation-popover.tsx`)
- Smooth pop-up animation
- Shows Chinese sentence + keyword hint
- Textarea for user input
- Submit button with loading state
- Success state after submission

### Backend API

#### 1. Start Generation (`/api/experiment/review/start/route.ts`)
- POST endpoint
- Triggers async generation
- Stores progress in Redis
- Returns immediately

#### 2. Progress SSE (`/api/experiment/review/progress/route.ts`)
- Server-Sent Events endpoint
- Polls Redis every 500ms
- Streams progress updates to frontend
- Closes when generation complete

#### 3. Generation Steps

**generate-story.ts**:
- Uses `generateText` from 'ai' package (NOT generateSingleComment)
- Quota check: `incrCommentaryQuota(ACTION_QUOTA_COST.story, userId, true)`
- Fetches words for date range
- Prompt: Professional teacher persona, must use all words, short story, `<must>` tags
- Returns story text

**generate-translations.ts**:
- Uses `generateText` from 'ai' package
- Quota check: `incrCommentaryQuota(ACTION_QUOTA_COST.wordAnnotation, userId, true)`
- Selects 3-5 random words
- Prompt: Create translation exercises (Chinese → English)
- Returns JSON array: `{chinese, answer, keyword}`

### Real-time Progress System

#### Hook (`hooks/use-review-progress.ts`)
- Connects to SSE endpoint
- Manages `progress`, `story`, `translations` state
- Starts generation on mount

#### Progress States
- `init`: Initializing
- `story`: Generating story
- `translations`: Creating exercises
- `complete`: All done

### Database Schema

**flashbacks table**:
```sql
- user: string (FK to users)
- date: string
- lang: string
- story: string
- translations: JSON array
- created_at: timestamp
```

## Key Design Decisions

1. **Inline Transitions**: Simple fade (0.2s) instead of navigation
2. **No Gradient Background**: Plain white/default background for ReviewFlow
3. **SSE over WebSocket**: Simpler, works with Redis polling
4. **Cat-Fruit Interaction**: Cat walks to fruit, collision triggers content
5. **Quota Management**: All AI calls check quota with delayRevalidate
6. **Language-Specific**: Uses `lang` from day's words for generation

## File Structure
```
/app/experiment/
├── page.tsx                    # Server entry
├── client.tsx                  # Transition wrapper
├── data.ts                     # Data fetching
├── components/
│   ├── timeline.tsx            # Main timeline with progress bars
│   ├── review-flow.tsx         # Inline review experience
│   ├── lawn.tsx                # Animated cat lawn
│   ├── fruit.tsx               # Dropping fruit emojis
│   ├── story-drawer.tsx        # Vaul drawer for stories
│   └── translation-popover.tsx # Popover for exercises
├── hooks/
│   └── use-review-progress.ts  # SSE connection hook
/api/experiment/review/
├── start/route.ts              # POST: trigger generation
├── progress/route.ts           # GET: SSE progress stream
└── steps/
    ├── generate-story.ts       # Story generation
    └── generate-translations.ts # Translation exercises
/server/db/
└── flashback.ts                # Database operations
```

## Animations
- **Timeline → Review**: Fade out (0.2s) / Fade in (0.2s)
- **Fruit Drop**: Spring physics (stiffness: 200, damping: 15)
- **Fruit Wiggle**: Periodic 5° rotation
- **Cat Movement**: Custom velocity curve with acceleration/deceleration
- **Popover**: Scale + fade (spring: 300, 25)
- **Drawer**: Slide up from bottom (Vaul default)

## Quota Costs
- Story generation: `ACTION_QUOTA_COST.story`
- Translation exercises: `ACTION_QUOTA_COST.wordAnnotation`
- Both use `delayRevalidate: true`

## Dependencies
- Framer Motion (animations)
- Vaul (drawer)
- @upstash/redis (progress storage)
- ai (Vercel AI SDK for generation)
