import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/agents/decide/route';
import { NextRequest } from 'next/server';

describe('POST /api/agents/decide', () => {
  const validRequest = {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    event: 'results_viewed',
    persona: 'student' as const,
    subject: 'algebra',
    cooldowns: {},
  };

  function createRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost:3000/api/agents/decide', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  describe('Validation', () => {
    it('should accept valid request', async () => {
      const req = createRequest(validRequest);
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('loop');
      expect(data).toHaveProperty('copy');
      expect(data).toHaveProperty('reward_preview');
      expect(data).toHaveProperty('deep_link_params');
    });

    it('should reject invalid userId format', async () => {
      const req = createRequest({
        ...validRequest,
        userId: 'not-a-uuid',
      });
      const response = await POST(req);

      expect(response.status).toBe(400);
    });

    it('should reject missing event', async () => {
      const req = createRequest({
        ...validRequest,
        event: '',
      });
      const response = await POST(req);

      expect(response.status).toBe(400);
    });

    it('should reject invalid persona', async () => {
      const req = createRequest({
        ...validRequest,
        persona: 'invalid',
      });
      const response = await POST(req);

      expect(response.status).toBe(400);
    });
  });

  describe('Orchestrator Integration', () => {
    it('should return a valid viral loop for student', async () => {
      const req = createRequest({
        ...validRequest,
        persona: 'student',
      });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.loop).toBeDefined();
      expect(typeof data.loop).toBe('string');
    });

    it('should return a valid viral loop for parent', async () => {
      const req = createRequest({
        ...validRequest,
        persona: 'parent',
      });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.loop).toBeDefined();
    });

    it('should return a valid viral loop for tutor', async () => {
      const req = createRequest({
        ...validRequest,
        persona: 'tutor',
      });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.loop).toBeDefined();
    });

    it('should respect cooldowns', async () => {
      const req = createRequest({
        ...validRequest,
        cooldowns: {
          buddy_challenge_hours: 12, // 12 hours ago, less than 24hr cooldown
        },
      });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should not return buddy_challenge since it's on cooldown (12h < 24h required)
      expect(data.loop).not.toBe('buddy_challenge');
    });
  });

  describe('Personalization Integration', () => {
    it('should return personalized copy', async () => {
      const req = createRequest(validRequest);
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.copy).toBeDefined();
      expect(typeof data.copy).toBe('string');
      expect(data.copy.length).toBeGreaterThan(0);
    });

    it('should include deep link params', async () => {
      const req = createRequest(validRequest);
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.deep_link_params).toBeDefined();
      expect(typeof data.deep_link_params).toBe('object');
    });

    it('should include subject in personalization when provided', async () => {
      const req = createRequest({
        ...validRequest,
        subject: 'geometry',
      });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.copy).toBeDefined();
    });
  });

  describe('Experiment Integration', () => {
    it('should not include experiment by default', async () => {
      const req = createRequest(validRequest);
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.experiment).toBeUndefined();
    });
  });

  describe('Response Format', () => {
    it('should include all required fields', async () => {
      const req = createRequest(validRequest);
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('loop');
      expect(data).toHaveProperty('copy');
      expect(data).toHaveProperty('reward_preview');
      expect(data).toHaveProperty('deep_link_params');
      expect(data).toHaveProperty('eligibility_reason');
    });

    it('should have proper content type', async () => {
      const req = createRequest(validRequest);
      const response = await POST(req);

      expect(response.headers.get('content-type')).toContain('application/json');
    });
  });
});
