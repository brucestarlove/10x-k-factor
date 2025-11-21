'use server';

import { auth } from '@/lib/auth';
import { db } from '@/db';
import { challenges, results } from '@/db/learning-schema';
import { eq, and } from 'drizzle-orm';
import { trackXpEvent } from '@/lib/xp';
import { invalidateLeaderboardCache } from '@/lib/leaderboard';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import { UnauthorizedError, NotFoundError, ForbiddenError, ValidationError } from '@/lib/errors';

const log = createLogger('actions:challenges');

// ============================================================================
// Validation Schemas
// ============================================================================

const completeChallengeSchema = z.object({
  challengeId: z.string().uuid('Invalid challenge ID format'),
  score: z.number().int('Score must be an integer').min(0, 'Score must be at least 0').max(100, 'Score cannot exceed 100'),
  answers: z.record(z.number()).optional(),
});

const updateChallengeStatusSchema = z.object({
  challengeId: z.string().uuid('Invalid challenge ID format'),
  status: z.enum(['pending', 'active', 'completed', 'expired']),
});

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Complete a challenge and award XP to the user.
 *
 * This Server Action:
 * 1. Validates user authentication
 * 2. Checks challenge ownership
 * 3. Updates challenge status and score
 * 4. Creates a result record
 * 5. Tracks XP event (bonus for perfect score)
 * 6. Invalidates leaderboard cache
 * 7. Revalidates relevant pages
 *
 * @param input Challenge completion data
 * @returns Success status and score
 *
 * @example
 * ```typescript
 * const result = await completeChallenge({
 *   challengeId: 'abc-123',
 *   score: 100,
 *   answers: { 0: 1, 1: 2, 2: 0 }
 * });
 * ```
 */
export async function completeChallenge(
  input: z.infer<typeof completeChallengeSchema>
) {
  const startTime = Date.now();

  try {
    // 1. Validate authentication
    const session = await auth();
    if (!session?.user?.id) {
      log.warn('Unauthorized challenge completion attempt');
      throw new UnauthorizedError('You must be logged in to complete challenges');
    }

    // 2. Validate input
    let validated: z.infer<typeof completeChallengeSchema>;
    try {
      validated = completeChallengeSchema.parse(input);
    } catch (error) {
      log.warn({ error, input }, 'Invalid challenge completion input');
      throw new ValidationError('Invalid challenge completion data');
    }

    const { challengeId, score, answers } = validated;
    const userId = session.user.id;

    log.info({ challengeId, userId, score }, 'Processing challenge completion');

    // 3. Fetch and validate challenge
    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);

    if (!challenge) {
      log.warn({ challengeId }, 'Challenge not found');
      throw new NotFoundError('Challenge', challengeId);
    }

    // 4. Check ownership
    // User can complete if they are either the challenge owner OR the invited user
    const isOwner = challenge.userId === userId;
    const isInvited = challenge.invitedUserId === userId;

    if (!isOwner && !isInvited) {
      log.warn({
        challengeId,
        userId,
        challengeUserId: challenge.userId,
        invitedUserId: challenge.invitedUserId,
      }, 'User not authorized to complete this challenge');
      throw new ForbiddenError('You are not authorized to complete this challenge');
    }

    // 5. Check if already completed
    if (challenge.status === 'completed') {
      log.warn({ challengeId, userId }, 'Challenge already completed');
      throw new ValidationError('This challenge has already been completed');
    }

    // 6. Update challenge record
    await db
      .update(challenges)
      .set({
        status: 'completed',
        score,
        completedAt: new Date(),
        metadata: {
          ...(challenge.metadata || {}),
          answers,
          completedBy: userId,
          completedAt: new Date().toISOString(),
        },
      })
      .where(eq(challenges.id, challengeId));

    log.debug({ challengeId, score }, 'Challenge record updated');

    // 7. Create result record for leaderboard
    await db.insert(results).values({
      id: crypto.randomUUID(),
      userId,
      subject: challenge.subject,
      score,
      metadata: {
        challengeId,
        difficulty: challenge.difficulty,
        loop: challenge.loop,
      },
      createdAt: new Date(),
    });

    log.debug({ challengeId, subject: challenge.subject }, 'Result record created');

    // 8. Calculate and track XP
    // Base XP: 10 points + (score / 10) rounded down
    // Perfect score bonus: +50 XP
    const isPerfect = score === 100;
    const baseXp = Math.max(10, Math.floor(score / 10));
    const bonusXp = isPerfect ? 50 : 0;
    const totalXp = baseXp + bonusXp;

    await trackXpEvent({
      userId,
      personaType: 'student',
      eventType: isPerfect ? 'challenge.perfect' : 'challenge.completed',
      referenceId: challengeId,
      metadata: {
        subject: challenge.subject,
        score,
        difficulty: challenge.difficulty,
      },
      rawXp: totalXp,
    });

    log.info({
      challengeId,
      userId,
      score,
      isPerfect,
      xpAwarded: totalXp,
    }, 'XP event tracked');

    // 9. Invalidate leaderboard cache for this subject
    await invalidateLeaderboardCache(challenge.subject);

    // 10. Revalidate relevant pages
    revalidatePath('/app/challenges');
    revalidatePath(`/challenge/${challengeId}`);
    revalidatePath('/app/leaderboard');
    revalidatePath(`/app/leaderboard/${challenge.subject}`);

    const duration = Date.now() - startTime;

    log.info({
      challengeId,
      userId,
      score,
      xpAwarded: totalXp,
      duration,
    }, 'Challenge completion successful');

    return {
      success: true,
      score,
      xpAwarded: totalXp,
      isPerfect,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    log.error({
      error,
      challengeId: input.challengeId,
      duration,
    }, 'Challenge completion failed');

    // Re-throw known errors
    if (error instanceof UnauthorizedError ||
        error instanceof NotFoundError ||
        error instanceof ForbiddenError ||
        error instanceof ValidationError) {
      throw error;
    }

    // Wrap unknown errors
    throw new Error('Failed to complete challenge. Please try again.');
  }
}

/**
 * Update challenge status (admin or system use).
 *
 * This is useful for marking challenges as expired or activating them.
 *
 * @param input Status update data
 * @returns Success status
 *
 * @example
 * ```typescript
 * await updateChallengeStatus({
 *   challengeId: 'abc-123',
 *   status: 'expired'
 * });
 * ```
 */
export async function updateChallengeStatus(
  input: z.infer<typeof updateChallengeStatusSchema>
) {
  try {
    // 1. Validate authentication
    const session = await auth();
    if (!session?.user?.id) {
      log.warn('Unauthorized status update attempt');
      throw new UnauthorizedError('You must be logged in to update challenges');
    }

    // 2. Validate input
    let validated: z.infer<typeof updateChallengeStatusSchema>;
    try {
      validated = updateChallengeStatusSchema.parse(input);
    } catch (error) {
      log.warn({ error, input }, 'Invalid status update input');
      throw new ValidationError('Invalid status update data');
    }

    const { challengeId, status } = validated;
    const userId = session.user.id;

    log.info({ challengeId, userId, status }, 'Updating challenge status');

    // 3. Fetch and validate challenge
    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);

    if (!challenge) {
      log.warn({ challengeId }, 'Challenge not found');
      throw new NotFoundError('Challenge', challengeId);
    }

    // 4. Check ownership
    if (challenge.userId !== userId && challenge.invitedUserId !== userId) {
      log.warn({ challengeId, userId }, 'User not authorized to update this challenge');
      throw new ForbiddenError('You are not authorized to update this challenge');
    }

    // 5. Update status
    await db
      .update(challenges)
      .set({ status })
      .where(eq(challenges.id, challengeId));

    log.info({ challengeId, status }, 'Challenge status updated');

    // 6. Revalidate pages
    revalidatePath('/app/challenges');
    revalidatePath(`/challenge/${challengeId}`);

    return { success: true };
  } catch (error) {
    log.error({ error, challengeId: input.challengeId }, 'Status update failed');

    if (error instanceof UnauthorizedError ||
        error instanceof NotFoundError ||
        error instanceof ForbiddenError ||
        error instanceof ValidationError) {
      throw error;
    }

    throw new Error('Failed to update challenge status. Please try again.');
  }
}
