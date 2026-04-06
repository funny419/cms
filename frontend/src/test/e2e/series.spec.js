/**
 * 포스트 시리즈 E2E 테스트
 * TC-U001: 시리즈 생성 + 포스트 연결 (API 검증)
 * TC-U002: 시리즈에 두 번째 포스트 추가
 * TC-U003: SeriesNav 이전/다음 탐색 (브라우저)
 * TC-U005: 타인 시리즈 수정/삭제 → 403
 */
import { test, expect, request as playwrightRequest } from '@playwright/test';
import { AUTH_PATHS, EDITOR } from './globalSetup.js';

const API_BASE = 'http://localhost:5000';

const EDITOR2 = { username: 'pw_editor2', password: 'pwpass456!' };

let editorToken = null;
let editor2Token = null;
let seriesId = null;
let postIds = [];

// editor storageState (TC-U003 브라우저 검증용)
test.use({ storageState: AUTH_PATHS.editor });

test.beforeAll(async () => {
  const ctx = await playwrightRequest.newContext();

  // 토큰 발급
  const loginRes = await ctx.post(`${API_BASE}/api/auth/login`, {
    data: { username: EDITOR.username, password: EDITOR.password },
  });
  const { data: ld } = await loginRes.json();
  editorToken = ld.access_token;

  const login2Res = await ctx.post(`${API_BASE}/api/auth/login`, {
    data: { username: EDITOR2.username, password: EDITOR2.password },
  });
  const { data: ld2 } = await login2Res.json();
  editor2Token = ld2.access_token;

  // 포스트 3개 생성
  for (let i = 1; i <= 3; i++) {
    const pr = await ctx.post(`${API_BASE}/api/posts`, {
      headers: { Authorization: `Bearer ${editorToken}` },
      data: {
        title: `Series Test Post ${i}`,
        content: `시리즈 테스트 포스트 ${i}화`,
        slug: `series-e2e-post-${i}-${Date.now()}`,
        status: 'published',
      },
    });
    const { data: pd } = await pr.json();
    postIds.push(pd.id);
  }

  // 시리즈 생성
  const sr = await ctx.post(`${API_BASE}/api/series`, {
    headers: { Authorization: `Bearer ${editorToken}` },
    data: { title: 'E2E Python 튜토리얼', description: 'E2E 테스트용 시리즈' },
  });
  const { data: sd } = await sr.json();
  seriesId = sd.id;

  // 포스트 3개 시리즈에 추가
  for (let i = 0; i < postIds.length; i++) {
    await ctx.post(`${API_BASE}/api/series/${seriesId}/posts`, {
      headers: { Authorization: `Bearer ${editorToken}` },
      data: { post_id: postIds[i], order: i + 1 },
    });
  }

  await ctx.dispose();
});

test.afterAll(async () => {
  const ctx = await playwrightRequest.newContext();

  // 시리즈 삭제 (series_posts CASCADE 삭제)
  if (seriesId) {
    await ctx.delete(`${API_BASE}/api/series/${seriesId}`, {
      headers: { Authorization: `Bearer ${editorToken}` },
    });
  }
  // 포스트 삭제
  for (const pid of postIds) {
    await ctx.delete(`${API_BASE}/api/posts/${pid}`, {
      headers: { Authorization: `Bearer ${editorToken}` },
    });
  }

  await ctx.dispose();
  postIds = [];
  seriesId = null;
});

// ─────────────────────────────────────────────
// TC-U001: 시리즈 생성 + 포스트 연결 (API 검증)
// ─────────────────────────────────────────────
test('TC-U001: 시리즈 생성 후 포스트에 series_info 임베드 확인', async ({ request }) => {
  // GET /api/posts/:id 에 series_info 필드가 있어야 함
  const res = await request.get(`${API_BASE}/api/posts/${postIds[0]}`, {
    params: { skip_count: '1' },
  });
  expect(res.status()).toBe(200);
  const { data } = await res.json();
  expect(data.series).not.toBeNull();
  expect(data.series.title).toBe('E2E Python 튜토리얼');
  expect(data.series.posts).toHaveLength(3);
});

// ─────────────────────────────────────────────
// TC-U002: 시리즈에 두 번째 포스트 추가 — total 확인
// ─────────────────────────────────────────────
test('TC-U002: 시리즈에 포스트 3개 추가 → GET /api/series/:id total=3', async ({ request }) => {
  const res = await request.get(`${API_BASE}/api/series/${seriesId}`);
  expect(res.status()).toBe(200);
  const { data } = await res.json();
  expect(data.total).toBe(3);
  expect(data.posts).toHaveLength(3);
});

// ─────────────────────────────────────────────
// TC-U003: SeriesNav 이전/다음 탐색 (브라우저)
// ─────────────────────────────────────────────
test('TC-U003: SeriesNav 이전/다음 탐색 — 중간 포스트에서 양방향 확인', async ({ page }) => {
  // SeriesNav 컨테이너를 "N / M" 진행 표시자로 스코핑
  // (PostDetail 전역 이전/다음 버튼과 SeriesNav 버튼을 구분하기 위함)
  const getSeriesNav = () =>
    page.locator('span').filter({ hasText: /\d+ \/ \d+/ }).locator('xpath=../../..');

  // 중간 포스트(2번) 상세 진입
  await page.goto(`/posts/${postIds[1]}`);
  await page.waitForLoadState('networkidle');

  // SeriesNav "시리즈" 레이블 표시
  await expect(page.getByText('시리즈', { exact: true })).toBeVisible({ timeout: 8000 });

  // SeriesNav 내 이전/다음 버튼 표시
  await expect(getSeriesNav().getByRole('button', { name: /←/ })).toBeVisible();
  await expect(getSeriesNav().getByRole('button', { name: /→/ })).toBeVisible();

  // 첫 번째 포스트는 SeriesNav 이전 없음
  await page.goto(`/posts/${postIds[0]}`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('시리즈', { exact: true })).toBeVisible({ timeout: 8000 });
  await expect(getSeriesNav().getByRole('button', { name: /←/ })).toHaveCount(0);
  await expect(getSeriesNav().getByRole('button', { name: /→/ })).toBeVisible();

  // 마지막 포스트는 SeriesNav 다음 없음
  await page.goto(`/posts/${postIds[2]}`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('시리즈', { exact: true })).toBeVisible({ timeout: 8000 });
  await expect(getSeriesNav().getByRole('button', { name: /←/ })).toBeVisible();
  await expect(getSeriesNav().getByRole('button', { name: /→/ })).toHaveCount(0);
});

// ─────────────────────────────────────────────
// TC-U005: 타인 시리즈 수정/삭제 → 403
// ─────────────────────────────────────────────
test('TC-U005: editor2 토큰으로 editor1 시리즈 수정/삭제 → 403', async ({ request }) => {
  // PUT 수정 시도
  const putRes = await request.put(`${API_BASE}/api/series/${seriesId}`, {
    headers: { Authorization: `Bearer ${editor2Token}` },
    data: { title: 'Hacked Series' },
  });
  expect(putRes.status()).toBe(403);

  // DELETE 삭제 시도
  const deleteRes = await request.delete(`${API_BASE}/api/series/${seriesId}`, {
    headers: { Authorization: `Bearer ${editor2Token}` },
  });
  expect(deleteRes.status()).toBe(403);
});
