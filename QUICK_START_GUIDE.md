# Quick Start Implementation Guide
## 10X K-Factor Refactoring Plan

**Version:** 1.0.0
**Target Audience:** Engineers implementing the refactoring plan

---

## Week 1: Foundation Setup

### Day 1-2: Testing Infrastructure

**Goal:** Get Vitest running with first tests

#### 1. Install Dependencies
```bash
pnpm add -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom msw
```

#### 2. Create Vitest Config
Create `apps/web/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
});
```

#### 3. Write First Test
Create `packages/agents/src/__tests__/orchestrator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { chooseLoop } from '../orchestrator.agent';

describe('Orchestrator Agent', () => {
  it('selects buddy_challenge for student', () => {
    const result = chooseLoop({
      event: 'results_viewed',
      persona: 'student',
      cooldowns: {}
    });

    expect(result.loop).toBe('buddy_challenge');
  });
});
```

#### 4. Run Tests
```bash
pnpm test
```

**Checkpoint:** First test passing ✅

---

### Day 3-4: Logging & Monitoring

**Goal:** Replace console.log with structured logging

#### 1. Install Pino
```bash
pnpm add pino pino-pretty
```

#### 2. Create Logger
Create `apps/web/lib/logger.ts`:
```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

export function createLogger(context: string) {
  return logger.child({ context });
}
```

#### 3. Update One API Route
Replace in `apps/web/app/api/challenges/[id]/route.ts`:
```typescript
// Before
console.error("[update-challenge] Error:", error);

// After
import { createLogger } from '@/lib/logger';
const log = createLogger('api:challenges');

log.error({ error, challengeId }, 'Failed to update challenge');
```

#### 4. Test Locally
```bash
pnpm dev
# Make API call
# Check logs are structured
```

**Checkpoint:** Structured logs working ✅

---

### Day 5: Error Handling

**Goal:** Implement standard error types

#### 1. Create Error Classes
Create `apps/web/lib/errors.ts`:
```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
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
```

#### 2. Create Error Handler
Create `apps/web/lib/middleware/error-handler.ts`:
```typescript
import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export function handleError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    logger.warn({ error: error.message, code: error.code }, 'Application error');
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  logger.error({ error }, 'Unexpected error');
  return NextResponse.json(
    { error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}

export async function withErrorHandler(
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    return handleError(error);
  }
}
```

#### 3. Refactor One Route
Update `apps/web/app/api/challenges/[id]/route.ts`:
```typescript
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { NotFoundError, UnauthorizedError } from '@/lib/errors';

export async function PATCH(req: NextRequest, { params }) {
  return withErrorHandler(async () => {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: challengeId } = await params;
    const [challenge] = await db.select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);

    if (!challenge) {
      throw new NotFoundError('Challenge', challengeId);
    }

    // ... rest of logic

    return NextResponse.json(updatedChallenge);
  });
}
```

**Checkpoint:** Error handling standardized ✅

---

## Week 2: More Tests + Monitoring

### Day 6-8: Agent Tests

**Goal:** 100% coverage on agent system

#### Copy all test files from TESTING_STRATEGY.md:
- `orchestrator.test.ts`
- `personalize.test.ts`
- `experiment.test.ts`

Run tests:
```bash
pnpm test packages/agents
```

Aim for 100% coverage on agents.

**Checkpoint:** Agent tests at 100% coverage ✅

---

### Day 9-10: Integration Tests

**Goal:** API route integration tests

#### 1. Create Test Helper
Create `apps/web/__tests__/helpers/api-test-helper.ts`:
```typescript
// Copy from TESTING_STRATEGY.md
```

#### 2. Write Challenge Flow Test
Create `apps/web/__tests__/integration/challenges-flow.test.ts`:
```typescript
// Copy from TESTING_STRATEGY.md
```

#### 3. Set Up Test Database
```bash
# Create test database
createdb test_10x_k_factor

# Update .env.test
DATABASE_URL=postgresql://localhost/test_10x_k_factor

# Run migrations
DATABASE_URL=$DATABASE_URL_TEST pnpm drizzle:push
```

#### 4. Run Tests
```bash
pnpm test:integration
```

**Checkpoint:** Integration tests passing ✅

---

## Week 3: Architecture Improvements

### Day 11-12: Unified Agent Endpoint

**Goal:** Single API for all agent decisions

#### 1. Create New Endpoint
Create `apps/web/app/api/agents/decide/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { chooseLoop, compose, assignExperiment } from '@10x-k-factor/agents';
import { z } from 'zod';

const schema = z.object({
  userId: z.string().uuid(),
  event: z.string(),
  persona: z.enum(['student', 'parent', 'tutor']),
  subject: z.string().optional(),
  cooldowns: z.record(z.number()).optional()
});

export async function POST(request: NextRequest) {
  const validated = schema.parse(await request.json());

  // Orchestrator
  const loopDecision = chooseLoop({
    event: validated.event,
    persona: validated.persona,
    subject: validated.subject,
    cooldowns: validated.cooldowns || {}
  });

  // Personalization
  const personalization = compose({
    intent: validated.event,
    persona: validated.persona,
    subject: validated.subject,
    loop: loopDecision.loop
  });

  return NextResponse.json({
    loop: loopDecision.loop,
    copy: personalization.copy,
    reward_preview: personalization.reward_preview,
    deep_link_params: personalization.deep_link_params
  });
}
```

#### 2. Create Client Wrapper
Create `apps/web/lib/agents/index.ts`:
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
    signal: AbortSignal.timeout(200)
  });

  if (!response.ok) {
    return {
      loop: 'buddy_challenge',
      copy: 'Check this out! 🎯',
      reward_preview: null,
      deep_link_params: {}
    };
  }

  return response.json();
}
```

#### 3. Replace Calls in Components
Find and replace direct orchestrator calls with new wrapper.

**Checkpoint:** Unified agent endpoint working ✅

---

### Day 13-15: Caching Layer

**Goal:** Redis caching for hot paths

#### 1. Create Cache Wrapper
Create `apps/web/lib/cache.ts`:
```typescript
import { redis } from '@/lib/redis';

export async function getCached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached) as T;
  }

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

#### 2. Update Leaderboard
Update `apps/web/lib/leaderboard.ts`:
```typescript
import { getCached, invalidateCache } from './cache';

export async function getLeaderboard(
  subject: string,
  limit: number = 10
): Promise<LeaderboardEntry[]> {
  const cacheKey = `leaderboard:${subject}:${limit}`;

  return getCached(cacheKey, async () => {
    // Existing DB query
    return leaderboardData;
  }, 300);
}

// Invalidate on new result
export async function addResult(result: NewResult) {
  await db.insert(results).values(result);
  await invalidateCache(`leaderboard:${result.subject}:*`);
}
```

#### 3. Test Cache Hit Rate
```bash
# Monitor Redis
redis-cli MONITOR

# Make requests
# Check cache hits
```

**Checkpoint:** Caching working, hit rate >50% ✅

---

## Week 4: Database & Server Actions

### Day 16-18: Database Optimization

**Goal:** Add missing indexes

#### 1. Analyze Slow Queries
```sql
-- Enable slow query log
ALTER DATABASE your_db SET log_min_duration_statement = 100;

-- Check pg_stat_statements
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

#### 2. Add Indexes
Create migration `apps/web/db/migrations/add_indexes.sql`:
```sql
-- Challenges
CREATE INDEX IF NOT EXISTS idx_challenges_user_status
  ON challenges(user_id, status);

CREATE INDEX IF NOT EXISTS idx_challenges_invited_user
  ON challenges(invited_user_id);

-- Rewards
CREATE INDEX IF NOT EXISTS idx_rewards_user_status
  ON rewards(user_id, status);

CREATE INDEX IF NOT EXISTS idx_rewards_created_at
  ON rewards(created_at);

-- Results
CREATE INDEX IF NOT EXISTS idx_results_subject_score
  ON results(subject, score);
```

#### 3. Run Migration
```bash
pnpm drizzle:push
```

#### 4. Verify Performance
```sql
EXPLAIN ANALYZE
SELECT * FROM challenges
WHERE user_id = 'xxx' AND status = 'pending';
```

**Checkpoint:** Queries under 100ms ✅

---

### Day 19-20: Server Actions Migration

**Goal:** Migrate challenge completion to Server Action

#### 1. Create Server Action
Create `apps/web/actions/challenges.ts`:
```typescript
'use server';

import { auth } from '@/lib/auth';
import { db } from '@/db';
import { challenges } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { trackXpEvent } from '@/lib/xp';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const schema = z.object({
  challengeId: z.string().uuid(),
  score: z.number().int().min(0).max(100)
});

export async function completeChallenge(input: z.infer<typeof schema>) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const { challengeId, score } = schema.parse(input);

  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, challengeId))
    .limit(1);

  if (!challenge || challenge.userId !== session.user.id) {
    throw new Error('Challenge not found or access denied');
  }

  await db
    .update(challenges)
    .set({
      status: 'completed',
      score,
      completedAt: new Date()
    })
    .where(eq(challenges.id, challengeId));

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

#### 2. Update Client Component
```typescript
'use client';

import { completeChallenge } from '@/actions/challenges';
import { useTransition } from 'react';

export function ChallengeComponent({ challengeId }: { challengeId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleComplete = () => {
    startTransition(async () => {
      const result = await completeChallenge({
        challengeId,
        score: 100
      });

      if (result.success) {
        toast.success('Challenge completed!');
      }
    });
  };

  return (
    <button onClick={handleComplete} disabled={isPending}>
      {isPending ? 'Submitting...' : 'Complete'}
    </button>
  );
}
```

#### 3. Test
```bash
pnpm dev
# Test challenge completion
# Verify DB updated
# Check XP tracked
```

**Checkpoint:** Server Actions working ✅

---

## Week 5-6: Code Quality

### Quick Wins

#### 1. Centralize Configuration
Create `apps/web/config/index.ts`:
```typescript
export const config = {
  loops: {
    cooldowns: {
      buddy_challenge: 24,
      results_rally: 12,
      proud_parent: 48,
      tutor_spotlight: 72
    }
  },
  xp: {
    levelCurve: { base: 40, step: 60 },
    rewards: {
      challenge_completed: { min: 10, max: 40 },
      challenge_perfect: 50
    }
  },
  cache: {
    leaderboard: 300,
    userXp: 60,
    buddy: 120
  }
} as const;
```

Replace magic numbers:
```bash
# Find and replace
# COOLDOWN = 24 → config.loops.cooldowns.buddy_challenge
```

#### 2. Extract Service Layer
Create `apps/web/services/challenge.service.ts`:
```typescript
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
      throw new ForbiddenError();
    }

    await db
      .update(challenges)
      .set({
        status: 'completed',
        score: params.score,
        completedAt: new Date()
      })
      .where(eq(challenges.id, params.challengeId));

    // Track XP
    await trackXpEvent({...});

    return challenge;
  }
}

export const challengeService = new ChallengeService();
```

#### 3. Organize Imports
Install and configure:
```bash
pnpm add -D eslint-plugin-import
```

Update `.eslintrc.js`:
```javascript
module.exports = {
  plugins: ['import'],
  rules: {
    'import/order': ['error', {
      'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      'alphabetize': { order: 'asc' }
    }]
  }
};
```

Run:
```bash
pnpm lint --fix
```

**Checkpoint:** Code organized and clean ✅

---

## Common Pitfalls & Solutions

### Issue: Tests failing in CI but passing locally
**Solution:**
- Ensure test database is set up in CI
- Check environment variables
- Use docker-compose for consistent environment

### Issue: Cache invalidation not working
**Solution:**
- Use glob patterns: `cache:leaderboard:*`
- Test invalidation separately
- Add logging to verify cache operations

### Issue: TypeScript errors after strict mode
**Solution:**
- Fix one file at a time
- Use `// @ts-expect-error` temporarily with TODO comment
- Create proper types incrementally

### Issue: Server Actions throwing cryptic errors
**Solution:**
- Ensure `'use server'` at top of file
- Check Zod validation is working
- Add proper error handling

---

## Progress Tracking

Use this checklist to track implementation:

### Week 1
- [ ] Vitest installed and configured
- [ ] First agent test passing
- [ ] Pino logger installed
- [ ] One API route using structured logging
- [ ] Error handling classes created
- [ ] One API route using error handler

### Week 2
- [ ] All agent tests written (100% coverage)
- [ ] Integration test helper created
- [ ] Challenge flow integration test passing
- [ ] Test database configured

### Week 3
- [ ] Unified agent endpoint created
- [ ] Client wrapper implemented
- [ ] Components updated to use new endpoint
- [ ] Cache wrapper created
- [ ] Leaderboard cached
- [ ] Cache hit rate >50%

### Week 4
- [ ] Slow queries identified
- [ ] Missing indexes added
- [ ] All queries <100ms
- [ ] First Server Action created
- [ ] Challenge completion migrated
- [ ] Revalidation working

### Week 5-6
- [ ] Configuration centralized
- [ ] Magic numbers replaced
- [ ] Service layer extracted
- [ ] Imports organized
- [ ] Linting passing

---

## Getting Help

### Resources
- [Vitest Docs](https://vitest.dev)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Drizzle ORM Docs](https://orm.drizzle.team)
- [Pino Logger](https://getpino.io)

### Code Review Checklist
- [ ] Tests added for new code
- [ ] No console.log (use logger)
- [ ] Error handling uses AppError classes
- [ ] TypeScript strict mode passing
- [ ] No magic numbers (use config)
- [ ] Imports organized
- [ ] Documentation updated

---

## Next Steps After Quick Start

Once you've completed the 6-week plan:

1. **Monitoring Setup**
   - Install Sentry
   - Set up Prometheus + Grafana
   - Create alerting rules

2. **Performance Testing**
   - Run k6 load tests
   - Optimize slow endpoints
   - Set up continuous performance monitoring

3. **Advanced Features**
   - WebSocket for real-time
   - Admin dashboard enhancements
   - Advanced analytics

---

*Happy refactoring! Remember: Small, incremental changes with tests beat big bang rewrites.*
