/**
 * 접근 제어 E2E 테스트
 * TC-U043: members_only 포스트 비로그인 API 접근 → 401
 * TC-U048: /my-blog/statistics 비로그인 → /login 리다이렉트
 * TC-U049: /my-blog/settings 비로그인 → /login 리다이렉트
 */
import { test, expect, request as playwrightRequest } from '@playwright/test';
import { EDITOR } from './globalSetup.js';

const API_BASE = 'http://localhost:5000';

// storageState 미지정 → 비로그인 컨텍스트

// ─────────────────────────────────────────────
// TC-U043: members_only 포스트 비로그인 API 접근
// ─────────────────────────────────────────────
test('TC-U043: members_only 포스트 비로그인 API 접근 → 401', async ({ request }) => {
  const ctx = await playwrightRequest.newContext();

  // editor 토큰 발급
  const loginRes = await ctx.post(`${API_BASE}/api/auth/login`, {
    data: { username: EDITOR.username, password: EDITOR.password },
  });
  const { data: loginData } = await loginRes.json();
  const editorToken = loginData.access_token;

  // members_only 포스트 생성
  const postRes = await ctx.post(`${API_BASE}/api/posts`, {
    headers: { Authorization: `Bearer ${editorToken}` },
    data: {
      title: 'Members Only E2E Test Post',
      content: '멤버 전용 포스트',
      slug: `members-only-e2e-${Date.now()}`,
      status: 'published',
      visibility: 'members_only',
    },
  });
  const postJson = await postRes.json();
  const postId = postJson.data.id;

  try {
    // 비로그인(토큰 없음)으로 해당 포스트 조회 → 401
    const getRes = await request.get(`${API_BASE}/api/posts/${postId}`);
    expect([401, 403]).toContain(getRes.status());
  } finally {
    await ctx.delete(`${API_BASE}/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${editorToken}` },
    });
    await ctx.dispose();
  }
});

// ─────────────────────────────────────────────
// TC-U048: /my-blog/statistics 비로그인 → /login 리다이렉트
// ─────────────────────────────────────────────
test('TC-U048: /my-blog/statistics 비로그인 → 로그인 리다이렉트', async ({ page }) => {
  await page.goto('/my-blog/statistics');
  await page.waitForURL('**/login**', { timeout: 8000 });
  expect(page.url()).toContain('/login');
});

// ─────────────────────────────────────────────
// TC-U049: /my-blog/settings 비로그인 → /login 리다이렉트
// ─────────────────────────────────────────────
test('TC-U049: /my-blog/settings 비로그인 → 로그인 리다이렉트', async ({ page }) => {
  await page.goto('/my-blog/settings');
  await page.waitForURL('**/login**', { timeout: 8000 });
  expect(page.url()).toContain('/login');
});
