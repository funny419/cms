/**
 * Admin 포스트 관리 E2E 테스트
 * TC-A001: 포스트 목록 키워드 검색
 * TC-A002: 포스트 목록 상태 필터 (draft/published)
 * TC-A003: Admin — 타인 포스트 강제 삭제 (API)
 */
import { readFileSync } from 'fs';
import { test, expect, request } from '@playwright/test';
import { AUTH_PATHS, ADMIN, EDITOR } from './globalSetup.js';

const API_BASE = 'http://localhost:5000';

// admin storageState 사용
test.use({ storageState: AUTH_PATHS.admin });

/**
 * 헬퍼: storageState 파일에서 JWT 토큰 추출 (login API 호출 없음)
 */
function getTokenFromStorageState(authPath) {
  const state = JSON.parse(readFileSync(authPath, 'utf8'));
  const ls = state.origins?.[0]?.localStorage ?? [];
  return ls.find((x) => x.name === 'token')?.value;
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
test('TC-A001: admin 포스트 목록 키워드 검색 (API)', async ({ request }) => {
  const adminToken = getTokenFromStorageState(AUTH_PATHS.admin);
  const postId = await createPost(adminToken, { title: 'Flask Tutorial', status: 'published' });

  try {
    // "Flask" 포함 키워드 검색 → 해당 포스트 포함
    const searchRes = await request.get(`${API_BASE}/api/admin/posts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      params: { q: 'Flask', per_page: '50' },
    });
    expect(searchRes.status()).toBe(200);
    const { data: searchData } = await searchRes.json();
    const ids = searchData.items.map((p) => p.id);
    expect(ids).toContain(postId);

    // 존재하지 않는 키워드 → 해당 포스트 미포함
    const noMatchRes = await request.get(`${API_BASE}/api/admin/posts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      params: { q: '존재하지않는키워드xyz', per_page: '50' },
    });
    expect(noMatchRes.status()).toBe(200);
    const { data: noMatchData } = await noMatchRes.json();
    const noMatchIds = noMatchData.items.map((p) => p.id);
    expect(noMatchIds).not.toContain(postId);
  } finally {
    await deletePost(adminToken, postId);
  }
});

// ─────────────────────────────────────────────
// TC-A002: 포스트 목록 상태 필터
// ─────────────────────────────────────────────
test('TC-A002: admin 포스트 상태 필터 draft/published', async ({ page }) => {
  const adminToken = getTokenFromStorageState(AUTH_PATHS.admin);
  const draftId = await createPost(adminToken, { title: 'Draft Post E2E', status: 'draft' });
  const publishedId = await createPost(adminToken, { title: 'Published Post E2E', status: 'published' });

  try {
    await page.goto('/admin/posts');

    // draft 필터 선택 — waitForResponse 후 networkidle로 React 렌더링까지 대기
    const statusSelect = page.locator('select').first();
    const draftResp = page.waitForResponse((r) => r.url().includes('/api/admin/posts') && r.url().includes('status=draft'));
    await statusSelect.selectOption('draft');
    await draftResp;
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Draft Post E2E')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Published Post E2E')).not.toBeVisible();

    // published 필터 선택
    const publishedResp = page.waitForResponse((r) => r.url().includes('/api/admin/posts') && r.url().includes('status=published'));
    await statusSelect.selectOption('published');
    await publishedResp;
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Published Post E2E')).toBeVisible({ timeout: 8000 });
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
  const adminToken = getTokenFromStorageState(AUTH_PATHS.admin);
  const editorToken = getTokenFromStorageState(AUTH_PATHS.editor);

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
