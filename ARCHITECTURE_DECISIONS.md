# Architecture Decision Records (ADR)
## 10X K-Factor Tutoring Platform

**Last Updated:** November 19, 2025

---

## ADR-001: Multi-Agent System Architecture

**Status:** Accepted
**Date:** 2025-11-19
**Decision Makers:** Engineering Team

### Context
The platform requires intelligent routing of viral loops based on user context (persona, event, cooldowns). We need a system that is:
- Fast (sub-200ms decisions)
- Maintainable (clear logic, testable)
- Extensible (easy to add new loops)

### Decision
Implement a lightweight multi-agent system with three specialized agents:
1. **Orchestrator Agent**: Loop selection based on cooldowns
2. **Personalization Agent**: Copy generation and reward previews
3. **Experiment Agent**: A/B test variant assignment

All agents are pure TypeScript functions (no external LLM calls).

### Consequences

**Positive:**
- Predictable, deterministic behavior
- Easy to test (pure functions)
- Sub-150ms latency
- No external API dependencies

**Negative:**
- Limited to pre-defined rules (not learning)
- Requires manual updates for new loops
- Cannot adapt to user behavior patterns

**Mitigation:**
- Document loop logic clearly
- Create admin tools for easy rule updates
- Track metrics to inform future optimizations

### Alternatives Considered

**Option 1: External LLM API**
- Pros: Flexible, natural language
- Cons: Slow (>1s latency), expensive, unpredictable
- Rejected: Latency unacceptable for real-time decisions

**Option 2: Rule Engine (Drools, etc.)**
- Pros: DSL for rules, visual editor
- Cons: Overkill, learning curve, deployment complexity
- Rejected: Over-engineering for current scale

---

## ADR-002: Database Strategy - Postgres + Drizzle ORM

**Status:** Accepted
**Date:** 2025-11-19

### Context
Need a reliable, scalable database with strong type safety and good developer experience.

### Decision
Use PostgreSQL with Drizzle ORM:
- **Postgres**: Battle-tested, excellent JSON support, robust indexing
- **Drizzle**: Type-safe, lightweight, great DX

### Consequences

**Positive:**
- Type safety from database to application
- Excellent JSON/JSONB support for flexible schemas
- Rich indexing capabilities (GIN, B-tree, composite)
- Mature ecosystem and tooling

**Negative:**
- Vertical scaling limits (mitigated with read replicas)
- Schema migrations require careful planning

**Design Patterns:**
- Immutable event logs (`xp_events`, `events`)
- Derived views for complex calculations (`derived_user_xp`)
- JSONB for flexible metadata
- Composite indexes for common queries

### Migration Path
If scale requires sharding:
1. Add `userId`-based sharding key to all tables
2. Use Citus or manual sharding
3. Update application to route queries by user

---

## ADR-003: Caching Strategy - Redis Multi-Tier

**Status:** Accepted
**Date:** 2025-11-19

### Context
Many queries are read-heavy with acceptable staleness:
- Leaderboards (5min stale OK)
- User XP (1min stale OK)
- Buddy data (2min stale OK)

### Decision
Implement multi-tier caching:
1. **Redis** (distributed): For shared data
2. **In-memory** (process): For static data

Cache invalidation: Write-through pattern with explicit invalidation on mutations.

### Consequences

**Positive:**
- 50%+ reduction in database load
- Sub-50ms response times for cached data
- Horizontal scalability

**Negative:**
- Cache invalidation complexity
- Potential for stale data
- Redis as additional dependency

**Patterns:**
```typescript
// Write-through
await db.insert(results).values(result);
await invalidateCache(`leaderboard:${result.subject}:*`);

// Cache-aside
const data = await getCached(key, async () => {
  return await db.select()...
}, ttl);
```

---

## ADR-004: Real-Time Strategy - WebSocket over Polling

**Status:** Proposed
**Date:** 2025-11-19

### Context
Current implementation uses polling for presence and leaderboard updates.
- Polling interval: 30s
- Server load: High for concurrent users
- User experience: Delayed updates

### Decision
Migrate to WebSocket using Socket.io for real-time features:
- Presence tracking
- Leaderboard updates
- Buddy notifications

### Consequences

**Positive:**
- Instant updates (no 30s delay)
- Reduced server load (no polling)
- Better user experience
- Bi-directional communication

**Negative:**
- Stateful connections (harder to scale)
- More complex deployment (WebSocket support needed)
- Fallback to long-polling required

**Implementation Plan:**
1. Set up Socket.io server
2. Migrate presence first (low risk)
3. Add leaderboard updates
4. Monitor connection counts and server load

---

## ADR-005: Testing Strategy - Pyramid Approach

**Status:** Accepted
**Date:** 2025-11-19

### Context
Zero test coverage is a critical risk for production deployment.

### Decision
Adopt testing pyramid:
- 60% Unit tests (fast, isolated)
- 30% Integration tests (API routes)
- 10% E2E tests (critical flows)

Target: 80% overall coverage, 90% for critical paths.

### Consequences

**Positive:**
- Confidence in refactoring
- Regression prevention
- Living documentation
- Faster debugging

**Negative:**
- Upfront time investment
- Test maintenance overhead

**Tools:**
- Vitest (unit + integration)
- Playwright (E2E)
- MSW (API mocking)

---

## ADR-006: Server Actions vs API Routes

**Status:** Accepted
**Date:** 2025-11-19

### Context
Next.js 15 offers two patterns for server mutations:
1. API Routes (traditional REST)
2. Server Actions (new, type-safe)

### Decision
Migrate mutations to Server Actions:
- Type-safe from client to server
- Automatic request deduplication
- Built-in revalidation
- Reduced boilerplate

Keep API Routes for:
- Third-party integrations
- Webhooks
- Public endpoints (no auth)

### Consequences

**Positive:**
- End-to-end type safety
- Less boilerplate
- Better error handling
- Automatic caching

**Negative:**
- Requires client components
- Learning curve for team
- Some limitations (file uploads, etc.)

**Migration Strategy:**
1. Start with simple mutations (challenge complete)
2. Measure performance vs API routes
3. Gradually migrate all mutations
4. Keep API routes as fallback during transition

---

## ADR-007: Error Handling - Standardized AppError Classes

**Status:** Accepted
**Date:** 2025-11-19

### Context
Current error handling is inconsistent:
- Mixed HTTP status codes
- Inconsistent error response formats
- Poor error context for debugging

### Decision
Implement standardized error classes:
```typescript
class AppError extends Error {
  constructor(message, statusCode, code, metadata)
}

class NotFoundError extends AppError { ... }
class UnauthorizedError extends AppError { ... }
class ValidationError extends AppError { ... }
```

Global error handler middleware catches and formats errors.

### Consequences

**Positive:**
- Consistent error responses
- Better debugging with metadata
- Proper HTTP status codes
- Structured error logging

**Negative:**
- Refactoring all routes
- Team must adopt new patterns

---

## ADR-008: XP System - Retroactive Rebalancing

**Status:** Accepted
**Date:** 2025-11-19

### Context
Game balance may need tuning after launch.
Need ability to adjust XP rewards without losing historical data.

### Decision
Implement two-table system:
1. **xp_events**: Immutable log (rawXp never changes)
2. **xp_weights**: Multipliers per event type

Derived view calculates: `totalXp = SUM(rawXp * multiplier)`

### Consequences

**Positive:**
- Retroactive rebalancing possible
- Historical data preserved
- Admin can tune economy
- A/B test different reward structures

**Negative:**
- XP queries require view calculation
- Slightly slower than denormalized column

**Optimization:**
- Cache calculated XP (1min TTL)
- Consider denormalizing for scale

---

## ADR-009: Viral Loop Cooldowns - Client + Server Enforcement

**Status:** Accepted
**Date:** 2025-11-19

### Context
Prevent spam by enforcing cooldowns on viral loops.
Need to balance user experience with fraud prevention.

### Decision
Two-tier cooldown enforcement:
1. **Client-side**: Show disabled UI, better UX
2. **Server-side**: Authoritative check, security

Cooldowns stored in:
- Redis (fast lookup)
- Database (fallback, audit trail)

### Consequences

**Positive:**
- Good user experience (instant feedback)
- Secure (server validates)
- Flexible (easy to adjust periods)

**Negative:**
- Dual maintenance (client + server)
- Clock skew potential (mitigated by server authority)

**Cooldown Periods:**
```typescript
{
  buddy_challenge: 24h,
  results_rally: 12h,
  proud_parent: 48h,
  tutor_spotlight: 72h
}
```

---

## ADR-010: Monorepo Structure - Turborepo + pnpm

**Status:** Accepted
**Date:** 2025-11-19

### Context
Project has multiple packages:
- `web` (Next.js app)
- `agents` (decision logic)
- `lib` (shared types)

### Decision
Use Turborepo with pnpm workspaces:
- Fast, incremental builds
- Dependency caching
- Task parallelization

### Consequences

**Positive:**
- Fast CI/CD (cache hits)
- Clear package boundaries
- Easy to add new packages
- Shared dependencies (no duplication)

**Negative:**
- Initial setup complexity
- Learning curve for team

**Structure:**
```
apps/
  web/              # Next.js app
packages/
  agents/           # Pure TS agents
  lib/              # Shared types
```

---

## ADR-011: Safety Checks - Progressive Implementation

**Status:** Accepted
**Date:** 2025-11-19

### Context
Reward granting needs fraud prevention, but can't block launch.

### Decision
Phase 1 (MVP): Stub safety checks (always allow)
Phase 2 (Production): Full implementation
- Velocity checks (grants per hour)
- Duplicate household detection
- Emulator heuristics
- Risk scoring

Current: Phase 1 stub

### Consequences

**Positive:**
- Doesn't block MVP launch
- Architecture supports future enhancement
- Can iterate based on real data

**Negative:**
- Temporary fraud risk
- Must prioritize Phase 2

**Mitigation:**
- Monitor reward grants closely
- Manual review flagged users
- Low reward values initially

---

## ADR-012: Authentication - NextAuth.js v5

**Status:** Accepted
**Date:** 2025-11-19

### Context
Need authentication with:
- Email/password
- OAuth (Google)
- Session management

### Decision
Use NextAuth.js v5 with:
- JWT strategy (stateless)
- Drizzle adapter (DB sessions for fallback)
- Profile auto-creation on signup

### Consequences

**Positive:**
- Battle-tested library
- Multiple auth methods
- Good Next.js integration
- Secure by default

**Negative:**
- v5 still in beta
- Breaking changes from v4

**Security:**
- bcrypt for passwords
- HTTP-only cookies
- CSRF protection built-in

---

## Summary of Key Architectural Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| Multi-agent system | Fast, deterministic, testable | Limited adaptability |
| Postgres + Drizzle | Type safety, reliability | Vertical scaling limits |
| Redis caching | Performance, scalability | Cache invalidation complexity |
| WebSocket (planned) | Real-time UX | Stateful connections |
| Server Actions | Type safety, less boilerplate | Learning curve |
| Error classes | Consistency, debugging | Refactoring effort |
| Retroactive XP | Game balance flexibility | Query complexity |
| Monorepo | Fast builds, clear boundaries | Setup complexity |

---

## Future ADRs to Consider

### ADR-013: Observability Stack
**Context:** Need production monitoring
**Options:** Datadog, New Relic, self-hosted (Prometheus + Grafana)

### ADR-014: File Storage
**Context:** User avatars, buddy sprites
**Options:** S3, Cloudinary, Vercel Blob

### ADR-015: Email Service
**Context:** Transactional emails (welcome, reset password)
**Options:** SendGrid, Resend, AWS SES

### ADR-016: Feature Flags
**Context:** Gradual rollout, A/B testing
**Options:** LaunchDarkly, Split.io, custom

### ADR-017: Background Jobs
**Context:** Async tasks (email sending, analytics)
**Options:** BullMQ, Inngest, Vercel Cron

---

## Revisiting Decisions

Architecture decisions should be revisited:
- **Quarterly:** Review performance metrics
- **When scale changes:** 10x user growth
- **When tech evolves:** New tools/patterns emerge

Process:
1. Gather data (metrics, team feedback)
2. Identify pain points
3. Propose alternatives
4. Document new ADR
5. Plan migration if needed

---

*Architecture is an ongoing conversation. These ADRs capture our thinking at a point in time.*
