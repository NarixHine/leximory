## Leximory

![](./screenshot.png)

### Introduction

> *Leximory* is a language learning platform designed to enhance foreign language proficiency, vocabulary in particular, by means of **intensive input**. 

Leximory integrates features like:

- One-click **foreign publication importing**,
- **Annotated novels and news** updated every day,
- AI-driven targeted **annotations with etymologies**, 
- **Combination of listening** with reading, 
- **Easy reviewing** of saved words,
- Saving through our **iOS Shortcuts Integration**,
- Sharing study resources in the **Library Market**,
- Talking to your library, i.e. **agentic workflows**.

There is also a feature built for exam setters: `Fix. Your. Paper.`.

The platform is built with Next.js, Supabase, Upstash, and Inngest. AI providers are Google and ElevenLabs.

### Project Structure

```mermaid
graph TD
    subgraph "Frontend (Next.js)"
        direction LR
        subgraph "UI Components (`components/`)"
            AuthUI["Auth Forms"]
            EditoryUI["Editory (Interactive Exercises)"]
            MarkdownUI["Markdown Renderer"]
            TimesUI["The Times Reader"]
        end
        subgraph "App Structure (`app/`)"
            Layout["Root Layout"]
            Pages["Routes & Pages"]
            Providers["Providers (Theme, Jotai)"]
        end
        subgraph "Shared Logic (`lib/`)"
            Config["Config & Env"]
            Utils["Utilities & Hooks"]
            Prompts["AI Prompts"]
            CreemSDK["Creem SDK"]
        end
    end

    subgraph "Backend (Serverless)"
        direction LR
        subgraph "API Endpoints (`app/api/`)"
            ApiRoutes["API Routes"]
        end
        subgraph "Core Logic (`server/`)"
            AI["AI Module (`annotate`, `editory`)"]
            Auth["Auth Module (`role`, `quota`)"]
            DB["Data Access (`db/`)"]
        end
    end

    subgraph "Infrastructure & Services"
        direction TB
        Supabase["Supabase (Postgres & Auth)"]
        Redis["Redis (Cache)"]
        Inngest["Inngest (Background Jobs)"]
        Creem["Creem Service"]
    end

    Pages -- "Uses" --> AuthUI
    Pages -- "Uses" --> EditoryUI
    Pages -- "Uses" --> MarkdownUI
    Pages -- "Uses" --> TimesUI

    Pages -- "Fetches data from" --> ApiRoutes
    ApiRoutes -- "Uses" --> AI
    ApiRoutes -- "Uses" --> Auth
    ApiRoutes -- "Uses" --> DB

    DB -- "Connects to" --> Supabase
    DB -- "Connects to" --> Redis
    AI -- "Triggers" --> Inngest
    ApiRoutes -- "Calls" --> CreemSDK
    CreemSDK -- "Communicates with" --> Creem

    Inngest -- "Processes jobs using" --> AI
    Inngest -- "Processes jobs using" --> DB
```

### Environment Variables

Please refer to [`env.ts`](./lib/env.ts).
