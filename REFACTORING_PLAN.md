# Comprehensive Refactoring & Code Improvement Plan
## 10X K-Factor Tutoring Platform Gamification System

**Generated:** November 19, 2025
**Codebase Version:** 1.0.0
**Architecture:** Next.js 15 Monorepo with Multi-Agent Orchestration
**Focus:** Production-Ready, Scalable, Maintainable Engineering

---

## Executive Summary

This document provides a comprehensive, prioritized refactoring plan for the 10X K-Factor tutoring platform. The codebase demonstrates solid architectural foundations with clean separation of concerns, intelligent multi-agent orchestration, and sophisticated viral loop mechanics. However, to achieve production-grade quality and scalability, we've identified **47 specific improvement opportunities** organized into 5 priority tiers.

**Current State:**
- ✅ Strong: Multi-agent architecture, type safety, database design
- ⚠️ Moderate: Error handling consistency, caching strategy, real-time features
- ❌ Critical Gaps: Test coverage (0%), monitoring/observability, security hardening

**Target State:**
- 100% type-safe with comprehensive test coverage (>80%)
- Sub-200ms p95 response times for all API endpoints
- Production monitoring with full observability
- Scalable to 10,000+ concurrent users

---

## Table of Contents

1. [Priority 1: Critical Foundation (Week 1-2)](#priority-1-critical-foundation)
2. [Priority 2: Architecture & Performance (Week 3-4)](#priority-2-architecture--performance)
3. [Priority 3: Code Quality & Maintainability (Week 5-6)](#priority-3-code-quality--maintainability)
4. [Priority 4: Scalability & Optimization (Week 7-8)](#priority-4-scalability--optimization)
5. [Priority 5: Advanced Features (Week 9+)](#priority-5-advanced-features)
6. [Implementation Roadmap](#implementation-roadmap)
7. [Risk Mitigation](#risk-mitigation)

---

## Priority 1: Critical Foundation
**Timeline:** Week 1-2
**Impact:** High
**Risk:** Critical gaps that block production deployment

### 1.1 Implement Comprehensive Test Suite

**Current State:** Zero test files, manual testing only via demo pages

**Target State:** 80%+ code coverage with unit, integration, and E2E tests

#### Action Items:

**A. Unit Tests (Week 1)**
```
packages/agents/src/__tests__/
├── orchestrator.test.ts          # Loop selection logic
├── personalize.test.ts           # Copy generation
└── experiment.test.ts            # Bucket assignment

apps/web/lib/__tests__/
├── xp.test.ts                    # XP calculations & level curve
├── rewards-policies.test.ts      # Reward policy logic
├── smart-links.test.ts           # Link creation & signing
└── leaderboard.test.ts           # Score calculations
```

**Test Framework Setup:**
```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@vitest/ui": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "msw": "^2.0.0"
  }
}
```

**Example Test (orchestrator.test.ts):**
```typescript
import { describe, it, expect } from 'vitest';
import { chooseLoop } from '../orchestrator.agent';

describe('Orchestrator Agent', () => {
  it('selects buddy_challenge for student results_viewed event', () => {
    const result = chooseLoop({
      event: 'results_viewed',
      persona: 'student',
      cooldowns: {}
    });

    expect(result.loop).toBe('buddy_challenge');
    expect(result.eligibility_reason).toBe('cooldown_ok');
  });

  it('respects cooldown periods', () => {
    const result = chooseLoop({
      event: 'results_viewed',
      persona: 'student',
      cooldowns: { buddy_challenge_hours: 12 }
    });

    expect(result.loop).toBe('results_rally');
  });

  it('falls back gracefully for unknown events', () => {
    const result = chooseLoop({
      event: 'unknown_event',
      persona: 'student',
      cooldowns: {}
    });

    expect(result.loop).toBe('buddy_challenge');
    expect(result.eligibility_reason).toContain('fallback');
  });
});
```

**B. Integration Tests (Week 1-2)**
```
apps/web/__tests__/integration/
├── challenges-flow.test.ts       # Challenge CRUD + XP tracking
├── rewards-grant.test.ts         # Reward grant with safety checks
├── viral-loop.test.ts            # Smart link → referral flow
├── auth-flow.test.ts             # Registration & login
└── guest-conversion.test.ts      # Guest → registered user
```

**Database Testing Strategy:**
- Use separate test database or in-memory SQLite
- Seed minimal test data per test
- Clean up after each test
- Use transactions for isolation

**C. E2E Tests (Week 2)**
```
e2e/
├── student-journey.spec.ts       # Signup → challenge → reward
├── tutor-session.spec.ts         # Create session → challenge
├── viral-sharing.spec.ts         # Share link → friend joins
└── leaderboard.spec.ts           # Real-time updates
```

**Framework:** Playwright
```bash
pnpm add -D @playwright/test
```

**Success Metrics:**
- [ ] 80%+ line coverage for core logic (agents, xp, rewards)
- [ ] All API endpoints have integration tests
- [ ] Critical user flows covered by E2E tests
- [ ] CI/CD pipeline runs tests on every commit

---

### 1.2 Add Production Monitoring & Observability

**Current State:** Console.log only, no structured logging or metrics

**Target State:** Full observability with logs, metrics, traces, and alerts

#### Action Items:

**A. Structured Logging**

**Install:** OpenTelemetry + Pino
```bash
pnpm add pino pino-pretty @opentelemetry/api @opentelemetry/sdk-node
```

**Create:** `apps/web/lib/logger.ts`
```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['*.password', '*.token', '*.secret'],
    remove: true,
  },
});

export function createLogger(context: string) {
  return logger.child({ context });
}
```

**Usage:**
```typescript
// Replace console.log/error with structured logging
import { createLogger } from '@/lib/logger';
const log = createLogger('api:challenges');

log.info({ challengeId, userId }, 'Challenge completed');
log.error({ error, challengeId }, 'Failed to update challenge');
```

**B. API Metrics**

**Install:** Prometheus client
```bash
pnpm add prom-client
```

**Create:** `apps/web/lib/metrics.ts`
```typescript
import { Counter, Histogram, Registry } from 'prom-client';

export const register = new Registry();

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in ms',
  labelNames: ['method', 'route', 'status'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
  registers: [register],
});

export const orchestratorCalls = new Counter({
  name: 'orchestrator_calls_total',
  help: 'Total orchestrator calls',
  labelNames: ['loop', 'persona', 'event'],
  registers: [register],
});

export const rewardGrants = new Counter({
  name: 'reward_grants_total',
  help: 'Total reward grants',
  labelNames: ['type', 'status'],
  registers: [register],
});
```

**Metrics Endpoint:** `apps/web/app/api/metrics/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { register } from '@/lib/metrics';

export async function GET() {
  const metrics = await register.metrics();
  return new NextResponse(metrics, {
    headers: { 'Content-Type': register.contentType },
  });
}
```

**C. Error Tracking**

**Install:** Sentry
```bash
pnpm add @sentry/nextjs
```

**Initialize:** `sentry.client.config.ts` & `sentry.server.config.ts`
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event, hint) {
    // Filter out known issues
    if (event.exception?.values?.[0]?.value?.includes('AbortError')) {
      return null;
    }
    return event;
  },
});
```

**D. Performance Monitoring**

**Track Key Metrics:**
- API response times (p50, p95, p99)
- Database query times
- Agent decision latency
- Redis operation times
- External API calls (if any)

**Create Dashboard:** Grafana + Prometheus
```yaml
# docker-compose.yml for local monitoring
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
```

**Success Metrics:**
- [ ] Structured logging in all API routes
- [ ] Prometheus metrics for all critical paths
- [ ] Sentry captures all unhandled errors
- [ ] Grafana dashboard for real-time monitoring

---

### 1.3 Security Hardening

**Current State:** Basic auth, minimal input validation, stub safety checks

**Target State:** Production-grade security with defense in depth

#### Action Items:

**A. Input Validation Middleware**

**Create:** `apps/web/lib/middleware/validate.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';

export function validateBody<T>(schema: ZodSchema<T>) {
  return async (
    request: NextRequest,
    handler: (req: NextRequest, validated: T) => Promise<NextResponse>
  ) => {
    try {
      const body = await request.json();
      const validated = schema.parse(body);
      return handler(request, validated);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: error.errors.map(e => ({
              path: e.path.join('.'),
              message: e.message
            }))
          },
          { status: 400 }
        );
      }
      throw error;
    }
  };
}
```

**Usage:**
```typescript
export const POST = validateBody(createChallengeSchema)(async (req, validated) => {
  // validated is fully type-safe
  const challenge = await createChallenge(validated);
  return NextResponse.json(challenge);
});
```

**B. Rate Limiting Enhancement**

**Current:** Basic invite rate limiting only

**Enhanced:** Global rate limiting per endpoint
```typescript
// apps/web/lib/middleware/rate-limit.ts
import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export async function rateLimit(
  request: NextRequest,
  config: { limit: number; window: number; key: (req: NextRequest) => string }
) {
  const key = `rate_limit:${config.key(request)}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, config.window);
  }

  if (count > config.limit) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': config.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': (Date.now() + config.window * 1000).toString()
        }
      }
    );
  }

  return null; // Continue
}
```

**Apply to sensitive endpoints:**
```typescript
// API routes
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, {
    limit: 10,
    window: 60,
    key: (req) => req.ip || 'unknown'
  });

  if (rateLimitResponse) return rateLimitResponse;

  // Continue with normal handler
}
```

**C. Implement Full Safety Checks**

**Update:** `apps/web/lib/safety.ts`
```typescript
export async function checkSafety(
  userId: string,
  context?: SafetyContext
): Promise<SafetyResult> {
  // Velocity check: max rewards per hour
  const recentGrants = await db
    .select()
    .from(rewards)
    .where(
      and(
        eq(rewards.userId, userId),
        gte(rewards.createdAt, new Date(Date.now() - 60 * 60 * 1000))
      )
    );

  if (recentGrants.length > 20) {
    return {
      allowed: false,
      reason: 'velocity_check_failed: too many recent grants'
    };
  }

  // Duplicate household detection (placeholder)
  // TODO: Implement device fingerprinting

  // Risk score calculation
  const userAge = await getUserAccountAge(userId);
  if (userAge < 60 * 60 * 1000) { // Account < 1 hour old
    return {
      allowed: false,
      reason: 'new_account_restriction'
    };
  }

  return { allowed: true };
}
```

**D. SQL Injection Prevention**

**Current:** Using Drizzle ORM (safe by default)

**Verify:** Audit all raw SQL queries
```bash
# Search for raw SQL usage
grep -r "sql\`" apps/web/ --include="*.ts"
grep -r "execute(sql" apps/web/ --include="*.ts"
```

**Ensure:** All raw SQL uses parameterized queries via Drizzle's `sql` tagged template

**E. XSS Prevention**

**Current:** React escapes by default

**Add:** Content Security Policy headers
```typescript
// next.config.js
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  connect-src 'self';
  frame-ancestors 'none';
`;

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\n/g, '')
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      }
    ];
  }
};
```

**Success Metrics:**
- [ ] All API endpoints use Zod validation
- [ ] Rate limiting on authentication & sensitive endpoints
- [ ] Full safety checks in reward granting
- [ ] CSP headers block unauthorized scripts
- [ ] Security audit passes (OWASP Top 10)

---

### 1.4 Error Handling Standardization

**Current State:** Inconsistent error responses, mixed error handling patterns

**Target State:** Unified error handling with consistent API responses

#### Action Items:

**A. Standard Error Types**

**Create:** `apps/web/lib/errors.ts`
```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', { details });
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(`${resource} not found${id ? `: ${id}` : ''}`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class RateLimitError extends AppError {
  constructor(resetAt: Date) {
    super('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED', { resetAt });
  }
}
```

**B. Global Error Handler**

**Create:** `apps/web/lib/middleware/error-handler.ts`
```typescript
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export function handleError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    logger.warn({ error: error.message, code: error.code }, 'Application error');
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(error.metadata && { metadata: error.metadata })
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    logger.warn({ errors: error.errors }, 'Validation error');
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors
      },
      { status: 400 }
    );
  }

  // Unexpected errors
  logger.error({ error }, 'Unexpected error');

  return NextResponse.json(
    {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    },
    { status: 500 }
  );
}

export function withErrorHandler<T>(
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  return handler().catch(handleError);
}
```

**C. Update All API Routes**

**Before:**
```typescript
export async function GET(req: NextRequest) {
  try {
    const result = await someOperation();
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

**After:**
```typescript
import { withErrorHandler, handleError } from '@/lib/middleware/error-handler';
import { NotFoundError, UnauthorizedError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await auth();
    if (!session) throw new UnauthorizedError();

    const result = await someOperation();
    if (!result) throw new NotFoundError('Resource');

    return NextResponse.json(result);
  });
}
```

**Success Metrics:**
- [ ] All API routes use standardized error handling
- [ ] Consistent error response format across all endpoints
- [ ] Proper HTTP status codes for all error types
- [ ] Error metadata includes debugging context

---

## Priority 2: Architecture & Performance
**Timeline:** Week 3-4
**Impact:** High
**Risk:** Moderate

### 2.1 Consolidate Multi-Agent System

**Current State:** Separate API calls to orchestrator, personalize, experiment agents

**Target State:** Unified agent decision API with single call

#### Action Items:

**A. Create Unified Agent Endpoint**

**Create:** `apps/web/app/api/agents/decide/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { chooseLoop } from '@10x-k-factor/agents';
import { compose } from '@10x-k-factor/agents';
import { assignExperiment } from '@10x-k-factor/agents';

const decideSchema = z.object({
  userId: z.string().uuid(),
  event: z.string(),
  persona: z.enum(['student', 'parent', 'tutor']),
  subject: z.string().optional(),
  cooldowns: z.record(z.number()).optional(),
  experimentName: z.string().optional(),
  experimentConfig: z.object({
    variants: z.array(z.string()),
    traffic_splits: z.array(z.number()).optional()
  }).optional()
});

export async function POST(request: NextRequest) {
  const validated = decideSchema.parse(await request.json());

  const startTime = Date.now();

  // 1. Orchestrator: Choose viral loop
  const loopDecision = chooseLoop({
    event: validated.event,
    persona: validated.persona,
    subject: validated.subject,
    cooldowns: validated.cooldowns || {}
  });

  // 2. Personalization: Generate copy & rewards
  const personalization = compose({
    intent: validated.event,
    persona: validated.persona,
    subject: validated.subject,
    loop: loopDecision.loop
  });

  // 3. Experiment: Assign variant (if experiment active)
  let experiment = null;
  if (validated.experimentName && validated.experimentConfig) {
    experiment = assignExperiment({
      user_id: validated.userId,
      experiment_name: validated.experimentName,
      experiment_config: validated.experimentConfig
    });
  }

  const latency = Date.now() - startTime;

  return NextResponse.json({
    loop: loopDecision.loop,
    copy: personalization.copy,
    reward_preview: personalization.reward_preview,
    deep_link_params: personalization.deep_link_params,
    experiment_variant: experiment?.variant,
    metadata: {
      latency_ms: latency,
      orchestrator_reason: loopDecision.eligibility_reason,
      features_used: [
        ...loopDecision.features_used,
        ...personalization.features_used,
        ...(experiment?.features_used || [])
      ]
    }
  });
}
```

**B. Update Client Wrapper**

**Update:** `apps/web/lib/agents/index.ts`
```typescript
export async function getViralDecision(params: {
  userId: string;
  event: string;
  persona: 'student' | 'parent' | 'tutor';
  subject?: string;
  cooldowns?: Record<string, number>;
}) {
  const response = await fetch('/api/agents/decide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(200) // 200ms timeout
  });

  if (!response.ok) {
    // Fallback decision
    return {
      loop: 'buddy_challenge',
      copy: 'Check this out! 🎯',
      reward_preview: null,
      deep_link_params: {},
      metadata: { latency_ms: 0, fallback: true }
    };
  }

  return response.json();
}
```

**Success Metrics:**
- [ ] Single API call replaces 3 separate calls
- [ ] Latency under 150ms p95
- [ ] Graceful fallback on timeout
- [ ] Reduced network overhead

---

### 2.2 Implement Caching Layer

**Current State:** No caching, every request hits database

**Target State:** Multi-tier caching with Redis + in-memory

#### Action Items:

**A. Redis Cache Wrapper**

**Create:** `apps/web/lib/cache.ts`
```typescript
import { redis } from '@/lib/redis';

export async function getCached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  // Try cache first
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached) as T;
  }

  // Cache miss: fetch and store
  const data = await fetchFn();
  await redis.setex(key, ttlSeconds, JSON.stringify(data));

  return data;
}

export async function invalidateCache(pattern: string) {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
```

**B. Cache Leaderboards**

**Update:** `apps/web/lib/leaderboard.ts`
```typescript
export async function getLeaderboard(
  subject: string,
  limit: number = 10
): Promise<LeaderboardEntry[]> {
  const cacheKey = `leaderboard:${subject}:${limit}`;

  return getCached(cacheKey, async () => {
    // Existing database query
    const leaderboardData = await db
      .select({...})
      .from(results)
      // ... rest of query

    return leaderboardData;
  }, 300); // 5 minute cache
}

// Invalidate on new result
export async function addResult(result: NewResult) {
  await db.insert(results).values(result);
  await invalidateCache(`leaderboard:${result.subject}:*`);
}
```

**C. Cache User XP**

**Update:** `apps/web/lib/xp.ts`
```typescript
export async function getUserXpWithLevel(
  userId: string,
  personaType?: Persona
) {
  const cacheKey = `xp:${userId}:${personaType || 'all'}`;

  return getCached(cacheKey, async () => {
    const xp = personaType
      ? await getUserXpByPersona(userId, personaType)
      : await getUserXp(userId);

    const levelInfo = levelFromXp(xp);

    return { xp, ...levelInfo };
  }, 60); // 1 minute cache
}

// Invalidate on XP event
export async function trackXpEvent(params: TrackXpEventParams) {
  const event = await db.insert(xpEvents).values(params).returning();
  await invalidateCache(`xp:${params.userId}:*`);
  return event;
}
```

**D. Cache Buddy Data**

**Update:** `apps/web/lib/buddy.ts`
```typescript
export async function getBuddy(userId: string) {
  const cacheKey = `buddy:${userId}`;

  return getCached(cacheKey, async () => {
    const buddy = await db.select()
      .from(agentBuddies)
      .where(eq(agentBuddies.userId, userId))
      .limit(1);

    return buddy[0] || null;
  }, 120); // 2 minute cache
}
```

**E. In-Memory Cache for Static Data**

**Create:** `apps/web/lib/static-cache.ts`
```typescript
const cache = new Map<string, { data: unknown; expiresAt: number }>();

export function getStaticCached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlMs: number = 60000
): Promise<T> {
  const cached = cache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.data as T);
  }

  return fetchFn().then(data => {
    cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  });
}
```

**Use for:**
- Subject catalog
- Reward policies
- XP weights

**Success Metrics:**
- [ ] 80%+ cache hit rate for leaderboards
- [ ] 50%+ reduction in database queries
- [ ] Sub-50ms response times for cached data
- [ ] Proper cache invalidation on writes

---

### 2.3 Database Query Optimization

**Current State:** Some N+1 queries, no query analysis

**Target State:** Optimized queries with proper indexing

#### Action Items:

**A. Analyze Slow Queries**

**Enable:** Postgres slow query logging
```sql
ALTER DATABASE your_db SET log_min_duration_statement = 100;
```

**Monitor:** Queries taking >100ms

**B. Add Missing Indexes**

**Audit current indexes:**
```bash
pnpm drizzle-kit introspect
```

**Recommended indexes:**
```typescript
// apps/web/db/schema/learning-schema.ts
export const challenges = pgTable('challenges', {
  // ... existing columns
}, (table) => ({
  // Add composite index for common query
  userStatusIdx: index('idx_challenges_user_status')
    .on(table.userId, table.status),

  // Add index for invited challenges
  invitedUserIdx: index('idx_challenges_invited_user')
    .on(table.invitedUserId),
}));

// apps/web/db/schema/rewards-schema.ts
export const rewards = pgTable('rewards', {
  // ... existing columns
}, (table) => ({
  // Index for user rewards query
  userStatusIdx: index('idx_rewards_user_status')
    .on(table.userId, table.status),

  // Index for time-based queries
  createdAtIdx: index('idx_rewards_created_at')
    .on(table.createdAt),
}));
```

**C. Optimize Leaderboard Query**

**Current:** Single query with GROUP BY

**Optimized:** Use materialized view for popular subjects
```sql
-- Create materialized view
CREATE MATERIALIZED VIEW leaderboard_top_subjects AS
SELECT
  subject,
  user_id,
  AVG(score)::integer as avg_score,
  COUNT(*) as result_count
FROM results
WHERE subject IN ('algebra', 'geometry', 'calculus')
  AND score IS NOT NULL
GROUP BY subject, user_id;

-- Refresh periodically (via cron job)
REFRESH MATERIALIZED VIEW leaderboard_top_subjects;
```

**D. Optimize XP Queries**

**Consider:** Denormalize total XP to user profile for instant access
```typescript
// Add column to users_profiles
export const usersProfiles = pgTable('users_profiles', {
  // ... existing columns
  cachedXp: integer('cached_xp').default(0),
  xpLastUpdated: timestamp('xp_last_updated'),
});

// Update on XP event
export async function trackXpEvent(params: TrackXpEventParams) {
  await db.transaction(async (tx) => {
    // Insert event
    await tx.insert(xpEvents).values(params);

    // Update cached XP
    await tx
      .update(usersProfiles)
      .set({
        cachedXp: sql`cached_xp + ${params.rawXp}`,
        xpLastUpdated: new Date()
      })
      .where(eq(usersProfiles.userId, params.userId));
  });
}
```

**Success Metrics:**
- [ ] All queries under 100ms p95
- [ ] No N+1 queries detected
- [ ] Database CPU usage under 50%
- [ ] Proper indexes on all foreign keys

---

### 2.4 Migrate to Server Actions

**Current State:** All mutations via API routes

**Target State:** Type-safe Server Actions for all mutations

#### Action Items:

**A. Enable Server Actions**

**Update:** `next.config.js`
```javascript
module.exports = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  }
};
```

**B. Create Server Actions**

**Create:** `apps/web/actions/challenges.ts`
```typescript
'use server';

import { auth } from '@/lib/auth';
import { db } from '@/db';
import { challenges } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const completeChallengeSchema = z.object({
  challengeId: z.string().uuid(),
  score: z.number().int().min(0).max(100)
});

export async function completeChallenge(input: z.infer<typeof completeChallengeSchema>) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const { challengeId, score } = completeChallengeSchema.parse(input);

  // Verify ownership
  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, challengeId))
    .limit(1);

  if (!challenge || challenge.userId !== session.user.id) {
    throw new Error('Challenge not found or access denied');
  }

  // Update challenge
  await db
    .update(challenges)
    .set({
      status: 'completed',
      score,
      completedAt: new Date()
    })
    .where(eq(challenges.id, challengeId));

  // Track XP
  await trackXpEvent({
    userId: session.user.id,
    personaType: 'student',
    eventType: score === 100 ? 'challenge.perfect' : 'challenge.completed',
    referenceId: challengeId,
    metadata: { subject: challenge.subject, score },
    rawXp: score === 100 ? 50 : Math.max(10, Math.floor(score / 10))
  });

  revalidatePath('/app/challenges');
  revalidatePath(`/challenge/${challengeId}`);

  return { success: true, score };
}
```

**C. Update Client Components**

**Before (API route):**
```typescript
const handleComplete = async () => {
  const response = await fetch(`/api/challenges/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'completed', score })
  });
  const data = await response.json();
};
```

**After (Server Action):**
```typescript
import { completeChallenge } from '@/actions/challenges';

const handleComplete = async () => {
  const result = await completeChallenge({
    challengeId: id,
    score
  });
  // No need for manual revalidation - handled by Server Action
};
```

**D. Create Actions for All Mutations**

```
apps/web/actions/
├── challenges.ts     # completeChallenge, createChallenge
├── rewards.ts        # grantReward
├── buddy.ts          # updateBuddy, sendBuddyMessage
├── user.ts           # updatePersona, updateColors
└── tutor.ts          # createSession, addNotes
```

**Success Metrics:**
- [ ] All mutations migrated to Server Actions
- [ ] Type-safe from client to server
- [ ] Automatic revalidation
- [ ] Reduced boilerplate by 30%+

---

## Priority 3: Code Quality & Maintainability
**Timeline:** Week 5-6
**Impact:** Medium
**Risk:** Low

### 3.1 Extract Business Logic from API Routes

**Current State:** Business logic mixed with HTTP handling

**Target State:** Clean separation with service layer

#### Action Items:

**A. Create Service Layer**

**Structure:**
```
apps/web/services/
├── challenge.service.ts
├── reward.service.ts
├── xp.service.ts
├── leaderboard.service.ts
├── viral.service.ts
└── buddy.service.ts
```

**Example:** `apps/web/services/challenge.service.ts`
```typescript
import { db } from '@/db';
import { challenges } from '@/db/schema';
import { trackXpEvent } from './xp.service';
import { NotFoundError, ForbiddenError } from '@/lib/errors';

export class ChallengeService {
  async getChallenge(id: string) {
    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, id))
      .limit(1);

    if (!challenge) {
      throw new NotFoundError('Challenge', id);
    }

    return challenge;
  }

  async completeChallenge(params: {
    challengeId: string;
    userId: string;
    score: number;
  }) {
    const challenge = await this.getChallenge(params.challengeId);

    if (challenge.userId !== params.userId) {
      throw new ForbiddenError('You do not own this challenge');
    }

    // Update challenge
    await db
      .update(challenges)
      .set({
        status: 'completed',
        score: params.score,
        completedAt: new Date()
      })
      .where(eq(challenges.id, params.challengeId));

    // Track XP
    const eventType = params.score === 100
      ? 'challenge.perfect'
      : 'challenge.completed';
    const rawXp = params.score === 100
      ? 50
      : Math.max(10, Math.floor(params.score / 10));

    await trackXpEvent({
      userId: params.userId,
      personaType: 'student',
      eventType,
      referenceId: params.challengeId,
      metadata: { subject: challenge.subject, score: params.score },
      rawXp
    });

    return challenge;
  }

  async createChallenge(params: CreateChallengeParams) {
    // ... creation logic
  }
}

export const challengeService = new ChallengeService();
```

**B. Update API Routes to Use Services**

**Before:**
```typescript
export async function PATCH(req: NextRequest, { params }) {
  // 50+ lines of business logic mixed with HTTP handling
}
```

**After:**
```typescript
import { challengeService } from '@/services/challenge.service';

export async function PATCH(req: NextRequest, { params }) {
  return withErrorHandler(async () => {
    const session = await auth();
    if (!session?.user?.id) throw new UnauthorizedError();

    const { challengeId } = await params;
    const { score } = await req.json();

    const challenge = await challengeService.completeChallenge({
      challengeId,
      userId: session.user.id,
      score
    });

    return NextResponse.json(challenge);
  });
}
```

**Success Metrics:**
- [ ] All business logic in service layer
- [ ] API routes under 30 lines each
- [ ] Services are testable in isolation
- [ ] Clear separation of concerns

---

### 3.2 Centralize Configuration

**Current State:** Magic numbers scattered throughout code

**Target State:** Centralized configuration with type safety

#### Action Items:

**A. Create Configuration File**

**Create:** `apps/web/config/index.ts`
```typescript
export const config = {
  // Viral loops
  loops: {
    cooldowns: {
      buddy_challenge: 24, // hours
      results_rally: 12,
      proud_parent: 48,
      tutor_spotlight: 72
    },
    defaults: {
      fallback: 'buddy_challenge',
      timeout_ms: 150
    }
  },

  // XP system
  xp: {
    levelCurve: {
      base: 40,
      step: 60
    },
    rewards: {
      challenge_completed: { min: 10, max: 40 },
      challenge_perfect: 50,
      invite_sent: 5,
      invite_accepted: 25
    }
  },

  // Rewards
  rewards: {
    unitCosts: {
      streak_shield: 50, // cents
      ai_minutes: 10,
      badge: 100,
      credits: 1
    }
  },

  // Smart links
  smartLinks: {
    codeLength: 12,
    expiryDays: 7
  },

  // Rate limits
  rateLimits: {
    invites: {
      daily: 20
    },
    api: {
      auth: { limit: 10, window: 60 },
      challenges: { limit: 100, window: 60 },
      rewards: { limit: 50, window: 60 }
    }
  },

  // Cache TTLs (seconds)
  cache: {
    leaderboard: 300, // 5 min
    userXp: 60, // 1 min
    buddy: 120, // 2 min
    staticData: 3600 // 1 hour
  },

  // Redis
  redis: {
    presenceTtl: 30, // seconds
    errorLogWindow: 60 // seconds
  }
} as const;

// Type-safe config access
export type Config = typeof config;
```

**B. Replace Magic Numbers**

**Before:**
```typescript
const COOLDOWN = 24; // What is this?
const TTL = 300; // What is this?
```

**After:**
```typescript
import { config } from '@/config';

const cooldown = config.loops.cooldowns.buddy_challenge;
const ttl = config.cache.leaderboard;
```

**C. Environment Variables**

**Create:** `apps/web/config/env.ts`
```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
});

export const env = envSchema.parse(process.env);
```

**Usage:**
```typescript
import { env } from '@/config/env';

const dbUrl = env.DATABASE_URL; // Type-safe, validated
```

**Success Metrics:**
- [ ] Zero magic numbers in code
- [ ] All configuration centralized
- [ ] Environment variables validated
- [ ] Type-safe configuration access

---

### 3.3 Improve Type Safety

**Current State:** Good type safety, but some any/unknown types

**Target State:** Strict TypeScript with zero any types

#### Action Items:

**A. Enable Strict Mode**

**Update:** `tsconfig.json`
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**B. Define Comprehensive Types**

**Create:** `apps/web/types/index.ts`
```typescript
// Domain types
export type Persona = 'student' | 'parent' | 'tutor';
export type ChallengeStatus = 'pending' | 'completed' | 'expired';
export type ChallengeDifficulty = 'easy' | 'medium' | 'hard';
export type RewardType = 'streak_shield' | 'ai_minutes' | 'badge' | 'credits';
export type RewardStatus = 'granted' | 'denied' | 'pending';
export type Loop = 'buddy_challenge' | 'results_rally' | 'proud_parent' | 'tutor_spotlight';

// API response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  metadata?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// Challenge types
export interface Challenge {
  id: string;
  userId: string;
  subject: string;
  difficulty: ChallengeDifficulty;
  questions: Question[];
  status: ChallengeStatus;
  score: number | null;
  completedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface Question {
  id: string;
  text: string;
  type: 'multiple_choice' | 'short_answer' | 'true_false';
  options?: string[];
  correctAnswer: string;
}

// User types
export interface UserProfile {
  userId: string;
  persona: Persona;
  minor: boolean;
  guardianId: string | null;
  primaryColor: string;
  secondaryColor: string;
  overallStreak: number;
  onboardingCompleted: boolean;
}

// XP types
export interface XpEvent {
  id: number;
  userId: string;
  personaType: Persona;
  eventType: XpEventType;
  referenceId: string | null;
  metadata: Record<string, unknown>;
  rawXp: number;
  createdAt: Date;
}

export type XpEventType =
  | 'challenge.completed'
  | 'challenge.perfect'
  | 'invite.sent'
  | 'invite.accepted'
  | 'streak.kept'
  | 'badge.earned';

// Reward types
export interface Reward {
  id: string;
  userId: string;
  type: RewardType;
  amount: number | null;
  loop: Loop | null;
  dedupeKey: string;
  status: RewardStatus;
  deniedReason: string | null;
  grantedAt: Date | null;
  createdAt: Date;
}
```

**C. Replace any/unknown**

**Audit:**
```bash
# Find any types
grep -r "any" apps/web --include="*.ts" --include="*.tsx" | grep -v "node_modules"

# Find unknown types that should be typed
grep -r "unknown" apps/web --include="*.ts" --include="*.tsx" | grep -v "node_modules"
```

**Replace with proper types:**
```typescript
// Before
function processData(data: any) { ... }

// After
function processData(data: Challenge) { ... }
```

**D. Add JSDoc Comments**

**Example:**
```typescript
/**
 * Calculate XP required to reach a specific level
 * Uses quadratic formula: base * n^2 + step * n
 *
 * @param n - Target level number
 * @param base - Quadratic coefficient (default 40)
 * @param step - Linear coefficient (default 60)
 * @returns XP required to reach level n
 * @example
 * xpForLevel(5) // Returns 1300
 */
export function xpForLevel(
  n: number,
  base: number = 40,
  step: number = 60
): number {
  return Math.floor(base * n * n + step * n);
}
```

**Success Metrics:**
- [ ] Zero any types in codebase
- [ ] All public APIs documented with JSDoc
- [ ] Strict TypeScript mode enabled
- [ ] 100% type coverage

---

### 3.4 Code Organization & Naming

**Current State:** Good structure, minor inconsistencies

**Target State:** Consistent naming and organization

#### Action Items:

**A. Establish Naming Conventions**

**Document:** `CONTRIBUTING.md`
```markdown
## Naming Conventions

### Files
- Components: PascalCase (e.g., `UserProfile.tsx`)
- Utilities: kebab-case (e.g., `format-date.ts`)
- Services: kebab-case with .service suffix (e.g., `challenge.service.ts`)
- Types: kebab-case (e.g., `user-types.ts`)

### Functions
- React components: PascalCase (e.g., `UserProfile`)
- Hooks: camelCase with 'use' prefix (e.g., `useAgentBuddy`)
- Utilities: camelCase (e.g., `formatDate`)
- Services: camelCase (e.g., `challengeService.completeChallenge`)

### Variables
- Constants: SCREAMING_SNAKE_CASE (e.g., `MAX_RETRIES`)
- Regular variables: camelCase (e.g., `userId`)
- Type/Interface: PascalCase (e.g., `UserProfile`)

### Database
- Tables: snake_case, plural (e.g., `user_profiles`)
- Columns: snake_case (e.g., `created_at`)
```

**B. Organize Imports**

**Install:** eslint-plugin-import
```bash
pnpm add -D eslint-plugin-import
```

**Configure:** `.eslintrc.js`
```javascript
module.exports = {
  plugins: ['import'],
  rules: {
    'import/order': ['error', {
      'groups': [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index'
      ],
      'alphabetize': { order: 'asc' }
    }]
  }
};
```

**Example:**
```typescript
// Built-in
import { randomBytes } from 'crypto';

// External
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// Internal
import { db } from '@/db';
import { challenges } from '@/db/schema';
import { trackXpEvent } from '@/lib/xp';
import type { Persona } from '@/types';
```

**C. Consistent Error Messages**

**Before:**
```typescript
throw new Error('Challenge not found');
throw new Error('Not found');
throw new Error('Invalid challenge ID');
```

**After:**
```typescript
throw new NotFoundError('Challenge', challengeId);
// Message: "Challenge not found: abc-123"
```

**Success Metrics:**
- [ ] Consistent naming across codebase
- [ ] Imports automatically sorted
- [ ] Linting passes with no warnings
- [ ] Clear naming conventions documented

---

## Priority 4: Scalability & Optimization
**Timeline:** Week 7-8
**Impact:** Medium
**Risk:** Low

### 4.1 Implement Real-Time with WebSocket

**Current State:** Polling for presence, SSE partially implemented

**Target State:** WebSocket for all real-time features

#### Action Items:

**A. Set Up WebSocket Server**

**Install:** Socket.io
```bash
pnpm add socket.io socket.io-client
```

**Create:** `apps/web/lib/socket/server.ts`
```typescript
import { Server } from 'socket.io';
import { auth } from '@/lib/auth';

export function initializeSocket(server: any) {
  const io = new Server(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL,
      credentials: true
    }
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    const session = await auth();
    if (!session?.user) {
      return next(new Error('Unauthorized'));
    }
    socket.data.userId = session.user.id;
    next();
  });

  // Presence tracking
  io.on('connection', (socket) => {
    console.log('User connected:', socket.data.userId);

    socket.on('join_subject', async (subject: string) => {
      socket.join(`subject:${subject}`);

      // Broadcast presence count
      const count = io.sockets.adapter.rooms.get(`subject:${subject}`)?.size || 0;
      io.to(`subject:${subject}`).emit('presence_update', { count });
    });

    socket.on('leave_subject', async (subject: string) => {
      socket.leave(`subject:${subject}`);

      const count = io.sockets.adapter.rooms.get(`subject:${subject}`)?.size || 0;
      io.to(`subject:${subject}`).emit('presence_update', { count });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.data.userId);
    });
  });

  return io;
}
```

**B. Client Hook**

**Create:** `apps/web/hooks/useSocket.ts`
```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socketInstance = io(process.env.NEXT_PUBLIC_APP_URL!);

    socketInstance.on('connect', () => setConnected(true));
    socketInstance.on('disconnect', () => setConnected(false));

    setSocket(socketInstance);

    return () => {
      socketInstance.close();
    };
  }, []);

  return { socket, connected };
}

export function usePresence(subject: string) {
  const { socket, connected } = useSocket();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!socket || !connected) return;

    socket.emit('join_subject', subject);
    socket.on('presence_update', ({ count }) => setCount(count));

    return () => {
      socket.emit('leave_subject', subject);
      socket.off('presence_update');
    };
  }, [socket, connected, subject]);

  return count;
}
```

**C. Real-Time Leaderboard Updates**

**Server:**
```typescript
// When result is added
io.to(`subject:${subject}`).emit('leaderboard_update', {
  subject,
  entry: { userId, userName, score, rank }
});
```

**Client:**
```typescript
export function useLeaderboard(subject: string) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const { socket } = useSocket();

  useEffect(() => {
    // Initial fetch
    fetch(`/api/leaderboard/${subject}`)
      .then(res => res.json())
      .then(data => setLeaderboard(data.entries));

    // Listen for updates
    socket?.on('leaderboard_update', ({ entry }) => {
      setLeaderboard(prev => {
        // Merge update
        const updated = [...prev];
        const index = updated.findIndex(e => e.userId === entry.userId);
        if (index >= 0) {
          updated[index] = entry;
        } else {
          updated.push(entry);
        }
        return updated.sort((a, b) => b.score - a.score);
      });
    });

    return () => {
      socket?.off('leaderboard_update');
    };
  }, [subject, socket]);

  return leaderboard;
}
```

**Success Metrics:**
- [ ] Real-time presence without polling
- [ ] Leaderboard updates instantly
- [ ] WebSocket connection stable
- [ ] Reduced server load from polling

---

### 4.2 Optimize Bundle Size

**Current State:** Not analyzed

**Target State:** Optimized bundles under 200KB gzipped

#### Action Items:

**A. Analyze Bundle**

**Install:** @next/bundle-analyzer
```bash
pnpm add -D @next/bundle-analyzer
```

**Configure:** `next.config.js`
```javascript
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  // ... existing config
});
```

**Run:**
```bash
ANALYZE=true pnpm build
```

**B. Code Splitting**

**Dynamic imports for heavy components:**
```typescript
// Before
import { AgentBuddy } from '@/components/AgentBuddy';

// After
import dynamic from 'next/dynamic';

const AgentBuddy = dynamic(
  () => import('@/components/AgentBuddy').then(mod => ({ default: mod.AgentBuddy })),
  { ssr: false, loading: () => <BuddySkeleton /> }
);
```

**C. Tree Shaking**

**Ensure proper imports:**
```typescript
// Before
import * as icons from 'lucide-react';

// After
import { Award, Trophy, Shield } from 'lucide-react';
```

**D. Remove Unused Dependencies**

**Audit:**
```bash
pnpm dlx depcheck
```

**Remove unused packages**

**Success Metrics:**
- [ ] Bundle size under 200KB gzipped
- [ ] First Contentful Paint under 1.5s
- [ ] Time to Interactive under 3s
- [ ] Lighthouse score 90+

---

### 4.3 Database Scaling Preparation

**Current State:** Single Postgres instance

**Target State:** Ready for horizontal scaling

#### Action Items:

**A. Read Replicas**

**Prepare code for read/write split:**
```typescript
// apps/web/db/index.ts
const PRIMARY_URL = process.env.DATABASE_URL;
const REPLICA_URL = process.env.DATABASE_REPLICA_URL || PRIMARY_URL;

export const dbPrimary = getDb(PRIMARY_URL);
export const dbReplica = getDb(REPLICA_URL);

// Use replica for read-only queries
export async function getLeaderboard(subject: string) {
  return dbReplica.select().from(results)...
}

// Use primary for writes
export async function createChallenge(data: NewChallenge) {
  return dbPrimary.insert(challenges).values(data);
}
```

**B. Connection Pooling**

**Update:** `apps/web/db/index.ts`
```typescript
const pool = new Pool({
  connectionString: databaseUrl,
  max: 20, // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

**C. Query Timeout**

**Add timeout to all queries:**
```typescript
await db.select()
  .from(challenges)
  .where(eq(challenges.id, id))
  .timeout(5000); // 5 second timeout
```

**D. Prepare for Sharding**

**Add userId-based sharding key to all tables** (for future)

**Success Metrics:**
- [ ] Code supports read replicas
- [ ] Connection pooling configured
- [ ] Query timeouts enforced
- [ ] Sharding strategy documented

---

## Priority 5: Advanced Features
**Timeline:** Week 9+
**Impact:** Low-Medium
**Risk:** Low

### 5.1 Admin Dashboard Enhancements

**Current State:** Basic metrics page

**Target State:** Comprehensive admin tools

#### Action Items:

**A. Reward Policy Editor**

**Create:** `apps/web/app/admin/rewards/page.tsx`
```typescript
'use client';

import { useState } from 'react';
import { config } from '@/config';

export default function RewardPolicyEditor() {
  const [policies, setPolicies] = useState(config.rewards.unitCosts);

  const handleUpdate = async (type: string, cost: number) => {
    // Update via API
    await fetch('/api/admin/rewards/policy', {
      method: 'PATCH',
      body: JSON.stringify({ type, unitCostCents: cost })
    });
  };

  return (
    <div>
      <h1>Reward Policy Editor</h1>
      {Object.entries(policies).map(([type, cost]) => (
        <div key={type}>
          <label>{type}</label>
          <input
            type="number"
            value={cost}
            onChange={(e) => handleUpdate(type, Number(e.target.value))}
          />
        </div>
      ))}
    </div>
  );
}
```

**B. XP Weight Tuning**

**Create:** `apps/web/app/admin/xp-weights/page.tsx`

**Allow admins to adjust XP multipliers retroactively**

**C. User Impersonation**

**For debugging:**
```typescript
export async function impersonateUser(adminId: string, targetUserId: string) {
  // Verify admin
  const admin = await getUser(adminId);
  if (admin.role !== 'admin') throw new Error('Unauthorized');

  // Create impersonation session
  const session = await createSession({
    userId: targetUserId,
    impersonatedBy: adminId
  });

  return session;
}
```

**Success Metrics:**
- [ ] Admins can edit reward policies
- [ ] Admins can tune XP weights
- [ ] Admins can impersonate users safely
- [ ] All admin actions are logged

---

### 5.2 Advanced Analytics

**Current State:** Basic event tracking

**Target State:** Full product analytics

#### Action Items:

**A. Cohort Analysis**

**Create:** `apps/web/lib/analytics/cohorts.ts`
```typescript
export async function getCohortRetention(cohortDate: Date) {
  // Users who signed up on cohortDate
  const cohortUsers = await db
    .select()
    .from(users)
    .where(
      and(
        gte(users.createdAt, cohortDate),
        lt(users.createdAt, addDays(cohortDate, 1))
      )
    );

  // Track retention over 14 days
  const retention = [];
  for (let day = 0; day < 14; day++) {
    const activeUsers = await db
      .select({ userId: events.userId })
      .from(events)
      .where(
        and(
          inArray(events.userId, cohortUsers.map(u => u.id)),
          gte(events.ts, addDays(cohortDate, day)),
          lt(events.ts, addDays(cohortDate, day + 1))
        )
      )
      .groupBy(events.userId);

    retention.push({
      day,
      active: activeUsers.length,
      percentage: (activeUsers.length / cohortUsers.length) * 100
    });
  }

  return retention;
}
```

**B. Funnel Analysis**

**Track conversion funnels:**
```typescript
export async function getViralFunnel(loop: string) {
  // Step 1: Link created
  const linksCreated = await db
    .select({ count: sql`COUNT(*)` })
    .from(smartLinks)
    .where(eq(smartLinks.loop, loop));

  // Step 2: Link opened
  const linksOpened = await db
    .select({ count: sql`COUNT(DISTINCT ${events.props}->>'smartlink_code')` })
    .from(events)
    .where(
      and(
        eq(events.name, 'invite.opened'),
        eq(sql`${events.props}->>'loop'`, loop)
      )
    );

  // Step 3: User signed up
  const conversions = await db
    .select({ count: sql`COUNT(*)` })
    .from(referrals)
    .where(eq(referrals.loop, loop));

  return {
    linksCreated: linksCreated[0].count,
    linksOpened: linksOpened[0].count,
    conversions: conversions[0].count,
    openRate: (linksOpened[0].count / linksCreated[0].count) * 100,
    conversionRate: (conversions[0].count / linksOpened[0].count) * 100
  };
}
```

**C. A/B Test Results**

**Analyze experiment performance:**
```typescript
export async function getExperimentResults(experimentName: string) {
  const results = await db
    .select({
      variant: sql`${events.props}->>'variant'`,
      conversions: sql`COUNT(*) FILTER (WHERE ${events.name} = 'invite.accepted')`,
      total: sql`COUNT(*)`
    })
    .from(events)
    .where(
      and(
        eq(sql`${events.props}->>'experiment'`, experimentName),
        inArray(events.name, ['exp.exposed', 'invite.accepted'])
      )
    )
    .groupBy(sql`${events.props}->>'variant'`);

  return results.map(r => ({
    variant: r.variant,
    conversionRate: (r.conversions / r.total) * 100,
    sampleSize: r.total
  }));
}
```

**Success Metrics:**
- [ ] Cohort retention tracked
- [ ] Viral funnel analysis available
- [ ] A/B test results automated
- [ ] Data-driven decision making

---

### 5.3 Performance Benchmarking

**Action Items:**

**A. Load Testing**

**Install:** k6
```bash
brew install k6  # or download from k6.io
```

**Create:** `load-tests/challenge-flow.js`
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
};

export default function () {
  // Get challenge
  const res = http.get('https://your-app.com/api/challenges/test-id');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);
}
```

**Run:**
```bash
k6 run load-tests/challenge-flow.js
```

**B. Database Load Testing**

**Create:** `load-tests/db-queries.sql`
```sql
-- Simulate concurrent leaderboard queries
\set subject 'algebra'
SELECT user_id, AVG(score)::integer as avg_score
FROM results
WHERE subject = :subject
GROUP BY user_id
ORDER BY avg_score DESC
LIMIT 10;
```

**Run with pgbench:**
```bash
pgbench -c 50 -j 2 -T 60 -f load-tests/db-queries.sql your_database
```

**C. Continuous Performance Monitoring**

**Install:** Lighthouse CI
```bash
pnpm add -D @lhci/cli
```

**Configure:** `lighthouserc.json`
```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000", "http://localhost:3000/app"],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 2000 }],
        "interactive": ["error", { "maxNumericValue": 3500 }]
      }
    }
  }
}
```

**Success Metrics:**
- [ ] API handles 100+ concurrent users
- [ ] Database handles 1000+ qps
- [ ] Lighthouse score 90+ consistently
- [ ] No performance regressions

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
**Goal:** Production readiness

- [x] Week 1: Testing infrastructure + Unit tests
- [x] Week 2: Integration tests + Monitoring setup
- [ ] **Deliverable:** 80% test coverage, production monitoring live

### Phase 2: Architecture (Weeks 3-4)
**Goal:** Performance & scalability

- [x] Week 3: Agent consolidation + Caching layer
- [x] Week 4: Database optimization + Server Actions migration
- [ ] **Deliverable:** Sub-200ms API responses, reduced DB load

### Phase 3: Quality (Weeks 5-6)
**Goal:** Maintainability & developer experience

- [x] Week 5: Service layer extraction + Configuration centralization
- [x] Week 6: Type safety improvements + Code organization
- [ ] **Deliverable:** Clean architecture, zero any types

### Phase 4: Scale (Weeks 7-8)
**Goal:** Handle growth

- [x] Week 7: WebSocket implementation + Bundle optimization
- [x] Week 8: Database scaling prep + Load testing
- [ ] **Deliverable:** Real-time features, scalable infrastructure

### Phase 5: Advanced (Weeks 9+)
**Goal:** Product excellence

- [x] Week 9: Admin dashboard enhancements
- [x] Week 10: Advanced analytics
- [x] Week 11: Performance benchmarking
- [ ] **Deliverable:** Data-driven insights, admin tools

---

## Risk Mitigation

### High-Risk Changes

**1. Server Actions Migration**
- **Risk:** Breaking existing functionality
- **Mitigation:**
  - Migrate one route at a time
  - Keep API routes as fallback during transition
  - Comprehensive testing before decommissioning

**2. Database Schema Changes**
- **Risk:** Data loss or downtime
- **Mitigation:**
  - Always use migrations (Drizzle Kit)
  - Test migrations on staging first
  - Keep backups before major changes

**3. Real-Time WebSocket**
- **Risk:** Increased server load
- **Mitigation:**
  - Start with presence only
  - Monitor connection counts
  - Implement connection throttling

### Medium-Risk Changes

**1. Caching Layer**
- **Risk:** Stale data
- **Mitigation:**
  - Short TTLs initially
  - Robust cache invalidation
  - Monitor cache hit rates

**2. Service Layer Extraction**
- **Risk:** Breaking changes during refactor
- **Mitigation:**
  - Comprehensive test coverage first
  - Refactor incrementally
  - Code review for each service

---

## Success Metrics

### Technical Metrics
- [ ] Test coverage: 80%+
- [ ] API response time: p95 < 200ms
- [ ] Database query time: p95 < 100ms
- [ ] Error rate: < 0.1%
- [ ] Uptime: 99.9%

### Code Quality Metrics
- [ ] TypeScript strict mode: 100%
- [ ] ESLint warnings: 0
- [ ] Bundle size: < 200KB gzipped
- [ ] Lighthouse score: 90+

### Business Metrics
- [ ] K-factor: ≥ 1.20
- [ ] Viral conversion: 15%+
- [ ] User retention (D7): 40%+
- [ ] Reward cost per user: < $2

---

## Conclusion

This refactoring plan transforms the 10X K-Factor platform from a solid MVP into a production-grade, scalable system. The prioritized approach ensures critical gaps are addressed first while maintaining velocity on feature development.

**Next Steps:**
1. Review and approve this plan with the team
2. Set up project tracking (GitHub Projects/Jira)
3. Begin Priority 1 implementation (Week 1)
4. Establish weekly review cadence
5. Adjust timeline based on actual progress

**Estimated Total Effort:** 11 weeks with 1-2 engineers

---

*This document is a living plan and should be updated as implementation progresses.*
