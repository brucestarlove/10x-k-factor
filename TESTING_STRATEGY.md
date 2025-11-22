# Testing Strategy
## 10X K-Factor Tutoring Platform

**Version:** 1.0.0
**Last Updated:** November 19, 2025

---

## Overview

This document outlines the comprehensive testing strategy for achieving 80%+ code coverage and ensuring production reliability for the 10X K-Factor platform.

---

## Testing Pyramid

```
         /\
        /  \  E2E Tests (10%)
       /----\
      /      \ Integration Tests (30%)
     /--------\
    /          \ Unit Tests (60%)
   /____________\
```

### Distribution
- **Unit Tests:** 60% - Fast, isolated tests of business logic
- **Integration Tests:** 30% - API routes, database interactions
- **E2E Tests:** 10% - Critical user journeys

---

## 1. Unit Tests

### 1.1 Agent System Tests

**File:** `packages/agents/src/__tests__/orchestrator.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { chooseLoop } from '../orchestrator.agent';

describe('Orchestrator Agent - Loop Selection', () => {
  describe('Student persona', () => {
    it('selects buddy_challenge for results_viewed event with no cooldown', () => {
      const result = chooseLoop({
        event: 'results_viewed',
        persona: 'student',
        cooldowns: {}
      });

      expect(result.loop).toBe('buddy_challenge');
      expect(result.eligibility_reason).toBe('cooldown_ok');
      expect(result.features_used).toContain('persona:student');
    });

    it('falls back to results_rally when buddy_challenge is in cooldown', () => {
      const result = chooseLoop({
        event: 'results_viewed',
        persona: 'student',
        cooldowns: { buddy_challenge_hours: 12 }
      });

      expect(result.loop).toBe('results_rally');
      expect(result.rationale).toContain('results_rally');
    });

    it('uses default fallback for unknown events', () => {
      const result = chooseLoop({
        event: 'unknown_event',
        persona: 'student',
        cooldowns: {}
      });

      expect(result.loop).toBe('buddy_challenge');
      expect(result.eligibility_reason).toContain('fallback');
    });
  });

  describe('Parent persona', () => {
    it('selects proud_parent for results_viewed event', () => {
      const result = chooseLoop({
        event: 'results_viewed',
        persona: 'parent',
        cooldowns: {}
      });

      expect(result.loop).toBe('proud_parent');
    });
  });

  describe('Tutor persona', () => {
    it('selects tutor_spotlight for session_complete event', () => {
      const result = chooseLoop({
        event: 'session_complete',
        persona: 'tutor',
        cooldowns: {}
      });

      expect(result.loop).toBe('tutor_spotlight');
    });
  });

  describe('Cooldown logic', () => {
    it('respects cooldown period thresholds', () => {
      const testCases = [
        { cooldown: 0, expected: 'buddy_challenge' },
        { cooldown: 12, expected: 'results_rally' },
        { cooldown: 24, expected: 'buddy_challenge' },
      ];

      testCases.forEach(({ cooldown, expected }) => {
        const result = chooseLoop({
          event: 'results_viewed',
          persona: 'student',
          cooldowns: { buddy_challenge_hours: cooldown }
        });

        expect(result.loop).toBe(expected);
      });
    });
  });
});
```

**File:** `packages/agents/src/__tests__/personalize.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { compose } from '../personalize.agent';

describe('Personalize Agent - Copy Generation', () => {
  it('generates student buddy_challenge copy with subject', () => {
    const result = compose({
      intent: 'share',
      persona: 'student',
      subject: 'algebra',
      loop: 'buddy_challenge'
    });

    expect(result.copy).toContain('algebra');
    expect(result.copy).toContain('Challenge me');
    expect(result.reward_preview?.type).toBe('streak_shield');
  });

  it('generates parent proud_parent copy', () => {
    const result = compose({
      intent: 'share',
      persona: 'parent',
      subject: 'geometry',
      loop: 'proud_parent'
    });

    expect(result.copy).toContain('geometry');
    expect(result.copy).toContain('proud');
    expect(result.reward_preview?.type).toBe('badge');
  });

  it('provides fallback copy for unknown loop', () => {
    const result = compose({
      intent: 'share',
      persona: 'student',
      loop: 'unknown_loop'
    });

    expect(result.copy).toBeTruthy();
    expect(result.copy.length).toBeGreaterThan(0);
  });

  it('includes deep link params', () => {
    const result = compose({
      intent: 'share',
      persona: 'student',
      subject: 'calculus',
      loop: 'results_rally'
    });

    expect(result.deep_link_params).toHaveProperty('loop', 'results_rally');
    expect(result.deep_link_params).toHaveProperty('subject', 'calculus');
  });
});
```

**File:** `packages/agents/src/__tests__/experiment.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { assignExperiment } from '../experiment.agent';

describe('Experiment Agent - Variant Assignment', () => {
  it('assigns users to variants deterministically', () => {
    const userId = 'user-123';
    const experimentName = 'test-experiment';

    const result1 = assignExperiment({
      user_id: userId,
      experiment_name: experimentName,
      experiment_config: {
        variants: ['control', 'variant_a']
      }
    });

    const result2 = assignExperiment({
      user_id: userId,
      experiment_name: experimentName,
      experiment_config: {
        variants: ['control', 'variant_a']
      }
    });

    expect(result1.variant).toBe(result2.variant);
    expect(result1.exposure_id).toBe(result2.exposure_id);
  });

  it('distributes users roughly evenly with equal splits', () => {
    const variants = ['control', 'variant_a', 'variant_b'];
    const assignments = new Map<string, number>();

    // Assign 1000 different users
    for (let i = 0; i < 1000; i++) {
      const result = assignExperiment({
        user_id: `user-${i}`,
        experiment_name: 'test',
        experiment_config: { variants }
      });

      assignments.set(result.variant, (assignments.get(result.variant) || 0) + 1);
    }

    // Each variant should get ~333 users (allow 10% variance)
    variants.forEach(variant => {
      const count = assignments.get(variant) || 0;
      expect(count).toBeGreaterThan(280);
      expect(count).toBeLessThan(380);
    });
  });

  it('respects custom traffic splits', () => {
    const variants = ['control', 'variant_a'];
    const assignments = new Map<string, number>();

    // 70/30 split
    for (let i = 0; i < 1000; i++) {
      const result = assignExperiment({
        user_id: `user-${i}`,
        experiment_name: 'test',
        experiment_config: {
          variants,
          traffic_splits: [0.7, 0.3]
        }
      });

      assignments.set(result.variant, (assignments.get(result.variant) || 0) + 1);
    });

    const controlCount = assignments.get('control') || 0;
    expect(controlCount).toBeGreaterThan(650);
    expect(controlCount).toBeLessThan(750);
  });

  it('throws error for invalid traffic splits', () => {
    expect(() => {
      assignExperiment({
        user_id: 'user-123',
        experiment_name: 'test',
        experiment_config: {
          variants: ['control', 'variant_a'],
          traffic_splits: [0.6, 0.5] // Sums to 1.1
        }
      });
    }).toThrow('Traffic splits must sum to 1.0');
  });
});
```

### 1.2 XP System Tests

**File:** `apps/web/lib/__tests__/xp.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { xpForLevel, levelFromXp, trackXpEvent, getUserXp } from '../xp';

describe('XP System - Level Calculations', () => {
  describe('xpForLevel', () => {
    it('calculates XP for level 1 correctly', () => {
      expect(xpForLevel(1)).toBe(100); // 40*1^2 + 60*1
    });

    it('calculates XP for level 5 correctly', () => {
      expect(xpForLevel(5)).toBe(1300); // 40*25 + 60*5
    });

    it('calculates XP for level 10 correctly', () => {
      expect(xpForLevel(10)).toBe(4600); // 40*100 + 60*10
    });

    it('uses custom base and step coefficients', () => {
      expect(xpForLevel(5, 50, 100)).toBe(1750); // 50*25 + 100*5
    });
  });

  describe('levelFromXp', () => {
    it('returns level 0 for 0 XP', () => {
      const result = levelFromXp(0);
      expect(result.level).toBe(0);
      expect(result.progress).toBe(0);
    });

    it('returns level 1 for 100 XP', () => {
      const result = levelFromXp(100);
      expect(result.level).toBe(1);
      expect(result.progress).toBe(0);
    });

    it('calculates progress correctly', () => {
      const result = levelFromXp(150); // Level 1 = 100, Level 2 = 240
      expect(result.level).toBe(1);
      expect(result.progress).toBeCloseTo(0.357, 2); // 50/140
    });

    it('handles exact level boundaries', () => {
      const level5Xp = xpForLevel(5);
      const result = levelFromXp(level5Xp);
      expect(result.level).toBe(5);
      expect(result.progress).toBe(0);
    });
  });
});

describe('XP System - Event Tracking', () => {
  // Use test database
  beforeEach(async () => {
    // Clear test data
  });

  afterEach(async () => {
    // Cleanup
  });

  it('tracks XP event successfully', async () => {
    const event = await trackXpEvent({
      userId: 'test-user-1',
      personaType: 'student',
      eventType: 'challenge.completed',
      referenceId: 'challenge-123',
      metadata: { subject: 'algebra', score: 85 },
      rawXp: 8
    });

    expect(event).toBeDefined();
    expect(event.userId).toBe('test-user-1');
    expect(event.rawXp).toBe(8);
  });

  it('accumulates XP from multiple events', async () => {
    const userId = 'test-user-2';

    await trackXpEvent({
      userId,
      personaType: 'student',
      eventType: 'challenge.completed',
      rawXp: 10
    });

    await trackXpEvent({
      userId,
      personaType: 'student',
      eventType: 'invite.sent',
      rawXp: 5
    });

    const totalXp = await getUserXp(userId);
    expect(totalXp).toBe(15);
  });
});
```

### 1.3 Reward System Tests

**File:** `apps/web/lib/__tests__/rewards-policies.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { getRewardPolicy, calculateTotalCost, getUnitCost } from '../rewards/policies';

describe('Reward Policies', () => {
  describe('getRewardPolicy', () => {
    it('returns correct policy for student on_fvm_complete', () => {
      const policy = getRewardPolicy('student', 'on_fvm_complete');

      expect(policy).toBeDefined();
      expect(policy?.type).toBe('ai_minutes');
      expect(policy?.amount).toBe(15);
      expect(policy?.unitCostCents).toBe(10);
    });

    it('returns correct policy for parent on_fvm_complete', () => {
      const policy = getRewardPolicy('parent', 'on_fvm_complete');

      expect(policy).toBeDefined();
      expect(policy?.type).toBe('badge');
      expect(policy?.unitCostCents).toBe(100);
    });

    it('returns null for parent on_send (no policy)', () => {
      const policy = getRewardPolicy('parent', 'on_send');

      expect(policy).toBeNull();
    });
  });

  describe('calculateTotalCost', () => {
    it('calculates cost for AI minutes correctly', () => {
      const cost = calculateTotalCost('ai_minutes', 15);
      expect(cost).toBe(150); // 15 * 10 cents
    });

    it('calculates cost for credits correctly', () => {
      const cost = calculateTotalCost('credits', 50);
      expect(cost).toBe(50); // 50 * 1 cent
    });

    it('calculates cost for badges correctly', () => {
      const cost = calculateTotalCost('badge', 1);
      expect(cost).toBe(100); // 1 * 100 cents
    });
  });

  describe('getUnitCost', () => {
    it('returns correct unit costs', () => {
      expect(getUnitCost('streak_shield')).toBe(50);
      expect(getUnitCost('ai_minutes')).toBe(10);
      expect(getUnitCost('badge')).toBe(100);
      expect(getUnitCost('credits')).toBe(1);
    });
  });
});
```

### 1.4 Smart Link Tests

**File:** `apps/web/lib/__tests__/smart-links.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createSmartLink } from '../smart-links/create';
import { verifySmartLink } from '../smart-links/signing';

describe('Smart Links', () => {
  beforeEach(() => {
    // Mock rate limit check
  });

  describe('createSmartLink', () => {
    it('creates a valid smart link', async () => {
      const result = await createSmartLink({
        inviterId: 'user-123',
        loop: 'buddy_challenge',
        params: { challengeId: 'challenge-456', subject: 'algebra' }
      });

      expect(result.code).toHaveLength(12);
      expect(result.url).toContain('/challenge/challenge-456');
      expect(result.url).toContain('?sl=');
    });

    it('generates unique codes', async () => {
      const link1 = await createSmartLink({
        inviterId: 'user-123',
        loop: 'buddy_challenge'
      });

      const link2 = await createSmartLink({
        inviterId: 'user-123',
        loop: 'buddy_challenge'
      });

      expect(link1.code).not.toBe(link2.code);
    });

    it('throws error when rate limit exceeded', async () => {
      // Mock rate limit to return exceeded
      await expect(
        createSmartLink({
          inviterId: 'user-spam',
          loop: 'buddy_challenge'
        })
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('verifySmartLink', () => {
    it('verifies valid smart link signature', async () => {
      const link = await createSmartLink({
        inviterId: 'user-123',
        loop: 'buddy_challenge'
      });

      // Fetch link from DB
      const dbLink = await db.select().from(smartLinks)
        .where(eq(smartLinks.code, link.code))
        .limit(1);

      const isValid = verifySmartLink(dbLink[0]);
      expect(isValid).toBe(true);
    });

    it('rejects tampered smart link', () => {
      const tamperedLink = {
        code: 'abc123def456',
        inviterId: 'user-123',
        loop: 'buddy_challenge',
        params: { challengeId: 'hacked' },
        sig: 'invalid-signature',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };

      const isValid = verifySmartLink(tamperedLink);
      expect(isValid).toBe(false);
    });

    it('rejects expired smart link', () => {
      const expiredLink = {
        code: 'abc123def456',
        inviterId: 'user-123',
        loop: 'buddy_challenge',
        params: null,
        sig: 'valid-sig',
        expiresAt: new Date(Date.now() - 1000) // Expired
      };

      const isValid = verifySmartLink(expiredLink);
      expect(isValid).toBe(false);
    });
  });
});
```

---

## 2. Integration Tests

### 2.1 Challenge Flow Tests

**File:** `apps/web/__tests__/integration/challenges-flow.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { testApiRoute } from '../helpers/api-test-helper';

describe('Challenge Flow Integration', () => {
  let testUser: { id: string; session: string };
  let challenge: { id: string };

  beforeEach(async () => {
    // Create test user and session
    testUser = await createTestUser({ persona: 'student' });
  });

  it('completes full challenge flow: create → get → complete', async () => {
    // 1. Create challenge
    const createRes = await testApiRoute('/api/challenges', {
      method: 'POST',
      session: testUser.session,
      body: {
        subject: 'algebra',
        difficulty: 'medium',
        questions: [
          {
            id: 'q1',
            text: 'What is 2 + 2?',
            type: 'multiple_choice',
            options: ['3', '4', '5'],
            correctAnswer: '4'
          }
        ]
      }
    });

    expect(createRes.status).toBe(201);
    challenge = createRes.body;

    // 2. Get challenge (as guest - public endpoint)
    const getRes = await testApiRoute(`/api/challenges/${challenge.id}`, {
      method: 'GET'
    });

    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(challenge.id);
    expect(getRes.body.userId).toBeUndefined(); // PII not exposed

    // 3. Complete challenge
    const completeRes = await testApiRoute(`/api/challenges/${challenge.id}`, {
      method: 'PATCH',
      session: testUser.session,
      body: {
        status: 'completed',
        score: 100
      }
    });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.status).toBe('completed');
    expect(completeRes.body.score).toBe(100);
    expect(completeRes.body.completedAt).toBeDefined();

    // 4. Verify XP was tracked
    const xpRes = await testApiRoute('/api/xp/balance', {
      method: 'GET',
      session: testUser.session
    });

    expect(xpRes.body.xp).toBeGreaterThan(0);
  });

  it('prevents completing another user\'s challenge', async () => {
    const otherUser = await createTestUser({ persona: 'student' });

    // Create challenge as user 1
    const createRes = await testApiRoute('/api/challenges', {
      method: 'POST',
      session: testUser.session,
      body: {
        subject: 'algebra',
        difficulty: 'easy',
        questions: [/* ... */]
      }
    });

    challenge = createRes.body;

    // Try to complete as user 2
    const completeRes = await testApiRoute(`/api/challenges/${challenge.id}`, {
      method: 'PATCH',
      session: otherUser.session,
      body: { status: 'completed', score: 85 }
    });

    expect(completeRes.status).toBe(403);
  });

  it('tracks XP correctly for perfect score', async () => {
    // Create and complete with perfect score
    const createRes = await testApiRoute('/api/challenges', {
      method: 'POST',
      session: testUser.session,
      body: {/* ... */}
    });

    await testApiRoute(`/api/challenges/${createRes.body.id}`, {
      method: 'PATCH',
      session: testUser.session,
      body: { status: 'completed', score: 100 }
    });

    // Check XP history
    const historyRes = await testApiRoute('/api/xp/history', {
      method: 'GET',
      session: testUser.session
    });

    const perfectEvent = historyRes.body.find(
      (e: any) => e.eventType === 'challenge.perfect'
    );

    expect(perfectEvent).toBeDefined();
    expect(perfectEvent.rawXp).toBe(50);
  });
});
```

### 2.2 Reward Grant Tests

**File:** `apps/web/__tests__/integration/rewards-grant.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { testApiRoute } from '../helpers/api-test-helper';

describe('Reward Grant Integration', () => {
  let testUser: { id: string; session: string };

  beforeEach(async () => {
    testUser = await createTestUser({ persona: 'student' });
  });

  it('grants reward successfully', async () => {
    const res = await testApiRoute('/api/rewards/grant', {
      method: 'POST',
      body: {
        userId: testUser.id,
        rewardType: 'ai_minutes',
        amount: 15,
        loop: 'buddy_challenge',
        dedupeKey: `test-${Date.now()}`,
        metadata: { test: true }
      }
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.rewardType).toBe('ai_minutes');
    expect(res.body.amount).toBe(15);
    expect(res.body.totalCostCents).toBe(150); // 15 * 10
  });

  it('enforces idempotency with dedupe key', async () => {
    const dedupeKey = `test-idempotent-${Date.now()}`;
    const rewardData = {
      userId: testUser.id,
      rewardType: 'ai_minutes' as const,
      amount: 15,
      loop: 'buddy_challenge',
      dedupeKey,
      metadata: {}
    };

    // First grant
    const res1 = await testApiRoute('/api/rewards/grant', {
      method: 'POST',
      body: rewardData
    });

    expect(res1.status).toBe(201);
    const rewardId1 = res1.body.rewardId;

    // Second grant with same dedupe key
    const res2 = await testApiRoute('/api/rewards/grant', {
      method: 'POST',
      body: rewardData
    });

    expect(res2.status).toBe(200);
    expect(res2.body.rewardId).toBe(rewardId1); // Same reward
    expect(res2.body.message).toContain('already granted');
  });

  it('validates reward type matches persona policy', async () => {
    const res = await testApiRoute('/api/rewards/grant', {
      method: 'POST',
      body: {
        userId: testUser.id,
        rewardType: 'badge', // Student should get ai_minutes
        loop: 'buddy_challenge',
        dedupeKey: `test-${Date.now()}`
      }
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('type mismatch');
  });

  it('creates ledger entry for granted reward', async () => {
    await testApiRoute('/api/rewards/grant', {
      method: 'POST',
      body: {
        userId: testUser.id,
        rewardType: 'ai_minutes',
        amount: 15,
        loop: 'buddy_challenge',
        dedupeKey: `test-${Date.now()}`
      }
    });

    // Check ledger
    const ledgerRes = await testApiRoute('/api/rewards/ledger', {
      method: 'GET',
      session: testUser.session
    });

    expect(ledgerRes.body.length).toBeGreaterThan(0);
    const entry = ledgerRes.body[0];
    expect(entry.type).toBe('reward_grant');
    expect(entry.totalCostCents).toBe(150);
  });
});
```

### 2.3 Viral Loop Tests

**File:** `apps/web/__tests__/integration/viral-loop.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { testApiRoute } from '../helpers/api-test-helper';
import { createSmartLink } from '@/lib/smart-links/create';

describe('Viral Loop Integration', () => {
  it('completes full viral flow: invite → open → join → reward', async () => {
    // 1. User creates a challenge
    const inviter = await createTestUser({ persona: 'student' });

    const challengeRes = await testApiRoute('/api/challenges', {
      method: 'POST',
      session: inviter.session,
      body: {
        subject: 'algebra',
        difficulty: 'medium',
        questions: [/* ... */]
      }
    });

    const challenge = challengeRes.body;

    // 2. User creates smart link
    const smartLink = await createSmartLink({
      inviterId: inviter.id,
      loop: 'buddy_challenge',
      params: { challengeId: challenge.id, subject: 'algebra' }
    });

    expect(smartLink.code).toBeDefined();

    // 3. Friend opens link (as guest)
    const openRes = await testApiRoute(
      `/api/attribution/track-joined?sl=${smartLink.code}`,
      { method: 'GET' }
    );

    expect(openRes.status).toBe(200);

    // 4. Guest completes challenge
    const guestCompleteRes = await testApiRoute('/api/challenges/guest/complete', {
      method: 'POST',
      body: {
        challengeId: challenge.id,
        score: 85,
        answers: [/* ... */],
        smartLinkCode: smartLink.code
      }
    });

    expect(guestCompleteRes.status).toBe(201);

    // 5. Guest converts to registered user
    const newUser = await testApiRoute('/api/auth/register', {
      method: 'POST',
      body: {
        email: 'friend@test.com',
        password: 'password123',
        name: 'Friend User'
      }
    });

    expect(newUser.status).toBe(201);

    // 6. Guest completions are converted
    const convertRes = await testApiRoute('/api/auth/convert-guest', {
      method: 'POST',
      session: newUser.body.session,
      body: {
        guestSessionId: guestCompleteRes.body.guestSessionId
      }
    });

    expect(convertRes.body.converted).toBe(true);

    // 7. Inviter receives reward
    const inviterRewardsRes = await testApiRoute('/api/rewards/balances', {
      method: 'GET',
      session: inviter.session
    });

    expect(inviterRewardsRes.body.ai_minutes).toBeGreaterThan(0);

    // 8. Referral is tracked
    const referralsRes = await testApiRoute('/api/referrals', {
      method: 'GET',
      session: inviter.session
    });

    expect(referralsRes.body.length).toBeGreaterThan(0);
    expect(referralsRes.body[0].inviteeId).toBe(newUser.body.userId);
  });
});
```

---

## 3. E2E Tests

### 3.1 Student Journey

**File:** `e2e/student-journey.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Student Journey', () => {
  test('complete user journey: signup → challenge → leaderboard → share', async ({ page }) => {
    // 1. Sign up
    await page.goto('/register');
    await page.fill('[name="email"]', 'student@test.com');
    await page.fill('[name="password"]', 'password123');
    await page.fill('[name="name"]', 'Test Student');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('/app');

    // 2. Complete onboarding
    await page.click('text=Student');
    await page.click('text=Continue');

    // 3. View available challenges
    await page.click('text=Challenges');
    await page.waitForSelector('[data-testid="challenge-list"]');

    // 4. Start a challenge
    await page.click('[data-testid="challenge-card"]:first-child');

    // 5. Answer questions
    await page.click('text=4'); // Assuming multiple choice
    await page.click('button:has-text("Submit")');

    // 6. See results
    await expect(page.locator('text=Congratulations')).toBeVisible();
    const scoreText = await page.locator('[data-testid="score"]').textContent();
    expect(scoreText).toContain('100');

    // 7. Check XP increased
    const xpBefore = await page.locator('[data-testid="xp-total"]').textContent();
    expect(Number(xpBefore)).toBeGreaterThan(0);

    // 8. View leaderboard
    await page.click('text=Leaderboard');
    await expect(page.locator('[data-testid="leaderboard-entry"]')).toBeVisible();

    // 9. Share challenge
    await page.click('[data-testid="share-button"]');
    await expect(page.locator('[data-testid="share-modal"]')).toBeVisible();

    const shareLink = await page.locator('[data-testid="share-link"]').inputValue();
    expect(shareLink).toContain('/sl/');
  });

  test('buddy interaction', async ({ page }) => {
    await loginAsStudent(page);

    // Open buddy
    await page.click('[data-testid="buddy-avatar"]');

    // Should show message
    await expect(page.locator('[data-testid="buddy-message"]')).toBeVisible();

    // Click on suggested action
    await page.click('[data-testid="buddy-action-button"]');

    // Modal opens
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });
});
```

### 3.2 Viral Sharing Flow

**File:** `e2e/viral-sharing.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Viral Sharing', () => {
  test('friend receives and completes shared challenge', async ({ browser }) => {
    // Create two browser contexts (two users)
    const inviterContext = await browser.newContext();
    const friendContext = await browser.newContext();

    const inviterPage = await inviterContext.newPage();
    const friendPage = await friendContext.newPage();

    // 1. Inviter creates and shares challenge
    await loginAsStudent(inviterPage);
    await inviterPage.goto('/app/challenges');
    await inviterPage.click('[data-testid="create-challenge"]');

    // Fill challenge details
    await inviterPage.fill('[name="subject"]', 'Algebra');
    await inviterPage.click('text=Create');

    // Share challenge
    await inviterPage.click('[data-testid="share-button"]');
    const shareLink = await inviterPage.locator('[data-testid="share-link"]').inputValue();

    // 2. Friend opens link (as guest)
    await friendPage.goto(shareLink);

    await expect(friendPage.locator('text=Challenge')).toBeVisible();

    // 3. Friend completes challenge as guest
    await friendPage.click('text=Start Challenge');
    await friendPage.click('[data-testid="answer-option"]');
    await friendPage.click('button:has-text("Submit")');

    // Prompted to sign up
    await expect(friendPage.locator('text=Sign up to save your progress')).toBeVisible();

    // 4. Friend signs up
    await friendPage.fill('[name="email"]', 'friend@test.com');
    await friendPage.fill('[name="password"]', 'password123');
    await friendPage.fill('[name="name"]', 'Friend User');
    await friendPage.click('button:has-text("Sign Up")');

    // 5. Verify completion was saved
    await friendPage.waitForURL('/app');
    await expect(friendPage.locator('text=Welcome back')).toBeVisible();

    // 6. Check inviter received reward
    await inviterPage.goto('/app/rewards');
    await expect(inviterPage.locator('text=+15 AI minutes')).toBeVisible();

    // Cleanup
    await inviterContext.close();
    await friendContext.close();
  });
});
```

---

## 4. Test Infrastructure

### 4.1 Setup Files

**File:** `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/web')
    }
  }
});
```

**File:** `tests/setup.ts`

```typescript
import { beforeAll, afterAll, afterEach } from 'vitest';
import { db } from '@/db';

// Set up test database
beforeAll(async () => {
  // Run migrations
  await db.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  // Additional setup
});

// Clean up after each test
afterEach(async () => {
  // Clear test data
  await db.execute('TRUNCATE TABLE challenges, xp_events, rewards CASCADE');
});

// Tear down
afterAll(async () => {
  await db.end();
});
```

### 4.2 Test Helpers

**File:** `tests/helpers/api-test-helper.ts`

```typescript
import { NextRequest } from 'next/server';

export async function testApiRoute(
  path: string,
  options: {
    method?: string;
    body?: any;
    session?: string;
    headers?: Record<string, string>;
  } = {}
) {
  const { method = 'GET', body, session, headers = {} } = options;

  const url = `http://localhost:3000${path}`;
  const request = new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...(session && { Cookie: `session=${session}` })
    },
    ...(body && { body: JSON.stringify(body) })
  });

  // Import and call the route handler
  const handler = await import(`@/app/api${path}/route`);
  const response = await handler[method](request);

  return {
    status: response.status,
    body: await response.json()
  };
}

export async function createTestUser(options: {
  persona?: 'student' | 'parent' | 'tutor';
  email?: string;
  minor?: boolean;
} = {}) {
  const { persona = 'student', email = `test-${Date.now()}@test.com`, minor = false } = options;

  const user = await db.insert(users).values({
    id: randomUUID(),
    email,
    password: await hash('password123', 10),
    name: 'Test User'
  }).returning();

  await db.insert(usersProfiles).values({
    userId: user[0].id,
    persona,
    minor
  });

  // Create session
  const session = await createSession(user[0].id);

  return {
    id: user[0].id,
    session: session.token
  };
}
```

---

## 5. CI/CD Integration

### 5.1 GitHub Actions Workflow

**File:** `.github/workflows/test.yml`

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run migrations
        run: pnpm drizzle:push
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db

      - name: Run unit tests
        run: pnpm test:unit
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm drizzle:push
      - run: pnpm test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm playwright install --with-deps

      - name: Build app
        run: pnpm build

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Upload E2E results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

### 5.2 Package Scripts

**Update:** `package.json`

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --coverage",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",
    "test:watch": "vitest watch",
    "test:ui": "vitest --ui"
  }
}
```

---

## 6. Coverage Goals

### Minimum Coverage Requirements

| Category | Target | Critical |
|----------|--------|----------|
| Overall | 80% | 90% |
| Agent System | 95% | 100% |
| Reward Logic | 90% | 95% |
| XP System | 90% | 95% |
| Smart Links | 85% | 90% |
| API Routes | 75% | 85% |

### Coverage Exclusions

- UI components (optional visual testing)
- Type definitions
- Configuration files
- Build scripts
- Demo/example code

---

## 7. Success Metrics

- [ ] 80%+ overall code coverage
- [ ] All critical paths have 90%+ coverage
- [ ] Zero flaky tests
- [ ] Test suite runs in under 5 minutes
- [ ] All tests pass in CI before merge
- [ ] Coverage reports on every PR

---

## Conclusion

This testing strategy provides a comprehensive approach to achieving production-ready quality. By following the testing pyramid and prioritizing critical business logic, we ensure reliability while maintaining development velocity.

**Next Steps:**
1. Set up Vitest and testing infrastructure
2. Write agent system tests (Week 1)
3. Add integration tests for API routes (Week 1-2)
4. Implement E2E tests for critical flows (Week 2)
5. Integrate with CI/CD pipeline
6. Monitor and maintain coverage targets

---

*Last Updated: November 19, 2025*
