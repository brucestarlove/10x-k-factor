import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { challenges } from "@/db/schema/index";
import { eq } from "drizzle-orm";
import { trackXpEvent } from "@/lib/xp";
import type { Persona } from "@/db/types";
import { withErrorHandler } from "@/lib/middleware/error-handler";
import { NotFoundError, UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";

const log = createLogger('api:challenges');

/**
 * Get a specific challenge by ID
 * GET /api/challenges/[id]
 *
 * Public endpoint (no auth required) - allows guests to view challenges
 * Does NOT expose userId or any PII
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withErrorHandler(async () => {
    const { id: challengeId } = await params;

    log.debug({ challengeId }, 'Fetching challenge');

    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);

    if (!challenge) {
      log.warn({ challengeId }, 'Challenge not found');
      throw new NotFoundError('Challenge', challengeId);
    }

    // Return challenge WITHOUT userId (no PII)
    // Safe fields: id, subject, difficulty, questions, expiresAt, createdAt
    const safeChallenge = {
      id: challenge.id,
      subject: challenge.subject,
      difficulty: challenge.difficulty,
      questions: challenge.questions,
      expiresAt: challenge.expiresAt,
      createdAt: challenge.createdAt,
      // Internal use - not exposed to client but needed for backend logic
      userId: challenge.userId,
    };

    log.info({ challengeId, subject: challenge.subject }, 'Challenge fetched successfully');

    return NextResponse.json(safeChallenge);
  });
}

/**
 * Update challenge (for marking as complete)
 * PATCH /api/challenges/[id]
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withErrorHandler(async () => {
    const session = await auth();
    if (!session?.user?.id) {
      log.warn('Unauthorized challenge update attempt');
      throw new UnauthorizedError();
    }

    const { id: challengeId } = await params;
    const body = await req.json();
    const { status, score } = body;

    log.debug(
      { challengeId, userId: session.user.id, status, score },
      'Updating challenge'
    );

    // Verify the challenge belongs to the user
    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);

    if (!challenge) {
      log.warn({ challengeId }, 'Challenge not found for update');
      throw new NotFoundError('Challenge', challengeId);
    }

    if (challenge.userId !== session.user.id) {
      log.warn(
        { challengeId, userId: session.user.id, ownerId: challenge.userId },
        'Forbidden challenge update attempt'
      );
      throw new ForbiddenError('You do not own this challenge');
    }

    // Update challenge
    const updates: Partial<typeof challenge> = {};

    if (status) {
      updates.status = status;
    }

    if (score !== undefined) {
      updates.score = score;
    }

    if (status === "completed") {
      updates.completedAt = new Date();
    }

    await db
      .update(challenges)
      .set(updates)
      .where(eq(challenges.id, challengeId));

    // Fetch updated challenge
    const [updatedChallenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);

    // Create XP event when challenge is completed
    if (status === "completed" && score !== undefined) {
      // Determine the user's persona (default to 'student' for challenges)
      const userPersona: Persona = "student";

      // Determine event type based on score
      const isPerfect = score === 100;
      const eventType = isPerfect ? "challenge.perfect" : "challenge.completed";

      // Calculate raw XP based on score (higher score = more XP)
      const rawXp = isPerfect ? 50 : Math.max(10, Math.floor(score / 10));

      try {
        await trackXpEvent({
          userId: session.user.id,
          personaType: userPersona,
          eventType,
          referenceId: challengeId,
          metadata: {
            subject: challenge.subject,
            score,
          },
          rawXp,
        });

        log.info(
          {
            challengeId,
            userId: session.user.id,
            score,
            rawXp,
            eventType
          },
          'XP event tracked for challenge completion'
        );
      } catch (xpError) {
        log.error(
          { error: xpError, challengeId, userId: session.user.id },
          'Failed to track XP event'
        );
        // Don't fail the whole request if XP tracking fails
      }
    }

    log.info(
      { challengeId, userId: session.user.id, status, score },
      'Challenge updated successfully'
    );

    return NextResponse.json(updatedChallenge);
  });
}
