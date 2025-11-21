import { NextRequest, NextResponse } from 'next/server';
import { chooseLoop, compose, assignExperiment } from '@10x-k-factor/agents';
import { z } from 'zod';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { ValidationError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:agents:decide');

const schema = z.object({
  userId: z.string().uuid(),
  event: z.string().min(1),
  persona: z.enum(['student', 'parent', 'tutor']),
  subject: z.string().optional(),
  cooldowns: z.record(z.number()).optional(),
  enableExperiments: z.boolean().optional().default(false),
});

export type AgentDecisionRequest = z.infer<typeof schema>;

export interface AgentDecisionResponse {
  loop: string;
  copy: string;
  reward_preview: string | null;
  deep_link_params: Record<string, string>;
  eligibility_reason?: string;
  experiment?: {
    id: string;
    variant: string;
    exposure_id: string;
  };
}

/**
 * Unified agent endpoint that orchestrates all agent decisions in a single call.
 *
 * This endpoint combines:
 * 1. Orchestrator: Chooses which viral loop to present
 * 2. Personalization: Generates personalized copy and rewards
 * 3. Experiment: (Optional) Assigns A/B test variants
 *
 * Benefits:
 * - Single network call instead of 3 separate calls
 * - Atomic decision-making with consistent state
 * - Easier to cache and monitor
 * - Better error handling and logging
 *
 * @example
 * POST /api/agents/decide
 * {
 *   "userId": "123e4567-e89b-12d3-a456-426614174000",
 *   "event": "results_viewed",
 *   "persona": "student",
 *   "subject": "algebra",
 *   "cooldowns": { "buddy_challenge": 12 }
 * }
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const startTime = Date.now();

    // Parse and validate request
    let validated: AgentDecisionRequest;
    try {
      const body = await request.json();
      validated = schema.parse(body);
    } catch (error) {
      log.warn({ error }, 'Invalid agent decision request');
      throw new ValidationError('Invalid request body');
    }

    log.debug({
      userId: validated.userId,
      event: validated.event,
      persona: validated.persona,
      subject: validated.subject,
    }, 'Processing agent decision');

    // Step 1: Orchestrator - Choose viral loop
    const loopDecision = chooseLoop({
      event: validated.event,
      persona: validated.persona,
      subject: validated.subject,
      cooldowns: validated.cooldowns || {},
    });

    log.debug({
      loop: loopDecision.loop,
      eligibility_reason: loopDecision.eligibility_reason,
    }, 'Orchestrator selected loop');

    // Step 2: Personalization - Generate copy and rewards
    const personalization = compose({
      intent: validated.event,
      persona: validated.persona,
      subject: validated.subject,
      loop: loopDecision.loop,
    });

    log.debug({
      copyLength: personalization.copy.length,
      hasReward: !!personalization.reward_preview,
    }, 'Personalization generated');

    // Step 3: (Optional) Experiment - Assign variant
    let experiment: AgentDecisionResponse['experiment'] | undefined;
    if (validated.enableExperiments) {
      const experimentAssignment = assignExperiment({
        userId: validated.userId,
        experimentId: `${loopDecision.loop}_v1`,
        variants: [
          { name: 'control', traffic: 0.5 },
          { name: 'treatment', traffic: 0.5 },
        ],
      });

      experiment = {
        id: `${loopDecision.loop}_v1`,
        variant: experimentAssignment.variant,
        exposure_id: experimentAssignment.exposure_id,
      };

      log.debug({ experiment }, 'Experiment variant assigned');
    }

    const duration = Date.now() - startTime;

    log.info({
      userId: validated.userId,
      loop: loopDecision.loop,
      persona: validated.persona,
      duration,
    }, 'Agent decision completed');

    const response: AgentDecisionResponse = {
      loop: loopDecision.loop,
      copy: personalization.copy,
      reward_preview: personalization.reward_preview,
      deep_link_params: personalization.deep_link_params,
      eligibility_reason: loopDecision.eligibility_reason,
      experiment,
    };

    return NextResponse.json(response);
  });
}
