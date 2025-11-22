import { db } from "@/db/index";
import { results } from "@/db/learning-schema";
import { users } from "@/db/auth-schema";
import { sql, eq, and, desc } from "drizzle-orm";
import { getCached, invalidateCachePattern, CacheTTL } from "@/lib/cache";
import { createLogger } from "@/lib/logger";

const log = createLogger('lib:leaderboard');

/**
 * Validate and sanitize subject
 */
function validateSubject(subject: unknown): string | null {
  if (typeof subject !== "string") {
    return null;
  }
  if (subject.length === 0 || subject.length > 64) {
    return null;
  }
  // Allow alphanumeric, hyphens, spaces
  if (!/^[a-zA-Z0-9\-\s]+$/.test(subject)) {
    return null;
  }
  return subject.trim();
}

export interface LeaderboardEntry {
  userId: string;
  userName: string | null;
  score: number;
  rank: number;
}

/**
 * Increment leaderboard score for a user in a subject
 *
 * @deprecated Leaderboard scores are now calculated from the results table.
 * This function is kept for backward compatibility but does nothing.
 * Scores are automatically calculated when querying the leaderboard.
 *
 * @param subject - Subject name (e.g., "algebra", "geometry")
 * @param userId - User ID to increment score for
 * @param score - Score increment (default: 1)
 * @returns Always returns null (no-op)
 */
export async function incrementLeaderboard(
  subject: string,
  userId: string,
  _score: number = 1
): Promise<number | null> {
  // No-op: leaderboard scores are now calculated from results table
  // Parameters are kept for backward compatibility but unused
  console.log(
    "[leaderboard] incrementLeaderboard called but scores are now calculated from results table",
    { subject, userId }
  );
  return null;
}

/**
 * Get leaderboard for a subject
 * Returns top N entries ordered by score (descending)
 * Scores are calculated from the results table (AVG of scores per user)
 *
 * Results are cached for 5 minutes to reduce database load.
 * Cache is automatically invalidated when new results are added.
 *
 * @param subject - Subject name
 * @param limit - Number of entries to return (default: 10)
 * @returns Array of leaderboard entries with rank, userId, userName, and score
 */
export async function getLeaderboard(
  subject: string,
  limit: number = 10
): Promise<LeaderboardEntry[]> {
  const validatedSubject = validateSubject(subject);
  if (!validatedSubject) {
    log.warn({ subject }, 'Invalid subject, returning empty leaderboard');
    return [];
  }

  const cacheKey = `leaderboard:${validatedSubject}:${limit}`;

  try {
    return await getCached(
      cacheKey,
      async () => {
        log.debug({ subject: validatedSubject, limit }, 'Fetching leaderboard from database');

        // Query leaderboard using Postgres
        // Score = AVG(score) of results per user for the subject
        // Rank calculated in JavaScript after ordering
        const leaderboardData = await db
          .select({
            userId: results.userId,
            userName: users.name,
            score: sql<number>`COALESCE(AVG(${results.score})::integer, 0)`.as("score"),
          })
          .from(results)
          .innerJoin(users, eq(results.userId, users.id))
          .where(
            and(
              eq(results.subject, validatedSubject),
              sql`${results.subject} IS NOT NULL`,
              sql`${results.score} IS NOT NULL`
            )
          )
          .groupBy(results.userId, users.name)
          .orderBy(desc(sql`AVG(${results.score})`))
          .limit(limit);

        // Calculate ranks (1-based, with ties getting the same rank)
        return leaderboardData.map((entry, index) => {
          // If scores are tied with previous entry, use the same rank
          const prevEntry = index > 0 ? leaderboardData[index - 1] : null;
          let rank: number;

          if (prevEntry && prevEntry.score === entry.score) {
            // Find the first entry with this score to get the correct rank
            const firstIndexWithScore = leaderboardData.findIndex(
              (e) => e.score === entry.score
            );
            rank = firstIndexWithScore + 1;
          } else {
            rank = index + 1;
          }

          return {
            userId: entry.userId,
            userName: entry.userName,
            score: entry.score,
            rank,
          };
        });
      },
      CacheTTL.LEADERBOARD
    );
  } catch (error) {
    log.error({ error, subject: validatedSubject }, 'Failed to get leaderboard');
    return [];
  }
}

/**
 * Get a user's rank and score for a subject
 * Calculates rank by counting how many users have higher average scores
 *
 * Results are cached for 1 minute to reduce database load.
 * Cache is automatically invalidated when new results are added.
 *
 * @param subject - Subject name
 * @param userId - User ID
 * @returns Rank and score, or null if not found
 */
export async function getUserRank(
  subject: string,
  userId: string
): Promise<{ rank: number; score: number } | null> {
  const validatedSubject = validateSubject(subject);
  if (!validatedSubject) {
    return null;
  }

  const cacheKey = `user_rank:${validatedSubject}:${userId}`;

  try {
    return await getCached(
      cacheKey,
      async () => {
        log.debug({ subject: validatedSubject, userId }, 'Fetching user rank from database');

        // Get user's score (average of results)
        const userScoreData = await db
          .select({
            score: sql<number>`COALESCE(AVG(${results.score})::integer, 0)`.as("score"),
          })
          .from(results)
          .where(
            and(
              eq(results.userId, userId),
              eq(results.subject, validatedSubject),
              sql`${results.subject} IS NOT NULL`,
              sql`${results.score} IS NOT NULL`
            )
          )
          .groupBy(results.userId);

        if (!userScoreData || userScoreData.length === 0) {
          return null;
        }

        const userScore = userScoreData[0].score;

        // Calculate rank by counting distinct users with higher average scores
        const rankResult = await db.execute(sql`
          SELECT COUNT(DISTINCT r.user_id)::integer + 1 as rank
          FROM results r
          WHERE r.subject = ${validatedSubject}
            AND r.subject IS NOT NULL
            AND r.score IS NOT NULL
            AND r.user_id != ${userId}
          GROUP BY r.user_id
          HAVING AVG(r.score) > ${userScore}
        `);

        const rank = (rankResult as unknown as { rank: number }[])?.[0]?.rank ?? 1;

        return {
          rank,
          score: userScore,
        };
      },
      CacheTTL.USER_XP
    );
  } catch (error) {
    log.error({ error, subject: validatedSubject, userId }, 'Failed to get user rank');
    return null;
  }
}

/**
 * Invalidate all cached leaderboards for a subject.
 *
 * Call this function whenever new results are added or updated for a subject
 * to ensure users see fresh leaderboard data.
 *
 * This invalidates:
 * - All leaderboard caches for the subject (different limits)
 * - All user rank caches for the subject
 *
 * @param subject - Subject name
 * @returns Number of cache keys invalidated
 *
 * @example
 * ```typescript
 * // After adding a new result
 * await db.insert(results).values({ userId, subject: 'algebra', score: 95 });
 * await invalidateLeaderboardCache('algebra');
 * ```
 */
export async function invalidateLeaderboardCache(subject: string): Promise<number> {
  const validatedSubject = validateSubject(subject);
  if (!validatedSubject) {
    return 0;
  }

  log.debug({ subject: validatedSubject }, 'Invalidating leaderboard cache');

  // Invalidate all leaderboard variants (different limits)
  const leaderboardCount = await invalidateCachePattern(`leaderboard:${validatedSubject}:*`);

  // Invalidate all user ranks for this subject
  const rankCount = await invalidateCachePattern(`user_rank:${validatedSubject}:*`);

  const totalInvalidated = leaderboardCount + rankCount;

  log.info({
    subject: validatedSubject,
    leaderboardCount,
    rankCount,
    total: totalInvalidated
  }, 'Leaderboard cache invalidated');

  return totalInvalidated;
}
