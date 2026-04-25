---
name: authorization-framework
description: Kilpi is an open-source TypeScript authorization library designed for developers who need flexible, powerful, and intuitive authorization in full-stack applications. Kilpi provides a comprehensive solution for implementing fine-grained access control using both Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC) patterns.
---

## Introduction

The framework is organized as a monorepo containing four primary packages: `@kilpi/core` for server-side authorization logic, `@kilpi/client` for client-side authorization checks with intelligent batching and caching, `@kilpi/react-server` for React Server Components integration, and `@kilpi/react-client` for React hooks and components. Kilpi's architecture emphasizes type safety, developer experience through fluent APIs, and production-ready features including audit logging, protected queries, and extensibility through a robust plugin system.

## Core APIs and Functions

### createKilpi() - Initialize Authorization System

Factory function that creates the core Kilpi instance with policies, subject resolution, and plugins. This is the primary entry point for server-side authorization.

```typescript
import { createKilpi, Grant, Deny, EndpointPlugin } from "@kilpi/core";
import { ReactServerPlugin } from "@kilpi/react-server";

// Define article type
type Article = {
  id: string;
  userId: string;
  title: string;
  isPublished: boolean;
};

// Create Kilpi instance
const Kilpi = createKilpi({
  // Connect to authentication provider
  async getSubject() {
    const session = await auth.getSession();
    if (!session) return null;
    return session.user;
  },

  // Define authorization policies
  policies: {
    // Simple policy without object
    async authed(subject) {
      if (!subject) return Deny({ message: "Not authenticated" });
      return Grant(subject);
    },

    // Nested policies with resource objects
    articles: {
      read(subject, article: Article) {
        // Public articles readable by anyone
        if (article.isPublished) return Grant(subject);

        // Unpublished articles only by author
        if (!subject) return Deny({ message: "Not authenticated" });
        if (subject.id === article.userId) return Grant(subject);

        return Deny({ message: "Not authorized to read this article" });
      },

      create(subject) {
        if (!subject) return Deny({ message: "Must be signed in" });
        return Grant(subject);
      },

      update(subject, article: Article) {
        if (!subject) return Deny({ message: "Not authenticated" });
        if (subject.id === article.userId) return Grant(subject);
        return Deny({ message: "Not the article owner" });
      },

      delete(subject, article: Article) {
        if (!subject) return Deny({ message: "Not authenticated" });
        // Admins or owners can delete
        if (subject.role === "admin" || subject.id === article.userId) {
          return Grant(subject);
        }
        return Deny({ message: "Not authorized" });
      }
    }
  },

  // Global error handler for unauthorized assertions
  onUnauthorizedAssert(decision) {
    throw new Error(`Unauthorized: ${decision.message}`);
  },

  // Enable plugins
  plugins: [
    EndpointPlugin({ secret: "my-secret-key" }),
    ReactServerPlugin()
  ]
});

export { Kilpi };
```

### Policy Authorization - Check Access Permissions

Evaluate authorization using the fluent API to check if a subject has permission to perform an action.

```typescript
import { Kilpi } from "./kilpi.server";

// Example article object
const article = {
  id: "123",
  userId: "user-456",
  title: "My Article",
  isPublished: false
};

// Check authorization and get decision
const decision = await Kilpi.articles.read(article).authorize();

if (decision.granted) {
  console.log("Access granted", decision.subject);
  // User has access, proceed with operation
} else {
  console.log("Access denied", decision.message);
  // User doesn't have access
}

// Use assert() to throw on unauthorized
try {
  const { subject } = await Kilpi.articles.update(article).authorize().assert();
  // Subject is guaranteed to be authorized here
  console.log("Authorized user:", subject.id);
} catch (error) {
  // KilpiError.Unauthorized thrown
  console.error("Unauthorized:", error.message);
}

// Policy without object parameter
const authCheck = await Kilpi.authed().authorize();
if (authCheck.granted) {
  console.log("User is authenticated");
}
```

### $query() - Protected Database Queries

Wrap data fetching functions with automatic authorization checks to ensure users only access data they're permitted to see.

```typescript
import { Kilpi } from "./kilpi.server";
import { db } from "./database";

// Define protected query for listing articles
const listArticles = Kilpi.$query(
  // Query function
  async (query: { userId?: string; isAdmin?: boolean }) => {
    const sql = `
      SELECT articles.*, user.name as authorName
      FROM articles
      INNER JOIN user ON articles.userId = user.id
      WHERE articles.isPublished = 1
         OR articles.userId = $userId
         OR ${query.isAdmin ? "1=1" : "0=1"}
    `;

    const articles = await db.query(sql).all({
      $userId: query.userId || null
    });

    return articles;
  },
  // Authorization configuration
  {
    async authorize({ output: articles, subject }) {
      // Verify access to each article (throws on unauthorized)
      for (const article of articles) {
        await Kilpi.articles.read(article).authorize().assert();
      }
      return articles;
    }
  }
);

// Protected query for single article
const getArticleById = Kilpi.$query(
  async (id: string) => {
    const article = await db.query(
      "SELECT * FROM articles WHERE id = $id"
    ).get({ $id: id });

    return article;
  },
  {
    async authorize({ output: article }) {
      if (article) {
        await Kilpi.articles.read(article).authorize().assert();
      }
      return article;
    }
  }
);

// Usage - automatically authorized
async function getArticlesForCurrentUser() {
  const subject = await Kilpi.$getSubject();

  // The .authorized() method applies authorization
  const articles = await listArticles.authorized({
    userId: subject?.id,
    isAdmin: subject?.role === "admin"
  });

  return articles; // Only authorized articles returned
}

// Single article with authorization
async function getArticle(id: string) {
  try {
    const article = await getArticleById.authorized(id);
    return article;
  } catch (error) {
    // Redirected or error thrown if unauthorized
    console.error("Access denied");
    return null;
  }
}
```

### Authorize Component - Server-Side Conditional Rendering

React Server Component for conditional rendering based on authorization checks with built-in loading and error states.

```typescript
// kilpi.server.ts
import { createKilpi } from "@kilpi/core";
import { ReactServerPlugin } from "@kilpi/react-server";

const Kilpi = createKilpi({
  // ... configuration
  plugins: [ReactServerPlugin()]
});

export const { Authorize } = Kilpi.$createReactServerComponents();
```

```tsx
// ArticlePage.tsx - React Server Component
import { Authorize, Kilpi } from "@/kilpi.server";
import { ArticleService } from "@/article-service";

export default async function ArticlePage({
  params
}: {
  params: { articleId: string }
}) {
  // Fetch article with authorization
  const article = await ArticleService.getArticleById.authorized(
    params.articleId
  );

  if (!article) {
    return <div>Article not found</div>;
  }

  return (
    <div>
      <h1>{article.title}</h1>
      <p>{article.content}</p>

      {/* Conditionally render update form based on authorization */}
      <Authorize
        policy={Kilpi.articles.update(article)}
        Pending={<div>Checking permissions...</div>}
        Unauthorized={(decision) => (
          <div>Cannot edit: {decision?.message}</div>
        )}
      >
        <UpdateArticleForm article={article} />
      </Authorize>

      {/* Delete button with authorization */}
      <Authorize
        policy={Kilpi.articles.delete(article)}
        Pending={<button disabled>Loading...</button>}
        Unauthorized={(decision) => (
          <button disabled>Cannot delete: {decision?.message}</button>
        )}
      >
        <form action={deleteArticleAction}>
          <input type="hidden" name="id" value={article.id} />
          <button type="submit">Delete Article</button>
        </form>
      </Authorize>
    </div>
  );
}
```

### Hooks System - Authorization Lifecycle Events

Hook into authorization events for logging, caching, and custom error handling throughout the authorization lifecycle.

```typescript
import { Kilpi } from "./kilpi.server";

// Log all authorization decisions
Kilpi.$hooks.onAfterAuthorization((event) => {
  console.log({
    action: event.action,           // e.g., "articles.read"
    granted: event.decision.granted,
    subject: event.subject,
    object: event.object,
    timestamp: new Date()
  });
});

// Subject caching - read from custom cache
Kilpi.$hooks.onSubjectRequestFromCache(({ context }) => {
  // Return cached subject or null to fetch fresh
  const cached = myCache.get("current-subject");
  return cached || null;
});

// Subject caching - write to custom cache
Kilpi.$hooks.onSubjectResolved(({ subject, fromCache, context }) => {
  if (!fromCache && subject) {
    // Store in cache for future requests
    myCache.set("current-subject", subject, { ttl: 300 });
  }
});

// Custom error handling per authorization failure
Kilpi.$hooks.onUnauthorizedAssert(({ decision, action, subject, object }) => {
  // Log security events
  securityLogger.warn({
    event: "unauthorized_access",
    user: subject?.id,
    action,
    reason: decision.message,
    metadata: decision.metadata
  });

  // Custom redirect or error response
  if (action.startsWith("admin.")) {
    throw new Error("Admin access required");
  }
});
```

### AuditPlugin - Authorization Audit Logging

Plugin for comprehensive audit logging of authorization events with configurable strategies and filtering.

```typescript
import { createKilpi, AuditPlugin } from "@kilpi/core";

const Kilpi = createKilpi({
  // ... other config
  plugins: [
    AuditPlugin({
      // Strategy: immediate, periodic, batch, or manual
      strategy: "immediate",

      // Handle audit events (save to database, send to logging service, etc.)
      onAuditEvent: async (event) => {
        await db.auditLogs.insert({
          timestamp: event.timestamp,
          action: event.action,
          subjectId: event.subject?.id,
          objectId: event.object?.id,
          granted: event.decision.granted,
          reason: event.decision.message,
          metadata: event.decision.metadata
        });

        // Also send to external logging service
        await logService.track("authorization", {
          user: event.subject?.id,
          action: event.action,
          result: event.decision.granted ? "granted" : "denied"
        });
      },

      // Filter which events to log
      shouldIncludeEvent: (event) => {
        // Log only denied access attempts and admin actions
        if (!event.decision.granted) return true;
        if (event.action.startsWith("admin.")) return true;
        return false;
      },

      // Can be toggled at runtime
      disabled: process.env.DISABLE_AUDIT === "true"
    })
  ]
});

// Manual flush for batch strategy
await Kilpi.$audit.flush();

// Dynamic control
Kilpi.$audit.enable();
Kilpi.$audit.disable();

// Example audit event structure
/*
{
  timestamp: Date,
  action: "articles.delete",
  subject: { id: "user-123", role: "user" },
  object: { id: "article-456", userId: "user-789" },
  decision: {
    granted: false,
    message: "Not the article owner",
    reason: "forbidden"
  },
  context: {}
}
*/
```

### EndpointPlugin - Client-Server Communication

Plugin that creates an HTTP endpoint for client-side authorization checks with automatic batching and authentication.

```typescript
import { createKilpi, EndpointPlugin } from "@kilpi/core";

const Kilpi = createKilpi({
  // ... other config
  plugins: [
    EndpointPlugin({
      // Shared secret for authentication
      secret: process.env.KILPI_SECRET!,

      // Optional: Extract custom context from request
      getContext: (req: Request) => {
        const ip = req.headers.get("x-forwarded-for");
        return { ip };
      },

      // Optional: Pre-request validation
      onBeforeHandleRequest: (req: Request) => {
        const origin = req.headers.get("origin");
        if (!allowedOrigins.includes(origin)) {
          throw new Error("Invalid origin");
        }
      },

      // Optional: Per-item processing
      onBeforeProcessItem: (request) => {
        console.log("Processing:", request.action);
      }
    })
  ]
});

// Create POST endpoint in Next.js App Router
export const POST = Kilpi.$createPostEndpoint();

// Create POST endpoint in Next.js Pages Router
export default async function handler(req, res) {
  if (req.method === "POST") {
    return await Kilpi.$createPostEndpoint()(req);
  }
  res.status(405).json({ error: "Method not allowed" });
}

// Endpoint protocol (handled automatically by client)
/*
Request:
POST /api/kilpi
Authorization: Bearer <secret>
Content-Type: application/json

Body (SuperJSON):
[
  {
    type: "fetchDecision",
    requestId: "unique-id-1",
    action: "articles.read",
    object: { id: "123", userId: "456", isPublished: false }
  },
  {
    type: "fetchDecision",
    requestId: "unique-id-2",
    action: "articles.delete",
    object: { id: "123", userId: "456", isPublished: false }
  }
]

Response:
[
  {
    requestId: "unique-id-1",
    decision: {
      granted: true,
      subject: { id: "456", role: "user" }
    }
  },
  {
    requestId: "unique-id-2",
    decision: {
      granted: false,
      message: "Not authorized"
    }
  }
]
*/
```

### createKilpiClient() - Client-Side Authorization

Initialize client SDK for making authorization checks from the browser with intelligent batching and caching.

```typescript
import { createKilpiClient } from "@kilpi/client";
import { ReactClientPlugin } from "@kilpi/react-client";
import type { Kilpi } from "./kilpi.server";

// Create client instance
const KilpiClient = createKilpiClient({
  // Type inference from server Kilpi for full type safety
  infer: {} as typeof Kilpi,

  // Connection configuration
  connect: {
    secret: process.env.NEXT_PUBLIC_KILPI_SECRET!,
    endpointUrl: process.env.NEXT_PUBLIC_KILPI_URL!
  },

  // Batching configuration
  batching: {
    batchDelayMs: 10,     // Wait 10ms to batch requests together
    jobTimeoutMs: 5000    // 5 second timeout per request
  },

  // Enable React hooks and components
  plugins: [ReactClientPlugin()]
});

export const { AuthorizeClient } = KilpiClient.$createReactClientComponents();

// Example usage - check authorization from client
async function checkArticleAccess(article) {
  const decision = await KilpiClient.articles.read(article).authorize();

  if (decision.granted) {
    console.log("User can read article");
    return true;
  } else {
    console.log("Access denied:", decision.message);
    return false;
  }
}

// Cache management - invalidate specific policy
function onArticleUpdated(article) {
  KilpiClient.articles.read(article).$invalidate();
  KilpiClient.articles.update(article).$invalidate();
  KilpiClient.articles.delete(article).$invalidate();
}

// Cache management - invalidate entire namespace
function onArticleDeleted() {
  KilpiClient.articles.$invalidate();
}

// Multiple parallel requests are automatically batched
async function checkMultiplePermissions(articles) {
  const checks = await Promise.all(
    articles.map(article =>
      KilpiClient.articles.read(article).authorize()
    )
  );
  return checks;
}
```

### useAuthorize() Hook - React Authorization State

React hook for checking authorization in client components with loading, error, and success states.

```tsx
import { KilpiClient } from "@/kilpi.client";
import type { Article } from "@/types";

function ArticleActions({ article }: { article: Article }) {
  // Use authorization hook
  const deleteAuth = KilpiClient.articles.delete(article).useAuthorize({
    isDisabled: false,  // Can be disabled conditionally
  });

  // Handle different states
  if (deleteAuth.isIdle) {
    return null; // Not checked yet
  }

  if (deleteAuth.isPending) {
    return <div>Checking permissions...</div>;
  }

  if (deleteAuth.isError) {
    return <div>Error: {deleteAuth.error?.message}</div>;
  }

  // Type-safe access to decision
  if (deleteAuth.granted) {
    return (
      <button
        onClick={() => deleteArticle(article.id)}
        className="btn-danger"
      >
        Delete Article
      </button>
    );
  } else {
    return (
      <button disabled className="btn-disabled">
        Cannot delete: {deleteAuth.decision.message}
      </button>
    );
  }
}

// Example with multiple authorization checks
function ArticleCard({ article }: { article: Article }) {
  const canUpdate = KilpiClient.articles.update(article).useAuthorize();
  const canDelete = KilpiClient.articles.delete(article).useAuthorize();

  return (
    <div className="article-card">
      <h2>{article.title}</h2>
      <p>{article.content}</p>

      <div className="actions">
        {canUpdate.granted && (
          <button onClick={() => editArticle(article)}>Edit</button>
        )}

        {canDelete.granted && (
          <button onClick={() => deleteArticle(article)}>Delete</button>
        )}

        {(!canUpdate.granted && !canDelete.granted) && (
          <p>Read-only access</p>
        )}
      </div>
    </div>
  );
}
```

### AuthorizeClient Component - Client-Side Conditional Rendering

Client component for conditional rendering based on authorization with render props and loading states.

```tsx
import { AuthorizeClient, KilpiClient } from "@/kilpi.client";
import type { Article } from "@/types";

function ArticleManagement({ article }: { article: Article }) {
  return (
    <div className="article-management">
      {/* Render update button only if authorized */}
      <AuthorizeClient
        policy={KilpiClient.articles.update(article)}
        Pending={
          <button disabled>Checking permissions...</button>
        }
        Unauthorized={(decision) => (
          <button disabled title={decision?.message}>
            Update (No Access)
          </button>
        )}
      >
        <UpdateButton article={article} />
      </AuthorizeClient>

      {/* Delete button with authorization */}
      <AuthorizeClient
        policy={KilpiClient.articles.delete(article)}
        Pending={
          <button disabled>Loading...</button>
        }
        Unauthorized={(decision) => (
          <div className="error">
            Cannot delete: {decision?.message}
          </div>
        )}
      >
        <form onSubmit={handleDelete}>
          <button type="submit" className="btn-danger">
            Delete Article
          </button>
        </form>
      </AuthorizeClient>

      {/* Using render function for more complex logic */}
      <AuthorizeClient
        policy={KilpiClient.articles.update(article)}
        Pending={() => <Spinner />}
        Unauthorized={() => null}
      >
        {({ decision }) => (
          <div>
            <p>Authorized as: {decision.subject.name}</p>
            <AdminPanel article={article} />
          </div>
        )}
      </AuthorizeClient>
    </div>
  );
}

// Example: Combining with other client state
function EditableArticle({ article }: { article: Article }) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div>
      {isEditing ? (
        <ArticleEditor article={article} onCancel={() => setIsEditing(false)} />
      ) : (
        <ArticleView article={article} />
      )}

      <AuthorizeClient
        policy={KilpiClient.articles.update(article)}
        Unauthorized={() => null}
      >
        <button onClick={() => setIsEditing(!isEditing)}>
          {isEditing ? "Cancel" : "Edit"}
        </button>
      </AuthorizeClient>
    </div>
  );
}
```

### Custom Plugin Development - Extend Functionality

Create custom plugins to extend Kilpi's core and client functionality with type-safe APIs.

```typescript
import { createKilpiPlugin, type AnyKilpiCore } from "@kilpi/core";
import { createKilpiClientPlugin, type KilpiClient } from "@kilpi/client";

// Server-side plugin example
function RateLimitPlugin(options: { maxRequests: number; windowMs: number }) {
  const requestCounts = new Map<string, { count: number; reset: number }>();

  return createKilpiPlugin((Kilpi: AnyKilpiCore) => {
    // Hook into authorization lifecycle
    Kilpi.$hooks.onAfterAuthorization((event) => {
      const subjectId = event.subject?.id || "anonymous";
      const now = Date.now();

      const record = requestCounts.get(subjectId);

      if (!record || now > record.reset) {
        requestCounts.set(subjectId, {
          count: 1,
          reset: now + options.windowMs
        });
      } else {
        record.count++;

        if (record.count > options.maxRequests) {
          throw new Error("Rate limit exceeded");
        }
      }
    });

    return {
      // Extend core instance with custom methods
      extendCore() {
        return {
          $getRateLimitStatus(subjectId: string) {
            return requestCounts.get(subjectId);
          },
          $resetRateLimit(subjectId: string) {
            requestCounts.delete(subjectId);
          }
        };
      }
    };
  });
}

// Client-side plugin example
function ClientMetricsPlugin() {
  const metrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  return createKilpiClientPlugin((Client: KilpiClient) => {
    return {
      // Extend client instance
      extendClient() {
        return {
          $getMetrics() {
            return { ...metrics };
          },
          $resetMetrics() {
            metrics.totalRequests = 0;
            metrics.cacheHits = 0;
            metrics.cacheMisses = 0;
          }
        };
      },

      // Extend each policy proxy
      extendPolicy(policy) {
        const originalAuthorize = policy.authorize;

        return {
          // Override authorize to track metrics
          async authorize() {
            metrics.totalRequests++;
            const result = await originalAuthorize.call(policy);
            return result;
          }
        };
      }
    };
  });
}

// Usage
const Kilpi = createKilpi({
  // ... config
  plugins: [
    RateLimitPlugin({ maxRequests: 100, windowMs: 60000 })
  ]
});

// Access custom methods
const status = Kilpi.$getRateLimitStatus("user-123");
Kilpi.$resetRateLimit("user-123");

const KilpiClient = createKilpiClient({
  // ... config
  plugins: [ClientMetricsPlugin()]
});

// Access custom methods
const metrics = KilpiClient.$getMetrics();
console.log("Cache hit rate:", metrics.cacheHits / metrics.totalRequests);
```

## Summary and Integration

Kilpi provides a comprehensive solution for implementing authorization in TypeScript applications with support for both server-side and client-side authorization checks. The framework excels in full-stack scenarios where you need to enforce authorization at multiple layers: protecting API endpoints and database queries on the server while also providing responsive UI that reflects user permissions. Common use cases include multi-tenant SaaS applications where different users have varying access levels to resources, content management systems with complex permission hierarchies, and collaborative platforms where access control is based on both roles and resource ownership.

The integration pattern follows a clear separation between server and client implementations. On the server, you define your authorization policies in `createKilpi()` with the `getSubject()` function connecting to your authentication provider. These policies evaluate permissions based on the subject (authenticated user) and optionally a resource object. The server exposes an HTTP endpoint via `EndpointPlugin` which the client SDK communicates with. On the client side, `createKilpiClient()` provides the same policy interface but makes requests to the server endpoint, intelligently batching multiple checks together and caching results. React integrations provide both server components (`<Authorize />`) and client hooks (`useAuthorize()`) for conditional rendering, creating a seamless authorization experience across the full stack. The plugin architecture allows extending both core and client functionality for custom requirements like audit logging, rate limiting, or specialized caching strategies.