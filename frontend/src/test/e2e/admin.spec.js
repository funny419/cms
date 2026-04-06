/**
 * Admin 포스트 관리 E2E 테스트
 * TC-A001: 포스트 목록 키워드 검색
 * TC-A002: 포스트 목록 상태 필터 (draft/published)
 * TC-A003: Admin — 타인 포스트 강제 삭제 (API)
 */
import { test, expect, request } from '@playwright/test';
import { AUTH_PATHS, ADMIN, EDITOR } from './globalSetup.js';

const API_BASE = 'http://localhost:5000';

// admin storageState 사용
test.use({ storageState: AUTH_PATHS.admin });

/**
 * 헬퍼: API 토큰 발급
 */
async function getToken(username, password) {
  const ctx = await request.newContext();
  const res = await ctx.post(`${API_BASE}/api/auth/login`, {
    data: { username, password },
  });
  const json = await res.json();
  await ctx.dispose();
  return json.data.access_token;
}

/**
 * 헬퍼: 포스트 생성 후 ID 반환
 */
async function createPost(token, { title, status }) {
  const ctx = await request.newContext();
  const res = await ctx.post(`${API_BASE}/api/posts`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title,
      content: `${title} 내용`,
      slug: title.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
      status,
    },
  });
  const json = await res.json();
  await ctx.dispose();
  return json.data.id;
}

/**
 * 헬퍼: 포스트 삭제
 */
async function deletePost(token, postId) {
  const ctx = await request.newContext();
  await ctx.delete(`${API_BASE}/api/posts/${postId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await ctx.dispose();
}

// ─────────────────────────────────────────────
// TC-A001: 포스트 목록 키워드 검색
// ─────────────────────────────────────────────
test('TC-A001: admin 포스트 목록 키워드 검색', async ({ page }) => {
  const adminToken = await getToken(ADMIN.username, ADMIN.password);
  const postId = await createPost(adminToken, { title: 'Flask Tutorial', status: 'published' });

  try {
    await page.goto('/admin/posts');

    // 검색창 입력 (디바운스 300ms 대기)
    const searchInput = page.getByPlaceholder(/검색/i).or(page.locator('input[type="search"]')).first();
    await searchInput.fill('Flask');
    await page.waitForTimeout(500); // 디바운스 대기

    // "Flask" 포함 포스트 표시 확인
    await expect(page.getByText('Flask Tutorial')).toBeVisible();

    // 다른 키워드로 검색 시 Flask 포스트 미표시
    await searchInput.fill('존재하지않는키워드xyz');
    await page.waitForTimeout(500);
    await expect(page.getByText('Flask Tutorial')).not.toBeVisible();
  } finally {
    await deletePost(adminToken, postId);
  }
});

// ─────────────────────────────────────────────
// TC-A002: 포스트 목록 상태 필터
// ─────────────────────────────────────────────
test('TC-A002: admin 포스트 상태 필터 draft/published', async ({ page }) => {
  const adminToken = await getToken(ADMIN.username, ADMIN.password);
  const draftId = await createPost(adminToken, { title: 'Draft Post E2E', status: 'draft' });
  const publishedId = await createPost(adminToken, { title: 'Published Post E2E', status: 'published' });

  try {
    await page.goto('/admin/posts');

    // draft 필터 선택
    const statusSelect = page.locator('select').filter({ hasText: /전체|draft|published/i }).first();
    await statusSelect.selectOption('draft');
    await page.waitForTimeout(300);

    await expect(page.getByText('Draft Post E2E')).toBeVisible();
    await expect(page.getByText('Published Post E2E')).not.toBeVisible();

    // published 필터 선택
    await statusSelect.selectOption('published');
    await page.waitForTimeout(300);

    await expect(page.getByText('Published Post E2E')).toBeVisible();
    await expect(page.getByText('Draft Post E2E')).not.toBeVisible();
  } finally {
    await deletePost(adminToken, draftId);
    await deletePost(adminToken, publishedId);
  }
});

// ─────────────────────────────────────────────
// TC-A003: Admin — 타인 포스트 강제 삭제 (API)
// ─────────────────────────────────────────────
test('TC-A003: admin이 editor 포스트 강제 삭제 (API)', async ({ request }) => {
  const adminToken = await getToken(ADMIN.username, ADMIN.password);
  const editorToken = await getToken(EDITOR.username, EDITOR.password);

  // editor 포스트 생성
  const editorPostId = await createPost(editorToken, { title: 'Editor Post To Delete', status: 'published' });

  // admin이 editor 포스트 삭제
  const deleteRes = await request.delete(`${API_BASE}/api/posts/${editorPostId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(deleteRes.ok()).toBeTruthy();
  const deleteJson = await deleteRes.json();
  expect(deleteJson.success).toBe(true);

  // 삭제 후 조회 시 404
  const getRes = await request.get(`${API_BASE}/api/posts/${editorPostId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(getRes.status()).toBe(404);
});
