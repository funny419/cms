/**
 * Issue #60 반응형 CSS + 햄버거 메뉴 검증
 * TC-R001: Nav 햄버거 메뉴 열기 (640px)
 * TC-R002: Nav 햄버거 메뉴 닫기 — 링크 클릭 (640px)
 * TC-R003: Nav 햄버거 메뉴 닫기 — 외부 클릭 (640px)
 * TC-R004: PostList 사이드바 숨김 (640px)
 * TC-R005: CommentSection 게스트 폼 1열 전환 (480px)
 */
import { test, expect, request as playwrightRequest } from '@playwright/test';

const API_BASE = 'http://localhost:5000';
const MOBILE = { width: 640, height: 800 };
const NARROW = { width: 480, height: 800 };
const DESKTOP = { width: 1280, height: 800 };

/** 데스크톱에서는 hamburger가 없어야 함 (smoke) */
test('TC-R000: 데스크톱에서 hamburger 버튼 숨김', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: DESKTOP });
  const page = await ctx.newPage();
  await page.goto('/posts');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.nav-hamburger')).toBeHidden();
  await ctx.close();
});

test('TC-R001: 640px — 햄버거 버튼 표시 + 클릭 시 메뉴 열림', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: MOBILE });
  const page = await ctx.newPage();
  await page.goto('/posts');
  await page.waitForLoadState('networkidle');

  // hamburger 버튼 표시 확인
  const hamburger = page.locator('.nav-hamburger');
  await expect(hamburger).toBeVisible();

  // 클릭 전 메뉴 숨김 확인
  await expect(page.locator('.nav-links')).toBeHidden();

  // 클릭 후 메뉴 열림 확인
  await hamburger.click();
  await expect(page.locator('.nav-links')).toBeVisible();

  await ctx.close();
});

test('TC-R002: 640px — 메뉴 링크 클릭 시 메뉴 닫힘', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: MOBILE });
  const page = await ctx.newPage();
  await page.goto('/posts');
  await page.waitForLoadState('networkidle');

  // 메뉴 열기
  await page.locator('.nav-hamburger').click();
  await expect(page.locator('.nav-links')).toBeVisible();

  // 첫 번째 nav-link 클릭 후 메뉴 닫힘 확인
  // 비로그인 상태: 로그인 링크
  await page.locator('.nav-links .nav-link').first().click();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.nav-links')).toBeHidden();

  await ctx.close();
});

test('TC-R003: 640px — 메뉴 외부 클릭 시 메뉴 닫힘', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: MOBILE });
  const page = await ctx.newPage();
  await page.goto('/posts');
  await page.waitForLoadState('networkidle');

  // 메뉴 열기
  await page.locator('.nav-hamburger').click();
  await expect(page.locator('.nav-links')).toBeVisible();

  // nav 외부(body 상단) 클릭
  await page.locator('body').click({ position: { x: 300, y: 400 } });
  await expect(page.locator('.nav-links')).toBeHidden();

  await ctx.close();
});

test('TC-R004: 640px — PostList aside 숨김', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: MOBILE });
  const page = await ctx.newPage();
  await page.goto('/posts');
  await page.waitForLoadState('networkidle');

  // .sidebar-aside 가 CSS display:none 으로 숨겨져야 함
  const aside = page.locator('.sidebar-aside').first();
  await expect(aside).toBeHidden();

  await ctx.close();
});

test('TC-R005: 480px — CommentSection 게스트 폼 1열 전환', async ({ browser }) => {
  // 공개 포스트 ID 조회
  const apiCtx = await playwrightRequest.newContext();
  const res = await apiCtx.get(`${API_BASE}/api/posts?per_page=1`);
  const json = await res.json();
  await apiCtx.dispose();

  const firstPost = json?.data?.items?.[0];
  if (!firstPost) {
    test.skip(true, '공개 포스트 없음 — 게스트 폼 검증 건너뜀');
    return;
  }

  const ctx = await browser.newContext({ viewport: NARROW });
  const page = await ctx.newPage();
  await page.goto(`/posts/${firstPost.id}`);
  await page.waitForLoadState('networkidle');

  // 게스트 폼 그리드 존재 확인
  const grid = page.locator('.guest-form-grid').first();
  await expect(grid).toBeVisible({ timeout: 8000 });

  // 480px에서 grid-template-columns 가 1fr(단일 열) 인지 확인
  const cols = await grid.evaluate((el) =>
    window.getComputedStyle(el).gridTemplateColumns
  );
  // "1fr"은 브라우저 resolved 값으로 나타남 (예: "480px" 등 실제 pixel 값으로 변환됨)
  // 단일 열 = 공백 없는 단일 값 (공백이 있으면 다중 열)
  expect(cols.trim().split(/\s+/).length).toBe(1);

  await ctx.close();
});
