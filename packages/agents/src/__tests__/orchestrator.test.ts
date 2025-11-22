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
      expect(result.features_used).toContain('event:results_viewed');
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

    it('selects buddy_challenge when cooldown period is satisfied', () => {
      const result = chooseLoop({
        event: 'results_viewed',
        persona: 'student',
        cooldowns: { buddy_challenge_hours: 24 }
      });

      expect(result.loop).toBe('buddy_challenge');
      expect(result.eligibility_reason).toBe('cooldown_ok');
    });

    it('uses default fallback for unknown events', () => {
      const result = chooseLoop({
        event: 'unknown_event',
        persona: 'student',
        cooldowns: {}
      });

      expect(result.loop).toBe('buddy_challenge');
      // Default fallback still returns cooldown_ok since there's no active cooldown
      expect(result.eligibility_reason).toBe('cooldown_ok');
    });

    it('selects buddy_challenge for session_complete event', () => {
      const result = chooseLoop({
        event: 'session_complete',
        persona: 'student',
        cooldowns: {}
      });

      expect(result.loop).toBe('buddy_challenge');
    });

    it('includes subject in rationale when provided', () => {
      const result = chooseLoop({
        event: 'results_viewed',
        persona: 'student',
        subject: 'algebra',
        cooldowns: {}
      });

      expect(result.rationale).toContain('algebra');
      expect(result.features_used).toContain('subject:algebra');
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
      expect(result.eligibility_reason).toBe('cooldown_ok');
    });

    it('falls back to results_rally when proud_parent is in cooldown', () => {
      const result = chooseLoop({
        event: 'results_viewed',
        persona: 'parent',
        cooldowns: { proud_parent_hours: 24 }
      });

      expect(result.loop).toBe('results_rally');
    });

    it('uses default fallback for session_complete (not eligible for parents)', () => {
      const result = chooseLoop({
        event: 'session_complete',
        persona: 'parent',
        cooldowns: {}
      });

      expect(result.loop).toBe('buddy_challenge');
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

    it('selects tutor_spotlight for results_viewed event', () => {
      const result = chooseLoop({
        event: 'results_viewed',
        persona: 'tutor',
        cooldowns: {}
      });

      expect(result.loop).toBe('tutor_spotlight');
    });

    it('falls back to results_rally when tutor_spotlight is in cooldown', () => {
      const result = chooseLoop({
        event: 'results_viewed',
        persona: 'tutor',
        cooldowns: { tutor_spotlight_hours: 36 }
      });

      expect(result.loop).toBe('results_rally');
    });
  });

  describe('Badge earned event', () => {
    it('selects results_rally for all personas', () => {
      const personas: Array<'student' | 'parent' | 'tutor'> = ['student', 'parent', 'tutor'];

      personas.forEach(persona => {
        const result = chooseLoop({
          event: 'badge_earned',
          persona,
          cooldowns: {}
        });

        expect(result.loop).toBe('results_rally');
      });
    });
  });

  describe('Cooldown logic', () => {
    it('respects cooldown period thresholds', () => {
      const testCases = [
        { cooldown: 0, expected: 'results_rally' }, // 0 < 24, so buddy_challenge not available
        { cooldown: 12, expected: 'results_rally' }, // 12 < 24, so buddy_challenge not available
        { cooldown: 24, expected: 'buddy_challenge' }, // 24 >= 24, available
        { cooldown: 30, expected: 'buddy_challenge' }, // 30 >= 24, available
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

    it('applies different cooldown periods for different loops', () => {
      // buddy_challenge: 24h
      // results_rally: 12h
      // proud_parent: 48h
      // tutor_spotlight: 72h

      const result1 = chooseLoop({
        event: 'results_viewed',
        persona: 'parent',
        cooldowns: { proud_parent_hours: 40 }
      });
      expect(result1.loop).toBe('results_rally');

      const result2 = chooseLoop({
        event: 'results_viewed',
        persona: 'parent',
        cooldowns: { proud_parent_hours: 48 }
      });
      expect(result2.loop).toBe('proud_parent');
    });
  });

  describe('Output structure', () => {
    it('returns all required fields', () => {
      const result = chooseLoop({
        event: 'results_viewed',
        persona: 'student',
        cooldowns: {}
      });

      expect(result).toHaveProperty('loop');
      expect(result).toHaveProperty('eligibility_reason');
      expect(result).toHaveProperty('rationale');
      expect(result).toHaveProperty('features_used');
      expect(result).toHaveProperty('ttl_ms');

      expect(Array.isArray(result.features_used)).toBe(true);
      expect(typeof result.ttl_ms).toBe('number');
    });

    it('includes proper TTL', () => {
      const result = chooseLoop({
        event: 'results_viewed',
        persona: 'student',
        cooldowns: {}
      });

      expect(result.ttl_ms).toBe(30000); // 30 seconds
    });
  });

  describe('Input validation', () => {
    it('validates input with Zod schema', () => {
      expect(() => {
        chooseLoop({
          event: 'results_viewed',
          persona: 'student',
          cooldowns: {}
        });
      }).not.toThrow();
    });

    it('handles missing optional fields', () => {
      const result = chooseLoop({
        event: 'results_viewed',
        persona: 'student',
      } as any);

      expect(result.loop).toBe('buddy_challenge');
    });
  });
});
