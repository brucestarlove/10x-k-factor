import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, usersProfiles } from '@/db/schema/index';
import { randomUUID } from 'crypto';
import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  persona: 'student' | 'parent' | 'tutor';
  sessionToken?: string;
}

/**
 * Create a test user in the database
 * @param options - User creation options
 * @returns Created user details
 */
export async function createTestUser(options: {
  persona?: 'student' | 'parent' | 'tutor';
  email?: string;
  name?: string;
  minor?: boolean;
} = {}): Promise<TestUser> {
  const {
    persona = 'student',
    email = `test-${randomUUID()}@test.com`,
    name = 'Test User',
    minor = false
  } = options;

  // Hash password
  const password = await hash('password123', 10);

  // Create user
  const [user] = await db.insert(users).values({
    id: randomUUID(),
    email,
    password,
    name,
    emailVerified: new Date()
  }).returning();

  // Create profile
  await db.insert(usersProfiles).values({
    userId: user.id,
    persona,
    minor,
    onboardingCompleted: true
  });

  return {
    id: user.id,
    email: user.email!,
    name: user.name!,
    persona
  };
}

/**
 * Delete test user from database
 * @param userId - User ID to delete
 */
export async function deleteTestUser(userId: string): Promise<void> {
  // Delete profile first (foreign key constraint)
  await db.delete(usersProfiles).where(eq(usersProfiles.userId, userId));
  // Delete user
  await db.delete(users).where(eq(users.id, userId));
}

/**
 * Create a mock NextRequest for testing
 * @param url - Request URL
 * @param options - Request options
 * @returns NextRequest instance
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  } = {}
): NextRequest {
  const {
    method = 'GET',
    body,
    headers = {},
    cookies = {}
  } = options;

  const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;

  const requestHeaders = new Headers(headers);

  // Add cookies
  if (Object.keys(cookies).length > 0) {
    const cookieString = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
    requestHeaders.set('Cookie', cookieString);
  }

  const requestInit: RequestInit = {
    method,
    headers: requestHeaders
  };

  if (body && method !== 'GET' && method !== 'HEAD') {
    requestInit.body = JSON.stringify(body);
    requestHeaders.set('Content-Type', 'application/json');
  }

  return new NextRequest(fullUrl, requestInit);
}

/**
 * Extract JSON from NextResponse
 * @param response - NextResponse instance
 * @returns Parsed JSON body
 */
export async function extractJson<T = any>(response: NextResponse): Promise<T> {
  const text = await response.text();
  return JSON.parse(text) as T;
}

/**
 * Test helper to call API route handler
 * @param handler - Route handler function
 * @param request - NextRequest or mock request options
 * @param params - Route params (for dynamic routes)
 * @returns Response object with parsed body
 */
export async function callApiRoute<T = any>(
  handler: Function,
  request: NextRequest | {
    url: string;
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  },
  params?: any
): Promise<{
  status: number;
  body: T;
  response: NextResponse;
}> {
  const req = request instanceof NextRequest
    ? request
    : createMockRequest(request.url, request);

  const response = await handler(req, params ? { params: Promise.resolve(params) } : undefined) as NextResponse;

  const body = await extractJson<T>(response);

  return {
    status: response.status,
    body,
    response
  };
}

/**
 * Expect API error response
 * @param response - Response from API
 * @param expectedStatus - Expected status code
 * @param expectedCode - Expected error code
 */
export function expectApiError(
  response: { status: number; body: any },
  expectedStatus: number,
  expectedCode?: string
): void {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toHaveProperty('error');

  if (expectedCode) {
    expect(response.body.code).toBe(expectedCode);
  }
}

/**
 * Expect API success response
 * @param response - Response from API
 * @param expectedStatus - Expected status code (default 200)
 */
export function expectApiSuccess(
  response: { status: number; body: any },
  expectedStatus: number = 200
): void {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).not.toHaveProperty('error');
}
