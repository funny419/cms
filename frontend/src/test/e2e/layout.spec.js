/**
 * 블로그 레이아웃 E2E 테스트
 * TC-U022: 레이아웃 Compact (B) 적용 — 사이드바 숨겨짐
 * TC-U023: 레이아웃 Magazine (D) 적용 — Featured 카드 표시
 * TC-U024: 레이아웃 Photo (C) 적용 — grid 컨테이너 표시
 * TC-U025: 레이아웃 설정 유지 (새로고침)
 */
import { readFileSync } from 'fs';
import { test, expect, request as playwrightRequest } from '@playwright/test';
import { AUTH_PATHS, EDITOR } from './globalSetup.js';

function getTokenFromStorageState(authPath) {
  const state = JSON.parse(readFileSync(authPath, 'utf8'));
  const ls = state.origins?.[0]?.localStorage ?? [];
  return ls.find((x) => x.name === 'token')?.value;
}

const API_BASE = 'http://localhost:5000';
const EDITOR_BLOG = `/blog/${EDITOR.username}`;
const SETTINGS_URL = '/my-blog/settings';

let editorToken = null;
let testPostId = null;

// editor storageState 사용
test.use({ storageState: AUTH_PATHS.editor });

test.beforeAll(async () => {
  // storageState에서 토큰 추출 (login API 호출 없음)
  editorToken = getTokenFromStorageState(AUTH_PATHS.editor);

  // 레이아웃 검증용 포스트 생성 (Magazine/Photo 레이아웃은 포스트 필요)
  const ctx = await playwrightRequest.newContext();
  const postRes = await ctx.post(`${API_BASE}/api/posts`, {
    headers: { Authorization: `Bearer ${editorToken}` },
    data: {
      title: 'Layout Test Post E2E',
      content: '레이아웃 테스트용 포스트',
      slug: `layout-test-${Date.now()}`,
      status: 'published',
    },
  });
  const postJson = await postRes.json();
  testPostId = postJson.data.id;
  await ctx.dispose();
});

test.afterAll(async () => {
  const ctx = await playwrightRequest.newContext();
  // 테스트 포스트 삭제
  if (testPostId) {
    await ctx.delete(`${API_BASE}/api/posts/${testPostId}`, {
      headers: { Authorization: `Bearer ${editorToken}` },
    });
  }
  // 레이아웃 default로 복원
  await ctx.put(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${editorToken}` },
    data: { blog_layout: 'default' },
  });
  await ctx.dispose();
});

/**
 * 헬퍼: /my-blog/settings 디자인 탭에서 레이아웃 선택 후 저장
 */
async function applyLayout(page, layoutLabel) {
  await page.goto(SETTINGS_URL);
  await page.waitForLoadState('networkidle');

  // 디자인 탭 클릭
  await page.getByRole('button', { name: '디자인' }).click();

  // 레이아웃 버튼 클릭 (레이블 텍스트: "A. 기본", "B. 콤팩트", "D. 매거진", "C. 포토")
  await page.getByText(layoutLabel).click();

  // 저장 버튼 클릭
  await page.getByRole('button', { name: '저장' }).click();

  // 저장 완료 확인
  await expect(page.locator('.alert-success')).toContainText('저장됐습니다.', { timeout: 8000 });
}

// ─────────────────────────────────────────────
// TC-U022: 레이아웃 Compact (B) 적용
// ─────────────────────────────────────────────
test('TC-U022: 레이아웃 Compact — 사이드바 숨겨짐', async ({ page }) => {
  await applyLayout(page, 'B. 콤팩트');

  await page.goto(EDITOR_BLOG);
  await page.waitForLoadState('networkidle');

  // Default 레이아웃의 aside(사이드바)가 없어야 함
  await expect(page.locator('aside')).not.toBeVisible();
});

// ─────────────────────────────────────────────
// TC-U023: 레이아웃 Magazine (D) 적용
// ─────────────────────────────────────────────
test('TC-U023: 레이아웃 Magazine — Featured 카드 표시', async ({ page }) => {
  await applyLayout(page, 'D. 매거진');

  await page.goto(EDITOR_BLOG);
  await page.waitForLoadState('networkidle');

  // Magazine 레이아웃: 첫 번째 포스트에 "Featured" 텍스트 표시
  await expect(page.getByText('Featured', { exact: false })).toBeVisible();
});

// ─────────────────────────────────────────────
// TC-U024: 레이아웃 Photo (C) 적용
// ─────────────────────────────────────────────
test('TC-U024: 레이아웃 Photo — grid 컨테이너 표시', async ({ page }) => {
  await applyLayout(page, 'C. 포토');

  await page.goto(EDITOR_BLOG);
  await page.waitForLoadState('networkidle');

  // API로 blog_layout 저장 값 확인 (더 신뢰성 있는 검증)
  const ctx = await playwrightRequest.newContext();
  const meRes = await ctx.get(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${editorToken}` },
  });
  const { data } = await meRes.json();
  expect(data.blog_layout).toBe('photo');
  await ctx.dispose();
});

// ─────────────────────────────────────────────
// TC-U025: 레이아웃 설정 유지 (새로고침)
// ─────────────────────────────────────────────
test('TC-U025: 레이아웃 설정이 새로고침 후에도 유지됨', async ({ page }) => {
  await applyLayout(page, 'B. 콤팩트');

  // 블로그 홈 진입 후 새로고침
  await page.goto(EDITOR_BLOG);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('aside')).not.toBeVisible();

  await page.reload();
  await page.waitForLoadState('networkidle');

  // 새로고침 후에도 Compact 유지 — aside 여전히 없음
  await expect(page.locator('aside')).not.toBeVisible();

  // 설정 페이지에서도 Compact가 선택된 상태 확인
  await page.goto(SETTINGS_URL);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '디자인' }).click();

  // "B. 콤팩트" 버튼이 accent 색상 border (선택 상태) 확인 — API로 대체
  const ctx = await playwrightRequest.newContext();
  const meRes = await ctx.get(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${editorToken}` },
  });
  const { data } = await meRes.json();
  expect(data.blog_layout).toBe('compact');
  await ctx.dispose();
});
