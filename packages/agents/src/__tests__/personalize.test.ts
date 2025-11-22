import { describe, it, expect } from 'vitest';
import { compose } from '../personalize.agent';

describe('Personalize Agent - Copy Generation', () => {
  describe('Student persona', () => {
    it('generates buddy_challenge copy with subject', () => {
      const result = compose({
        intent: 'share',
        persona: 'student',
        subject: 'algebra',
        loop: 'buddy_challenge'
      });

      expect(result.copy).toContain('algebra');
      expect(result.copy).toContain('Challenge me');
      expect(result.reward_preview?.type).toBe('streak_shield');
      expect(result.reward_preview?.amount).toBe(1);
    });

    it('generates results_rally copy', () => {
      const result = compose({
        intent: 'share',
        persona: 'student',
        subject: 'geometry',
        loop: 'results_rally'
      });

      expect(result.copy).toContain('geometry');
      expect(result.copy).toContain('results');
      expect(result.reward_preview?.type).toBe('ai_minutes');
      expect(result.reward_preview?.amount).toBe(10);
    });

    it('handles missing subject with fallback copy', () => {
      const result = compose({
        intent: 'share',
        persona: 'student',
        loop: 'buddy_challenge'
      });

      expect(result.copy).toContain('practice');
      expect(result.copy).toBeTruthy();
    });
  });

  describe('Parent persona', () => {
    it('generates proud_parent copy with subject', () => {
      const result = compose({
        intent: 'share',
        persona: 'parent',
        subject: 'geometry',
        loop: 'proud_parent'
      });

      expect(result.copy).toContain('geometry');
      expect(result.copy).toContain('proud');
      expect(result.reward_preview?.type).toBe('badge');
      expect(result.reward_preview?.description).toBeTruthy();
    });

    it('generates results_rally copy', () => {
      const result = compose({
        intent: 'share',
        persona: 'parent',
        subject: 'calculus',
        loop: 'results_rally'
      });

      expect(result.copy).toContain('calculus');
      expect(result.copy).toContain('progress');
    });

    it('handles badge reward without amount', () => {
      const result = compose({
        intent: 'share',
        persona: 'parent',
        loop: 'proud_parent'
      });

      expect(result.reward_preview?.type).toBe('badge');
      expect(result.reward_preview?.amount).toBeUndefined();
    });
  });

  describe('Tutor persona', () => {
    it('generates tutor_spotlight copy', () => {
      const result = compose({
        intent: 'share',
        persona: 'tutor',
        subject: 'physics',
        loop: 'tutor_spotlight'
      });

      expect(result.copy).toContain('physics');
      expect(result.copy).toContain('challenge');
      expect(result.reward_preview?.type).toBe('credits');
      expect(result.reward_preview?.amount).toBe(50);
    });

    it('generates results_rally copy', () => {
      const result = compose({
        intent: 'share',
        persona: 'tutor',
        subject: 'chemistry',
        loop: 'results_rally'
      });

      expect(result.copy).toContain('chemistry');
      expect(result.copy).toContain('students');
    });
  });

  describe('Fallback copy', () => {
    it('provides fallback copy for unknown loop', () => {
      const result = compose({
        intent: 'share',
        persona: 'student',
        loop: 'unknown_loop'
      });

      expect(result.copy).toBeTruthy();
      expect(result.copy.length).toBeGreaterThan(0);
      expect(result.copy).toContain('unknown loop');
    });

    it('provides fallback copy for unknown persona-loop combination', () => {
      const result = compose({
        intent: 'share',
        persona: 'parent',
        loop: 'tutor_spotlight'
      });

      expect(result.copy).toBeTruthy();
      expect(result.copy).toContain('tutor spotlight');
    });
  });

  describe('Deep link params', () => {
    it('includes loop in deep link params', () => {
      const result = compose({
        intent: 'share',
        persona: 'student',
        subject: 'algebra',
        loop: 'buddy_challenge'
      });

      expect(result.deep_link_params).toHaveProperty('loop', 'buddy_challenge');
    });

    it('includes subject in deep link params when provided', () => {
      const result = compose({
        intent: 'share',
        persona: 'student',
        subject: 'calculus',
        loop: 'results_rally'
      });

      expect(result.deep_link_params).toHaveProperty('subject', 'calculus');
      expect(result.deep_link_params).toHaveProperty('loop', 'results_rally');
    });

    it('includes intent in deep link params', () => {
      const result = compose({
        intent: 'share_results',
        persona: 'student',
        loop: 'results_rally'
      });

      expect(result.deep_link_params).toHaveProperty('intent', 'share_results');
    });

    it('omits subject when not provided', () => {
      const result = compose({
        intent: 'share',
        persona: 'student',
        loop: 'buddy_challenge'
      });

      expect(result.deep_link_params).not.toHaveProperty('subject');
    });
  });

  describe('Reward previews', () => {
    it('includes correct reward preview for buddy_challenge', () => {
      const result = compose({
        intent: 'share',
        persona: 'student',
        loop: 'buddy_challenge'
      });

      expect(result.reward_preview).toEqual({
        type: 'streak_shield',
        amount: 1,
        description: 'Get a streak shield when your friend completes the challenge'
      });
    });

    it('includes correct reward preview for results_rally', () => {
      const result = compose({
        intent: 'share',
        persona: 'student',
        loop: 'results_rally'
      });

      expect(result.reward_preview).toEqual({
        type: 'ai_minutes',
        amount: 10,
        description: 'Earn 10 AI tutor minutes when someone joins'
      });
    });

    it('includes correct reward preview for proud_parent', () => {
      const result = compose({
        intent: 'share',
        persona: 'parent',
        loop: 'proud_parent'
      });

      expect(result.reward_preview?.type).toBe('badge');
      expect(result.reward_preview?.description).toContain('parent badge');
    });

    it('includes correct reward preview for tutor_spotlight', () => {
      const result = compose({
        intent: 'share',
        persona: 'tutor',
        loop: 'tutor_spotlight'
      });

      expect(result.reward_preview).toEqual({
        type: 'credits',
        amount: 50,
        description: 'Earn 50 credits for each student referral'
      });
    });
  });

  describe('Output structure', () => {
    it('returns all required fields', () => {
      const result = compose({
        intent: 'share',
        persona: 'student',
        subject: 'algebra',
        loop: 'buddy_challenge'
      });

      expect(result).toHaveProperty('copy');
      expect(result).toHaveProperty('deep_link_params');
      expect(result).toHaveProperty('reward_preview');
      expect(result).toHaveProperty('rationale');
      expect(result).toHaveProperty('features_used');
      expect(result).toHaveProperty('ttl_ms');
    });

    it('includes proper TTL', () => {
      const result = compose({
        intent: 'share',
        persona: 'student',
        loop: 'buddy_challenge'
      });

      expect(result.ttl_ms).toBe(60000); // 60 seconds
    });

    it('includes features_used array', () => {
      const result = compose({
        intent: 'share',
        persona: 'student',
        subject: 'algebra',
        loop: 'buddy_challenge'
      });

      expect(Array.isArray(result.features_used)).toBe(true);
      expect(result.features_used).toContain('persona:student');
      expect(result.features_used).toContain('intent:share');
      expect(result.features_used).toContain('loop:buddy_challenge');
      expect(result.features_used).toContain('subject:algebra');
    });

    it('includes template matching status in features_used', () => {
      const result1 = compose({
        intent: 'share',
        persona: 'student',
        loop: 'buddy_challenge'
      });

      expect(result1.features_used).toContain('template:matched');

      const result2 = compose({
        intent: 'share',
        persona: 'student',
        loop: 'unknown_loop'
      });

      expect(result2.features_used).toContain('template:fallback');
    });
  });

  describe('Rationale generation', () => {
    it('includes persona, intent, and loop in rationale', () => {
      const result = compose({
        intent: 'share',
        persona: 'student',
        subject: 'algebra',
        loop: 'buddy_challenge'
      });

      expect(result.rationale).toContain('student');
      expect(result.rationale).toContain('share');
      expect(result.rationale).toContain('buddy_challenge');
      expect(result.rationale).toContain('algebra');
    });

    it('omits subject from rationale when not provided', () => {
      const result = compose({
        intent: 'share',
        persona: 'student',
        loop: 'buddy_challenge'
      });

      expect(result.rationale).toBeTruthy();
    });
  });

  describe('Input validation', () => {
    it('validates input with Zod schema', () => {
      expect(() => {
        compose({
          intent: 'share',
          persona: 'student',
          loop: 'buddy_challenge'
        });
      }).not.toThrow();
    });
  });
});
