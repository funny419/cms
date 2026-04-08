/**
 * 인증/권한 가드 E2E 테스트
 * TC-A007: editor 토큰으로 admin 전용 API → 403
 * TC-A012: deactivated 계정 기존 JWT → 403
 * TC-A014: editor 토큰으로 admin stats API → 403
 * TC-A015: editor2가 editor1 포스트 삭제 시도 → 403
 * TC-A016: 비인증 블로그 stats API → 401
 * TC-A017: editor2 토큰으로 editor1 stats API → 403
 */
import { readFileSync } from 'fs';
import { test, expect, request as playwrightRequest } from '@playwright/test';
import { ADMIN, AUTH_PATHS, EDITOR } from './globalSetup.js';

const API_BASE = 'http://localhost:5000';

/**
 * 헬퍼: storageState 파일에서 JWT 토큰 추출 (login API 호출 없음)
 */
function getTokenFromStorageState(authPath) {
  const state = JSON.parse(readFileSync(authPath, 'utf8'));
  const ls = state.origins?.[0]?.localStorage ?? [];
  return ls.find((x) => x.name === 'token')?.value;
}

// ─────────────────────────────────────────────
// TC-A007: editor → admin 전용 API → 403
// ─────────────────────────────────────────────
test('TC-A007: editor 토큰으로 admin 전용 API → 403', async ({ request }) => {
  const editorToken = getTokenFromStorageState(AUTH_PATHS.editor);
  const adminToken = getTokenFromStorageState(AUTH_PATHS.admin);

  // admin 자신의 ID 조회
  const meCtx = await playwrightRequest.newContext();
  const meRes = await meCtx.get(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const { data: adminData } = await meRes.json();
  const targetUserId = adminData.id;
  await meCtx.dispose();

  // editor로 PUT /api/admin/users/:id/role → 403
  const roleRes = await request.put(`${API_BASE}/api/admin/users/${targetUserId}/role`, {
    headers: { Authorization: `Bearer ${editorToken}` },
    data: { role: 'editor' },
  });
  expect(roleRes.status()).toBe(403);

  // editor로 PUT /api/admin/users/:id/deactivate → 403
  const deactivateRes = await request.put(
    `${API_BASE}/api/admin/users/${targetUserId}/deactivate`,
    { headers: { Authorization: `Bearer ${editorToken}` } },
  );
  expect(deactivateRes.status()).toBe(403);

  // editor로 DELETE /api/admin/users/:id → 403
  const deleteRes = await request.delete(`${API_BASE}/api/admin/users/${targetUserId}`, {
    headers: { Authorization: `Bearer ${editorToken}` },
  });
  expect(deleteRes.status()).toBe(403);
});

// ─────────────────────────────────────────────
// TC-A012: deactivated 계정 기존 JWT → 403
// ─────────────────────────────────────────────
test('TC-A012: deactivated 계정 기존 JWT → 403', async ({ request }) => {
  const adminToken = getTokenFromStorageState(AUTH_PATHS.admin);
  const editorToken = getTokenFromStorageState(AUTH_PATHS.editor);

  // editor 자신의 ID 조회
  const meCtx = await playwrightRequest.newContext();
  const meRes = await meCtx.get(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${editorToken}` },
  });
  const { data: editorData } = await meRes.json();
  const editorId = editorData.id;
  await meCtx.dispose();

  // admin이 editor를 deactivate
  const deactivateCtx = await playwrightRequest.newContext();
  await deactivateCtx.put(`${API_BASE}/api/admin/users/${editorId}/deactivate`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  await deactivateCtx.dispose();

  try {
    // 기존 editor 토큰으로 인증 필요 API → 403
    const mineRes = await request.get(`${API_BASE}/api/posts/mine`, {
      headers: { Authorization: `Bearer ${editorToken}` },
    });
    expect(mineRes.status()).toBe(403);
  } finally {
    // editor 복원 (deactivated → editor)
    const restoreCtx = await playwrightRequest.newContext();
    await restoreCtx.put(`${API_BASE}/api/admin/users/${editorId}/role`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { role: 'editor' },
    });
    await restoreCtx.dispose();
  }
});

// ─────────────────────────────────────────────
// TC-A014: editor 토큰으로 admin stats → 403
// ─────────────────────────────────────────────
test('TC-A014: editor 토큰으로 admin stats API → 403', async ({ request }) => {
  const editorToken = getTokenFromStorageState(AUTH_PATHS.editor);
  const res = await request.get(`${API_BASE}/api/admin/stats/${EDITOR.username}`, {
    headers: { Authorization: `Bearer ${editorToken}` },
  });
  expect(res.status()).toBe(403);
});

// ─────────────────────────────────────────────
// TC-A015: editor2가 editor1 포스트 삭제 시도 → 403
// ─────────────────────────────────────────────
test('TC-A015: editor2 토큰으로 editor1 포스트 삭제 → 403', async ({ request }) => {
  const editorToken = getTokenFromStorageState(AUTH_PATHS.editor);
  const editor2Token = getTokenFromStorageState(AUTH_PATHS.editor2);

  // editor1이 포스트 생성
  const ctx = await playwrightRequest.newContext();
  const postRes = await ctx.post(`${API_BASE}/api/posts`, {
    headers: { Authorization: `Bearer ${editorToken}` },
    data: {
      title: 'Editor1 Post Guard Test',
      content: '권한 검사용 포스트',
      slug: `guard-test-e2e-${Date.now()}`,
      status: 'published',
    },
  });
  const { data: postData } = await postRes.json();
  const postId = postData.id;

  try {
    // editor2로 editor1 포스트 삭제 시도 → 403
    const deleteRes = await request.delete(`${API_BASE}/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${editor2Token}` },
    });
    expect(deleteRes.status()).toBe(403);
  } finally {
    // editor1이 직접 삭제 (정리)
    await ctx.delete(`${API_BASE}/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${editorToken}` },
    });
    await ctx.dispose();
  }
});

// ─────────────────────────────────────────────
// TC-A016: 비인증 블로그 stats API → 401
// ─────────────────────────────────────────────
test('TC-A016: 비인증 블로그 stats API → 401', async ({ request }) => {
  const res = await request.get(`${API_BASE}/api/blog/${EDITOR.username}/stats`);
  expect(res.status()).toBe(401);
});

// ─────────────────────────────────────────────
// TC-A017: editor2 토큰으로 editor1 stats → 403
// ─────────────────────────────────────────────
test('TC-A017: editor2 토큰으로 editor1 stats API → 403', async ({ request }) => {
  const editor2Token = getTokenFromStorageState(AUTH_PATHS.editor2);
  const res = await request.get(`${API_BASE}/api/blog/${EDITOR.username}/stats`, {
    headers: { Authorization: `Bearer ${editor2Token}` },
  });
  expect(res.status()).toBe(403);
});
