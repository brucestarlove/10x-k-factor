import type { AgentDecisionRequest, AgentDecisionResponse } from '@/app/api/agents/decide/route';
import { createLogger } from '@/lib/logger';

const log = createLogger('lib:agents');

/**
 * Default fallback response when agent service is unavailable
 */
const DEFAULT_FALLBACK: AgentDecisionResponse = {
  loop: 'buddy_challenge',
  copy: 'Check this out! 🎯',
  reward_preview: null,
  deep_link_params: {},
  eligibility_reason: 'fallback_timeout',
};

/**
 * Timeout for agent decision requests (200ms)
 * If the agent service doesn't respond in time, we fall back to defaults
 */
const AGENT_TIMEOUT_MS = 200;

/**
 * Get viral loop decision from the unified agent endpoint.
 *
 * This function calls the /api/agents/decide endpoint which orchestrates
 * all agent decisions (orchestrator, personalization, experiments) in a
 * single atomic operation.
 *
 * Features:
 * - Fast timeout (200ms) with automatic fallback
 * - Comprehensive error handling
 * - Structured logging
 * - Type-safe request/response
 *
 * @param params Agent decision parameters
 * @returns Agent decision with loop, copy, rewards, and deep links
 *
 * @example
 * ```typescript
 * const decision = await getViralDecision({
 *   userId: user.id,
 *   event: 'results_viewed',
 *   persona: 'student',
 *   subject: 'algebra',
 *   cooldowns: { buddy_challenge: 12 }
 * });
 *
 * console.log(decision.loop); // 'results_rally'
 * console.log(decision.copy); // 'Amazing work on algebra! Share your success!'
 * ```
 */
export async function getViralDecision(
  params: Omit<AgentDecisionRequest, 'enableExperiments'> & {
    enableExperiments?: boolean;
  }
): Promise<AgentDecisionResponse> {
  const startTime = Date.now();

  try {
    log.debug({
      userId: params.userId,
      event: params.event,
      persona: params.persona,
    }, 'Requesting agent decision');

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

    try {
      const response = await fetch('/api/agents/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        log.warn({
          status: response.status,
          error: errorText,
          userId: params.userId,
        }, 'Agent decision request failed');

        return DEFAULT_FALLBACK;
      }

      const decision: AgentDecisionResponse = await response.json();

      const duration = Date.now() - startTime;
      log.info({
        userId: params.userId,
        loop: decision.loop,
        duration,
      }, 'Agent decision received');

      return decision;
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        log.warn({
          userId: params.userId,
          timeout: AGENT_TIMEOUT_MS,
        }, 'Agent decision timed out, using fallback');
      } else {
        log.error({
          error: fetchError,
          userId: params.userId,
        }, 'Agent decision fetch failed');
      }

      return DEFAULT_FALLBACK;
    }
  } catch (error) {
    log.error({
      error,
      userId: params.userId,
    }, 'Unexpected error in getViralDecision');

    return DEFAULT_FALLBACK;
  }
}

/**
 * Get viral decision for server-side use (Server Components, Server Actions).
 *
 * This version constructs the full URL and works in server contexts where
 * relative URLs are not available.
 *
 * @param params Agent decision parameters
 * @param baseUrl Base URL for the API (e.g., from headers or env)
 * @returns Agent decision with loop, copy, rewards, and deep links
 */
export async function getViralDecisionServer(
  params: Omit<AgentDecisionRequest, 'enableExperiments'> & {
    enableExperiments?: boolean;
  },
  baseUrl: string
): Promise<AgentDecisionResponse> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

    try {
      const url = new URL('/api/agents/decide', baseUrl);
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return DEFAULT_FALLBACK;
      }

      return await response.json();
    } catch (fetchError) {
      clearTimeout(timeoutId);
      return DEFAULT_FALLBACK;
    }
  } catch (error) {
    return DEFAULT_FALLBACK;
  }
}

/**
 * Preload viral decision (for React Suspense or eager loading).
 *
 * This can be called early in the component tree to start fetching
 * the decision before it's actually needed.
 *
 * @param params Agent decision parameters
 */
export function preloadViralDecision(
  params: Omit<AgentDecisionRequest, 'enableExperiments'> & {
    enableExperiments?: boolean;
  }
): void {
  void getViralDecision(params);
}
