/**
 * 블로그 통계 E2E 테스트
 * TC-U007: 통계 대시보드 진입 확인
 * TC-U008: period 필터 전환 (7일/30일/90일)
 * TC-U009: 타인 통계 접근 차단 → 403
 */
import { readFileSync } from 'fs';
import { test, expect } from '@playwright/test';
import { AUTH_PATHS, EDITOR } from './globalSetup.js';

const API_BASE = 'http://localhost:5000';

function getTokenFromStorageState(authPath) {
  const state = JSON.parse(readFileSync(authPath, 'utf8'));
  const ls = state.origins?.[0]?.localStorage ?? [];
  return ls.find((x) => x.name === 'token')?.value;
}

// editor storageState 사용 (TC-U007, U008)
test.use({ storageState: AUTH_PATHS.editor });

// ─────────────────────────────────────────────
// TC-U007: 통계 대시보드 진입
// ─────────────────────────────────────────────
test('TC-U007: /my-blog/statistics 대시보드 로드 확인', async ({ page }) => {
  await page.goto('/my-blog/statistics');
  await page.waitForLoadState('networkidle');

  // 페이지 헤딩 확인
  await expect(page.getByText('블로그 통계')).toBeVisible({ timeout: 8000 });

  // period 버튼 3개 표시
  await expect(page.getByRole('button', { name: '7일' })).toBeVisible();
  await expect(page.getByRole('button', { name: '30일' })).toBeVisible();
  await expect(page.getByRole('button', { name: '90일' })).toBeVisible();

  // 차트 섹션 헤딩 표시
  await expect(page.getByText('일별 조회수')).toBeVisible();
  await expect(page.getByText('인기 포스트 Top 10')).toBeVisible();
});

// ─────────────────────────────────────────────
// TC-U008: period 필터 전환
// ─────────────────────────────────────────────
test('TC-U008: period 필터 7일/30일/90일 전환 확인', async ({ page }) => {
  await page.goto('/my-blog/statistics');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('블로그 통계')).toBeVisible({ timeout: 8000 });

  // 초기 7일 선택 상태
  await expect(page.getByRole('button', { name: '7일' })).toBeVisible();

  // 30일 클릭 → 차트 섹션 유지 확인
  await page.getByRole('button', { name: '30일' }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('일별 조회수')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('인기 포스트 Top 10')).toBeVisible();

  // 90일 클릭
  await page.getByRole('button', { name: '90일' }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('인기 포스트 Top 10')).toBeVisible({ timeout: 10000 });

  // 7일 복귀
  await page.getByRole('button', { name: '7일' }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('블로그 통계')).toBeVisible();
});

// ─────────────────────────────────────────────
// TC-U009: 타인 통계 접근 차단 → 403
// ─────────────────────────────────────────────
test('TC-U009: editor2 토큰으로 editor1 통계 API → 403', async ({ request }) => {
  const editor2Token = getTokenFromStorageState(AUTH_PATHS.editor2);

  const res = await request.get(`${API_BASE}/api/blog/${EDITOR.username}/stats`, {
    headers: { Authorization: `Bearer ${editor2Token}` },
  });
  expect(res.status()).toBe(403);
});
