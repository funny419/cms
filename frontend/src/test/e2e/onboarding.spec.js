/**
 * 온보딩 모달 E2E 테스트
 * TC-U044: 첫 로그인 editor — 온보딩 모달 노출
 * TC-U045: 온보딩 모달 "지금 설정하기" 버튼 → /my-blog/settings 이동
 * TC-U046: 온보딩 모달 "나중에" 버튼 → 모달 닫힘, 페이지 유지
 * TC-U047: bio 설정 완료 후 온보딩 모달 미표시
 *
 * OnboardingModal 표시 조건:
 *   user.role === 'editor' && !localStorage.onboarding_done && !user.bio && !user.avatar_url
 */
import { test, expect, request as playwrightRequest } from '@playwright/test';

const API_BASE = 'http://localhost:5000';
const FE_BASE = 'http://localhost:5173';

/**
 * bio/avatar_url 없는 신규 editor 계정 생성 후 토큰과 user 반환.
 * 이미 존재하면 로그인만 시도.
 */
async function createFreshEditor(ctx, suffix) {
  const username = `onboard_test_${suffix}`;
  const email = `${username}@test.com`;
  const password = 'testpass123!';

  // 가입 시도 (이미 존재하면 무시)
  await ctx.post(`${API_BASE}/api/auth/register`, {
    data: { username, email, password },
  });

  const loginRes = await ctx.post(`${API_BASE}/api/auth/login`, {
    data: { username, password },
  });
  const body = await loginRes.json();
  return { token: body.data.access_token, user: body.data.user, username, password };
}

/**
 * browser.newContext()에 token + user 주입 + onboarding_done 미설정 상태 반환.
 */
async function newContextWithToken(browser, token, user) {
  const ctx = await browser.newContext({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: FE_BASE,
          localStorage: [
            { name: 'token', value: token },
            { name: 'user', value: JSON.stringify(user) },
          ],
        },
      ],
    },
  });
  return ctx;
}

// 공유 editor 계정 (TC-U044~U047 재사용, rate limit 방지)
let freshToken = null;
let freshUser = null;

test.beforeAll(async () => {
  const apiCtx = await playwrightRequest.newContext();
  const result = await createFreshEditor(apiCtx, Date.now());
  freshToken = result.token;
  freshUser = result.user;
  await apiCtx.dispose();
});

// ─────────────────────────────────────────────
// TC-U044: 첫 로그인 editor 대상 온보딩 모달 노출
// ─────────────────────────────────────────────
test('TC-U044: bio/avatar_url 없는 신규 editor 로그인 → 온보딩 모달 표시', async ({ browser }) => {
  const ctx = await newContextWithToken(browser, freshToken, freshUser);
  const page = await ctx.newPage();

  await page.goto('/my-posts');
  await page.waitForLoadState('networkidle');

  // 온보딩 모달 표시 확인
  await expect(page.getByText('블로그를 꾸며보세요!', { exact: false })).toBeVisible({ timeout: 8000 });

  await ctx.close();
});

// ─────────────────────────────────────────────
// TC-U045: 온보딩 모달 "지금 설정하기" → /my-blog/settings 이동
// ─────────────────────────────────────────────
test('TC-U045: 온보딩 모달 "지금 설정하기" 클릭 → /my-blog/settings 이동 + 모달 닫힘', async ({ browser }) => {
  const ctx = await newContextWithToken(browser, freshToken, freshUser);
  const page = await ctx.newPage();

  await page.goto('/my-posts');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('블로그를 꾸며보세요!', { exact: false })).toBeVisible({ timeout: 8000 });

  // "지금 설정하기" 버튼 클릭
  await page.getByRole('button', { name: '지금 설정하기' }).click();
  await page.waitForLoadState('networkidle');

  // /my-blog/settings 이동 확인
  expect(page.url()).toContain('/my-blog/settings');

  // 모달 닫힘 확인
  await expect(page.getByText('블로그를 꾸며보세요!', { exact: false })).toBeHidden();

  await ctx.close();
});

// ─────────────────────────────────────────────
// TC-U046: 온보딩 모달 "나중에" → 모달 닫힘, 페이지 유지
// ─────────────────────────────────────────────
test('TC-U046: 온보딩 모달 "나중에" 클릭 → 모달 닫힘, 페이지 이동 없음', async ({ browser }) => {
  const ctx = await newContextWithToken(browser, freshToken, freshUser);
  const page = await ctx.newPage();

  await page.goto('/my-posts');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('블로그를 꾸며보세요!', { exact: false })).toBeVisible({ timeout: 8000 });

  // "나중에" 버튼 클릭
  await page.getByRole('button', { name: '나중에' }).click();

  // 모달 닫힘 확인
  await expect(page.getByText('블로그를 꾸며보세요!', { exact: false })).toBeHidden();

  // 페이지 URL 유지 (/my-posts 또는 동일 페이지)
  expect(page.url()).toContain('/my-posts');

  await ctx.close();
});

// ─────────────────────────────────────────────
// TC-U047: bio 설정 완료 후 온보딩 모달 미표시
// ─────────────────────────────────────────────
test('TC-U047: bio 설정된 editor 로그인 → 온보딩 모달 미표시', async ({ browser }) => {
  const apiCtx = await playwrightRequest.newContext();

  // bio 설정 (API 레벨에서만 업데이트)
  await apiCtx.put(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${freshToken}` },
    data: { bio: '안녕하세요, 테스트 사용자입니다.' },
  });
  await apiCtx.dispose();

  // bio가 있는 user 객체로 localStorage 주입
  const userWithBio = { ...freshUser, bio: '안녕하세요, 테스트 사용자입니다.' };
  const ctx = await newContextWithToken(browser, freshToken, userWithBio);
  const page = await ctx.newPage();

  await page.goto('/my-posts');
  await page.waitForLoadState('networkidle');

  // 온보딩 모달 미표시 확인
  await expect(page.getByText('블로그를 꾸며보세요!', { exact: false })).toBeHidden();

  await ctx.close();
});
