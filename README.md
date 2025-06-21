# Leximory

![](./screenshot.png)

## Introduction

> *Leximory* is a language learning platform designed to enhance foreign language proficiency, vocabulary in particular, by means of **intensive input**. 

Leximory integrates features like:

- One-click **foreign publication importing**,
- AI-driven targeted **annotations with etymologies**, 
- **Combination of listening** with reading, 
- **Easy reviewing** of saved words,
- Saving through our **iOS Shortcuts Integration**,
- Sharing study resources using **Study Groups** or in the **Library Market**,
- Talking to your library, i.e. **agentic workflows**.

There is also a feature built for exam setters: `Fix. Your. Paper.`.

The platform is built with Next.js, Supabase, Upstash, and Inngest. AI providers are Google and ElevenLabs.

## Environment Variables

Create a `.env` file in the project root and fill it with the following variables:

```shell
# Supabase configuration
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Upstash Redis configuration
UPSTASH_REDIS_REST_URL=<your_upstash_redis_url>
UPSTASH_REDIS_REST_TOKEN=<your_upstash_redis_token>

# API keys for AI services
GOOGLE_GENERATIVE_AI_API_KEY=<your_google_api_key>
ELEVENLABS_API_KEY=<your_elevenlabs_api_key>

# Web push keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your_vapid_public_key>
VAPID_PRIVATE_KEY=<your_vapid_private_key>

# Inngest keys
INNGEST_SIGNING_KEY=<your_inggest_signing_key>
INNGEST_EVENT_KEY=<your_inggest_event_key>

NEXT_PUBLIC_URL=https://leximory.com
```
