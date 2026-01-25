## Leximory

![](./screenshot.png)

### Introduction

> *Leximory* is a language learning platform designed to enhance foreign language proficiency by means of **extensive input**. 

Leximory integrates features including:

- One-click **foreign publication importing**,
- AI-driven targeted **annotations with etymologies**, 
- **Combination of listening** with reading, 
- **Easy reviewing** of saved words,
- Saving through our **iOS Shortcuts Integration**,
- Sharing study resources in the **Library Market**,
- Talking to your library, i.e. **agentic workflows**.

There is also a feature built for exam setters: `Fix. Your. Paper.`.

The platform is built with Next.js, Supabase, Upstash, and Inngest. AI providers are Google Vertex and ElevenLabs.

### Project Structure

```mermaid
graph TD
    subgraph "Frontend (Next.js)"
        direction LR
        subgraph "UI Components (components/)"
            AuthUI["Auth Forms"]
            EditoryUI["Editory (Interactive Exercises)"]
            MarkdownUI["Markdown Renderer"]
            TimesUI["The Times Reader"]
        end
        subgraph "App Structure (app/)"
            Layout["Root Layout"]
            Pages["Routes & Pages"]
            Providers["Providers (Theme, Jotai)"]
        end
        subgraph "Shared Logic (lib/)"
            Config["Config & Env"]
            Utils["Utilities & Hooks"]
            Prompts["AI Prompts"]
            CreemSDK["Creem SDK"]
        end
    end

    subgraph "Backend (Serverless)"
        direction LR
        subgraph "app/api/ or actions.ts"
            ApiRoutes["API Routes/Server Actions"]
        end
        subgraph "Server-side Logic (server/)"
            AI["AI Module (annotate)"]
            Auth["Auth Module (role, quota)"]
            DB["Data Access (db/)"]
        end
    end

    subgraph "Infrastructure & Services"
        direction TB
        Supabase["Supabase (Postgres & Auth)"]
        Redis["Redis (Cache)"]
        Inngest["Inngest (Background Jobs)"]
        Creem["Creem Billing"]
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

### Deploy Your Own

To deploy your own instance of Leximory, follow these steps:

#### 1. Prerequisites

Ensure you have [pnpm](https://pnpm.io/installation) installed.

#### 2. Clone the Repository

```bash
git clone https://github.com/narixhine/leximory.git
cd leximory
```

#### 3. Install Dependencies

Install the project dependencies using `pnpm`:

```bash
pnpm install
```

#### 4. Set Up Supabase

1.  Create a new project on [Supabase](https://supabase.com/).
2.  Navigate to the **SQL Editor** in your Supabase project dashboard.
3.  Copy the script below and paste it into the SQL Editor.
4.  Click **Run** to execute the script and create the necessary database tables.

```sql
CREATE TABLE "users" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "updated_at" timestamp with time zone,
    "creem_id" text,
    "plan" text DEFAULT 'beginner'::text NOT NULL,
    "lexicoin" integer DEFAULT 20 NOT NULL,
    "last_daily_claim" timestamp with time zone,
    "accent" text DEFAULT 'BrE'::text NOT NULL,
    "token" text,
    "archived_libs" text[],
    "created_at" timestamp with time zone
);

CREATE TABLE "libraries" (
    "id" text PRIMARY KEY NOT NULL,
    "updated_at" timestamp with time zone,
    "name" text NOT NULL,
    "lang" text NOT NULL,
    "owner" uuid NOT NULL,
    "access" smallint DEFAULT 0 NOT NULL,
    "shadow" boolean DEFAULT false NOT NULL,
    "starred_by" uuid[],
    "org" text,
    "price" integer DEFAULT 0 NOT NULL,
    "prompt" text,
    "created_at" timestamp with time zone,
    CONSTRAINT "libraries_owner_fkey" FOREIGN KEY ("owner") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE "lexicon" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "updated_at" timestamp with time zone,
    "word" text NOT NULL,
    "lib" text,
    "created_at" timestamp with time zone,
    CONSTRAINT "lexicon_lib_fkey" FOREIGN KEY ("lib") REFERENCES "libraries" ("id") ON DELETE CASCADE
);

CREATE TABLE "texts" (
    "id" text PRIMARY KEY NOT NULL,
    "updated_at" timestamp with time zone,
    "title" text NOT NULL,
    "content" text NOT NULL,
    "lib" text,
    "has_ebook" boolean DEFAULT false NOT NULL,
    "topics" text[],
    "no" integer,
    "created_at" timestamp with time zone,
    CONSTRAINT "texts_lib_fkey" FOREIGN KEY ("lib") REFERENCES "libraries" ("id") ON DELETE CASCADE
);

CREATE TABLE "subs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "updated_at" timestamp with time zone,
    "uid" uuid,
    "subscription" jsonb NOT NULL,
    "hour" smallint NOT NULL,
    "created_at" timestamp with time zone,
    CONSTRAINT "subs_uid_fkey" FOREIGN KEY ("uid") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE "memories" (
    "id" serial PRIMARY KEY,
    "created_at" timestamp with time zone NOT NULL,
    "creator" uuid NOT NULL,
    "content" text NOT NULL,
    "public" boolean NOT NULL,
    "streak" boolean NOT NULL,
    CONSTRAINT "memories_creator_fkey" FOREIGN KEY ("creator") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE "reads" (
    "id" serial PRIMARY KEY,
    "created_at" timestamp with time zone NOT NULL,
    "uid" uuid NOT NULL,
    "text" text NOT NULL,
    CONSTRAINT "reads_text_fkey" FOREIGN KEY ("text") REFERENCES "texts" ("id") ON DELETE CASCADE,
    CONSTRAINT "reads_uid_fkey" FOREIGN KEY ("uid") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lexicon ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.texts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reads ENABLE ROW LEVEL SECURITY;
```

#### 5. Set Up Environment Variables

Create a `.env.local` file in the root of the project by copying the example file:

```bash
cp .env.example .env.local
```

You will need to populate this file with credentials. For more information, reference [`env.ts`](./lib/env.ts).

#### 6. Run the Development Server

To start the development server, which also runs the Inngest development server concurrently:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the result.
