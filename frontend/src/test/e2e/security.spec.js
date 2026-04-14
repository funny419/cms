/**
 * 보안 수정 회귀 E2E 테스트
 * TC-SEC001: PostEditor — 10MB 초과 이미지 업로드 시 에러 메시지 표시 (Markdown 경로)
 * TC-SEC002: PostEditor — Markdown 이미지 input accept 속성 허용 MIME 타입 명시 확인
 * TC-SEC003: /wizard — 완료 상태에서 접근 시 / 로 리다이렉트
 */
import { test, expect } from '@playwright/test';
import { AUTH_PATHS } from './globalSetup.js';

// ─────────────────────────────────────────────
// TC-SEC001, TC-SEC002: editor 인증 필요
// ─────────────────────────────────────────────
test.describe('PostEditor 파일 검증', () => {
  test.use({ storageState: AUTH_PATHS.editor });

  test('TC-SEC001: Markdown 이미지 업로드 — 10MB 초과 파일 선택 시 에러 메시지 표시', async ({ page }) => {
    await page.goto('/posts/new');
    await page.waitForLoadState('networkidle');

    // Markdown 탭으로 전환
    await page.getByRole('button', { name: 'Markdown' }).click();

    // 11MB 가상 파일 (10MB 제한 초과)
    const buf = new Uint8Array(11 * 1024 * 1024).fill(0xab);

    // 숨김 file input에 파일 설정
    await page.setInputFiles('input[type="file"][accept*="image/jpeg"]', {
      name: 'large.jpg',
      mimeType: 'image/jpeg',
      buffer: buf,
    });

    // 에러 알림 표시 확인
    const errorAlert = page.locator('.alert.alert-error');
    await expect(errorAlert).toBeVisible({ timeout: 5000 });
    await expect(errorAlert).toContainText('10MB');
  });

  test('TC-SEC002: Markdown 이미지 input accept 속성 — 허용 MIME 타입 명시, 와일드카드 아님', async ({ page }) => {
    await page.goto('/posts/new');
    await page.waitForLoadState('networkidle');

    // Markdown 탭으로 전환
    await page.getByRole('button', { name: 'Markdown' }).click();

    const acceptAttr = await page
      .locator('input[type="file"][accept*="image/jpeg"]')
      .getAttribute('accept');

    expect(acceptAttr).toContain('image/jpeg');
    expect(acceptAttr).toContain('image/png');
    expect(acceptAttr).toContain('image/gif');
    expect(acceptAttr).toContain('image/webp');
    // 와일드카드 허용 금지 확인 (image/* 는 악성 파일도 선택 가능)
    expect(acceptAttr).not.toContain('image/*');
  });
});

// ─────────────────────────────────────────────
// TC-SEC003: 비로그인 — wizard 완료 상태 리다이렉트
// ─────────────────────────────────────────────
test('TC-SEC003: /wizard 완료 상태에서 접근 시 / 로 리다이렉트', async ({ page }) => {
  await page.goto('/wizard');

  // wizard status API 응답 후 completed=true 이면 navigate('/', { replace: true })
  await page.waitForURL((url) => !url.pathname.startsWith('/wizard'), { timeout: 8000 });
  expect(page.url()).not.toContain('/wizard');
});
