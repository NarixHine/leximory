# Leximory

## Introduction

> *Leximory* is a language learning platform designed to enhance foreign language proficiency, vocabulary in particular, by means of **intensive input**. 

Leximory integrates features like:

- One-click **foreign publication importing**,
- AI-driven targeted **annotations with etymologies**, 
- **Combination of listening** with reading, 
- **Easy reviewing** of saved words,
- Saving through our **iOS Shortcuts Integration**,
- Sharing study resources using **Study Groups** or in the **Library Market**.

The platform is built with Next.js, Xata, Clerk, Upstash, Vercel AI SDK and Inngest.

## Running the Project

### Environment Variables

Create a `.env.local` file in the project root and fill it with the following variables:

```shell
# Clerk authentication keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your_clerk_publishable_key>
CLERK_SECRET_KEY=<your_clerk_secret_key>
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Xata database configuration
XATA_BRANCH=main
XATA_API_KEY=<your_xata_api_key>

# Upstash Redis configuration
UPSTASH_REDIS_REST_URL=<your_upstash_redis_url>
UPSTASH_REDIS_REST_TOKEN=<your_upstash_redis_token>

# API keys for AI services
OPENAI_API_KEY=<your_openai_api_key>
DEEPSEEK_API_KEY=<your_deepseek_api_key>
ELEVENLABS_API_KEY=<your_elevenlabs_api_key>

# VAPID keys for web push notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your_vapid_public_key>
VAPID_PRIVATE_KEY=<your_vapid_private_key>

# Inngest keys
INNGEST_SIGNING_KEY=<your_inggest_signing_key>
INNGEST_EVENT_KEY=<your_inggest_event_key>

NEXT_PUBLIC_URL=https://leximory.com
```

- **Clerk**: Provides authentication services. Obtain keys from [Clerk](https://clerk.dev/).
- **Xata**: Hosts the project database. Create a project at [Xata](https://xata.io/) to get an API key.
- **Upstash**: Offers Redis services for rate limiting. Set up at [Upstash](https://upstash.com/) to receive REST URL and token.
- **OpenAI**: Provides AI annotation. Register at [OpenAI](https://openai.com/) for API access.
- **ElevenLabs**: Enables AI-powered voice synthesis. Get your API key from [ElevenLabs](https://elevenlabs.io/).
- **VAPID**: Used for sending web push notifications. Generate VAPID keys using web-push libraries or online tools.

### Initialise Database

You need to initialise the Xata database first. 

Generate the schema for Leximory by running the following command:

```bash
xata schema upload schema.json
```

You can find more specific documentation [on their website](https://xata.io/docs/getting-started/cli#schema).

### Starting Development Server

After installing dependencies, run:

```bash
npm run dev
```

Access the application at `http://localhost:3000`.
