import { describe, it, expect } from 'vitest';
import { assignExperiment } from '../experiment.agent';

describe('Experiment Agent - Variant Assignment', () => {
  describe('Deterministic assignment', () => {
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

    it('assigns different users to potentially different variants', () => {
      const experimentName = 'test-experiment';
      const variants = ['control', 'variant_a'];

      const result1 = assignExperiment({
        user_id: 'user-1',
        experiment_name: experimentName,
        experiment_config: { variants }
      });

      const result2 = assignExperiment({
        user_id: 'user-2',
        experiment_name: experimentName,
        experiment_config: { variants }
      });

      // They might be the same or different, but assignment is deterministic per user
      expect(['control', 'variant_a']).toContain(result1.variant);
      expect(['control', 'variant_a']).toContain(result2.variant);
    });

    it('assigns same user to different variants in different experiments', () => {
      const userId = 'user-123';

      const result1 = assignExperiment({
        user_id: userId,
        experiment_name: 'experiment-1',
        experiment_config: { variants: ['control', 'variant_a'] }
      });

      const result2 = assignExperiment({
        user_id: userId,
        experiment_name: 'experiment-2',
        experiment_config: { variants: ['control', 'variant_a'] }
      });

      // Different experiments can assign to different variants
      expect(result1.exposure_id).not.toBe(result2.exposure_id);
    });
  });

  describe('Traffic distribution', () => {
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

      // Each variant should get ~333 users (allow 15% variance for randomness)
      variants.forEach(variant => {
        const count = assignments.get(variant) || 0;
        expect(count).toBeGreaterThan(280); // ~333 - 15%
        expect(count).toBeLessThan(386);    // ~333 + 15%
      });

      // Total should be 1000
      const total = Array.from(assignments.values()).reduce((a, b) => a + b, 0);
      expect(total).toBe(1000);
    });

    it('respects custom traffic splits (70/30)', () => {
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
      }

      const controlCount = assignments.get('control') || 0;
      const variantCount = assignments.get('variant_a') || 0;

      // Control should get ~700 users (allow 10% variance)
      expect(controlCount).toBeGreaterThan(630);
      expect(controlCount).toBeLessThan(770);

      // Variant should get ~300 users (allow 10% variance)
      expect(variantCount).toBeGreaterThan(230);
      expect(variantCount).toBeLessThan(370);
    });

    it('respects custom traffic splits (50/25/25)', () => {
      const variants = ['control', 'variant_a', 'variant_b'];
      const assignments = new Map<string, number>();

      for (let i = 0; i < 1000; i++) {
        const result = assignExperiment({
          user_id: `user-${i}`,
          experiment_name: 'test',
          experiment_config: {
            variants,
            traffic_splits: [0.5, 0.25, 0.25]
          }
        });

        assignments.set(result.variant, (assignments.get(result.variant) || 0) + 1);
      }

      const controlCount = assignments.get('control') || 0;
      const variantACount = assignments.get('variant_a') || 0;
      const variantBCount = assignments.get('variant_b') || 0;

      // Control: ~500 (allow 10% variance)
      expect(controlCount).toBeGreaterThan(450);
      expect(controlCount).toBeLessThan(550);

      // Variant A: ~250 (allow 15% variance)
      expect(variantACount).toBeGreaterThan(210);
      expect(variantACount).toBeLessThan(290);

      // Variant B: ~250 (allow 15% variance)
      expect(variantBCount).toBeGreaterThan(210);
      expect(variantBCount).toBeLessThan(290);
    });
  });

  describe('Input validation', () => {
    it('throws error for invalid traffic splits (sum != 1)', () => {
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

    it('throws error for traffic splits that sum to 0.9', () => {
      expect(() => {
        assignExperiment({
          user_id: 'user-123',
          experiment_name: 'test',
          experiment_config: {
            variants: ['control', 'variant_a'],
            traffic_splits: [0.5, 0.4] // Sums to 0.9
          }
        });
      }).toThrow('Traffic splits must sum to 1.0');
    });

    it('accepts traffic splits that sum to exactly 1.0', () => {
      expect(() => {
        assignExperiment({
          user_id: 'user-123',
          experiment_name: 'test',
          experiment_config: {
            variants: ['control', 'variant_a'],
            traffic_splits: [0.6, 0.4]
          }
        });
      }).not.toThrow();
    });

    it('accepts traffic splits with small floating point errors', () => {
      expect(() => {
        assignExperiment({
          user_id: 'user-123',
          experiment_name: 'test',
          experiment_config: {
            variants: ['control', 'variant_a', 'variant_b'],
            traffic_splits: [0.333, 0.333, 0.334] // Sums to 1.0 with rounding
          }
        });
      }).not.toThrow();
    });
  });

  describe('Exposure ID generation', () => {
    it('generates unique exposure IDs', () => {
      const result1 = assignExperiment({
        user_id: 'user-1',
        experiment_name: 'test',
        experiment_config: { variants: ['control', 'variant_a'] }
      });

      const result2 = assignExperiment({
        user_id: 'user-2',
        experiment_name: 'test',
        experiment_config: { variants: ['control', 'variant_a'] }
      });

      expect(result1.exposure_id).not.toBe(result2.exposure_id);
      expect(result1.exposure_id).toMatch(/^exp_[a-f0-9]{16}$/);
      expect(result2.exposure_id).toMatch(/^exp_[a-f0-9]{16}$/);
    });

    it('generates same exposure ID for same user and experiment', () => {
      const result1 = assignExperiment({
        user_id: 'user-123',
        experiment_name: 'test',
        experiment_config: { variants: ['control', 'variant_a'] }
      });

      const result2 = assignExperiment({
        user_id: 'user-123',
        experiment_name: 'test',
        experiment_config: { variants: ['control', 'variant_a'] }
      });

      expect(result1.exposure_id).toBe(result2.exposure_id);
    });
  });

  describe('Output structure', () => {
    it('returns all required fields', () => {
      const result = assignExperiment({
        user_id: 'user-123',
        experiment_name: 'test',
        experiment_config: {
          variants: ['control', 'variant_a']
        }
      });

      expect(result).toHaveProperty('variant');
      expect(result).toHaveProperty('exposure_id');
      expect(result).toHaveProperty('rationale');
      expect(result).toHaveProperty('features_used');
      expect(result).toHaveProperty('ttl_ms');

      expect(['control', 'variant_a']).toContain(result.variant);
      expect(typeof result.exposure_id).toBe('string');
      expect(typeof result.rationale).toBe('string');
      expect(Array.isArray(result.features_used)).toBe(true);
      expect(typeof result.ttl_ms).toBe('number');
    });

    it('includes proper TTL', () => {
      const result = assignExperiment({
        user_id: 'user-123',
        experiment_name: 'test',
        experiment_config: { variants: ['control', 'variant_a'] }
      });

      expect(result.ttl_ms).toBe(3600000); // 1 hour
    });

    it('includes features_used array with proper data', () => {
      const result = assignExperiment({
        user_id: 'user-123',
        experiment_name: 'my-experiment',
        experiment_config: { variants: ['control', 'variant_a'] }
      });

      expect(result.features_used).toContain('experiment:my-experiment');
      expect(result.features_used).toContain('method:hash_based');
      expect(result.features_used.some(f => f.startsWith('user_id:'))).toBe(true);
      expect(result.features_used.some(f => f.startsWith('variant:'))).toBe(true);
      expect(result.features_used.some(f => f.startsWith('bucket:'))).toBe(true);
    });

    it('includes rationale with assignment details', () => {
      const result = assignExperiment({
        user_id: 'user-123',
        experiment_name: 'test-experiment',
        experiment_config: { variants: ['control', 'variant_a'] }
      });

      expect(result.rationale).toContain('user-123'.substring(0, 8));
      expect(result.rationale).toContain(result.variant);
      expect(result.rationale).toContain('test-experiment');
      expect(result.rationale).toContain('hash-based bucketing');
    });
  });

  describe('Edge cases', () => {
    it('handles single variant', () => {
      const result = assignExperiment({
        user_id: 'user-123',
        experiment_name: 'test',
        experiment_config: { variants: ['control'] }
      });

      expect(result.variant).toBe('control');
    });

    it('handles many variants', () => {
      const variants = ['control', 'v1', 'v2', 'v3', 'v4', 'v5'];
      const result = assignExperiment({
        user_id: 'user-123',
        experiment_name: 'test',
        experiment_config: { variants }
      });

      expect(variants).toContain(result.variant);
    });

    it('handles very long user IDs', () => {
      const longUserId = 'user-' + 'a'.repeat(1000);
      const result = assignExperiment({
        user_id: longUserId,
        experiment_name: 'test',
        experiment_config: { variants: ['control', 'variant_a'] }
      });

      expect(['control', 'variant_a']).toContain(result.variant);
    });

    it('handles very long experiment names', () => {
      const longExpName = 'experiment-' + 'a'.repeat(1000);
      const result = assignExperiment({
        user_id: 'user-123',
        experiment_name: longExpName,
        experiment_config: { variants: ['control', 'variant_a'] }
      });

      expect(['control', 'variant_a']).toContain(result.variant);
    });
  });
});
