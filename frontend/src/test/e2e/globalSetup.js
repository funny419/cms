import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_BASE = 'http://localhost:5000';
const FE_BASE = 'http://localhost:5173';

// 계정 정보 — dev DB 실계정
export const ADMIN = { username: 'testuser', password: 'admin1234' };
export const EDITOR = { username: 'pw_editor', password: 'pwpass123!' };

export const AUTH_PATHS = {
  admin: path.join(__dirname, '.auth/admin.json'),
  editor: path.join(__dirname, '.auth/editor.json'),
};

async function saveStorageState(browser, username, password, statePath) {
  const context = await browser.newContext();
  const page = await context.newPage();

  // API 로그인으로 JWT 토큰 획득
  const res = await page.request.post(`${API_BASE}/api/auth/login`, {
    data: { username, password },
  });
  const json = await res.json();
  if (!json.success) throw new Error(`Login failed for ${username}: ${json.error}`);

  const token = json.data.access_token;
  const user = json.data.user;

  // FE 진입 후 localStorage에 token/user 저장 (useAuth.js가 읽는 키)
  await page.goto(FE_BASE);
  await page.evaluate(
    ([t, u]) => {
      localStorage.setItem('token', t);
      localStorage.setItem('user', JSON.stringify(u));
      // 온보딩 모달 억제 — 새 계정 첫 로그인 시 모달이 UI를 가려 테스트 실패 방지
      localStorage.setItem('onboarding_done', 'true');
    },
    [token, user],
  );

  await context.storageState({ path: statePath });
  await context.close();
}

export default async function globalSetup() {
  // pw_editor 계정 없으면 생성 (이미 있으면 무시)
  await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: EDITOR.username,
      email: 'pw_editor@test.com',
      password: EDITOR.password,
    }),
  }).catch(() => {});

  const browser = await chromium.launch();

  await saveStorageState(browser, ADMIN.username, ADMIN.password, AUTH_PATHS.admin);
  await saveStorageState(browser, EDITOR.username, EDITOR.password, AUTH_PATHS.editor);

  await browser.close();
}
