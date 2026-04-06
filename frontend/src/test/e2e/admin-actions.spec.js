/**
 * Admin 액션 E2E 테스트
 * TC-A005: 회원 비활성화 → 로그인 401
 * TC-A008: 게스트 댓글 승인 (pending → approved)
 * TC-A009: 게스트 댓글 스팸 처리 (pending → spam)
 * TC-A011: 사이트 설정 API 비인가 접근 → 403
 * TC-I004: 게스트 댓글 작성 → admin 승인 → 공개 노출 전체 흐름
 */
import { test, expect, request as playwrightRequest } from '@playwright/test';
import { ADMIN, EDITOR } from './globalSetup.js';

const API_BASE = 'http://localhost:5000';

const EDITOR2 = { username: 'pw_editor2', email: 'pw_editor2@test.com', password: 'pwpass456!' };

let adminToken = null;
let editorToken = null;
let editor2Token = null;

async function getToken(username, password) {
  const ctx = await playwrightRequest.newContext();
  const res = await ctx.post(`${API_BASE}/api/auth/login`, {
    data: { username, password },
  });
  const json = await res.json();
  await ctx.dispose();
  return json.data.access_token;
}

test.beforeAll(async () => {
  adminToken = await getToken(ADMIN.username, ADMIN.password);
  editorToken = await getToken(EDITOR.username, EDITOR.password);
  editor2Token = await getToken(EDITOR2.username, EDITOR2.password);
});

// ─────────────────────────────────────────────
// TC-A005: 회원 비활성화 → 로그인 401
// ─────────────────────────────────────────────
test('TC-A005: admin이 editor2 비활성화 → editor2 로그인 시도 401', async ({ request }) => {
  // editor2 유저 ID 조회
  const meCtx = await playwrightRequest.newContext();
  const meRes = await meCtx.get(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${editor2Token}` },
  });
  const { data: meData } = await meRes.json();
  const editor2Id = meData.id;
  await meCtx.dispose();

  // admin이 editor2 비활성화
  const deactivateRes = await request.put(
    `${API_BASE}/api/admin/users/${editor2Id}/deactivate`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );
  expect(deactivateRes.status()).toBe(200);

  try {
    // editor2 로그인 시도 → 401
    const loginRes = await request.post(`${API_BASE}/api/auth/login`, {
      data: { username: EDITOR2.username, password: EDITOR2.password },
    });
    expect(loginRes.status()).toBe(401);
  } finally {
    // editor2 복원 (deactivated → editor)
    const restoreCtx = await playwrightRequest.newContext();
    await restoreCtx.put(`${API_BASE}/api/admin/users/${editor2Id}/role`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { role: 'editor' },
    });
    await restoreCtx.dispose();
  }
});

// ─────────────────────────────────────────────
// TC-A008: 게스트 댓글 승인 (pending → approved)
// ─────────────────────────────────────────────
test('TC-A008: 게스트 댓글 승인 → 공개 댓글 목록에 노출', async ({ request }) => {
  const ctx = await playwrightRequest.newContext();

  // 테스트용 포스트 생성
  const postRes = await ctx.post(`${API_BASE}/api/posts`, {
    headers: { Authorization: `Bearer ${editorToken}` },
    data: {
      title: 'Comment Approve Test Post',
      content: '승인 테스트용 포스트',
      slug: `comment-approve-${Date.now()}`,
      status: 'published',
      visibility: 'public',
    },
  });
  const { data: postData } = await postRes.json();
  const postId = postData.id;

  // 게스트 댓글 작성 (pending 상태)
  const commentRes = await ctx.post(`${API_BASE}/api/comments`, {
    data: {
      post_id: postId,
      author_name: 'E2E Guest',
      author_email: 'e2eguest@test.com',
      author_password: 'guestpass123',
      content: 'E2E 게스트 승인 테스트 댓글',
    },
  });
  expect(commentRes.status()).toBe(201);
  const { data: commentData } = await commentRes.json();
  const commentId = commentData.id;

  try {
    // 승인 전: 공개 댓글 목록에 미노출 (pending)
    const beforeRes = await ctx.get(`${API_BASE}/api/comments/post/${postId}`);
    const { data: beforeData } = await beforeRes.json();
    const beforeIds = (beforeData.items || beforeData).map((c) => c.id);
    expect(beforeIds).not.toContain(commentId);

    // admin 승인
    const approveRes = await request.put(
      `${API_BASE}/api/admin/comments/${commentId}/approve`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(approveRes.status()).toBe(200);

    // 승인 후: 공개 댓글 목록에 노출
    const afterRes = await ctx.get(`${API_BASE}/api/comments/post/${postId}`);
    const { data: afterData } = await afterRes.json();
    const afterIds = (afterData.items || afterData).map((c) => c.id);
    expect(afterIds).toContain(commentId);
  } finally {
    await ctx.delete(`${API_BASE}/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${editorToken}` },
    });
    await ctx.dispose();
  }
});

// ─────────────────────────────────────────────
// TC-A009: 게스트 댓글 스팸 처리 (pending → spam)
// ─────────────────────────────────────────────
test('TC-A009: 게스트 댓글 스팸 처리 → 공개 목록 미노출', async ({ request }) => {
  const ctx = await playwrightRequest.newContext();

  // 테스트용 포스트 생성
  const postRes = await ctx.post(`${API_BASE}/api/posts`, {
    headers: { Authorization: `Bearer ${editorToken}` },
    data: {
      title: 'Comment Spam Test Post',
      content: '스팸 테스트용 포스트',
      slug: `comment-spam-${Date.now()}`,
      status: 'published',
      visibility: 'public',
    },
  });
  const { data: postData } = await postRes.json();
  const postId = postData.id;

  // 게스트 댓글 작성
  const commentRes = await ctx.post(`${API_BASE}/api/comments`, {
    data: {
      post_id: postId,
      author_name: 'Spammer',
      author_email: 'spam@test.com',
      author_password: 'spampass123',
      content: '스팸 광고 댓글입니다',
    },
  });
  expect(commentRes.status()).toBe(201);
  const { data: commentData } = await commentRes.json();
  const commentId = commentData.id;

  try {
    // admin 스팸 처리 (reject)
    const rejectRes = await request.put(
      `${API_BASE}/api/admin/comments/${commentId}/reject`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(rejectRes.status()).toBe(200);

    // 스팸 처리 후: 공개 댓글 목록에 미노출
    const afterRes = await ctx.get(`${API_BASE}/api/comments/post/${postId}`);
    const { data: afterData } = await afterRes.json();
    const afterIds = (afterData.items || afterData).map((c) => c.id);
    expect(afterIds).not.toContain(commentId);
  } finally {
    await ctx.delete(`${API_BASE}/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${editorToken}` },
    });
    await ctx.dispose();
  }
});

// ─────────────────────────────────────────────
// TC-A011: 사이트 설정 API 비인가 접근 → 403
// ─────────────────────────────────────────────
test('TC-A011: editor 토큰으로 PUT /api/settings → 403', async ({ request }) => {
  const res = await request.put(`${API_BASE}/api/settings`, {
    headers: { Authorization: `Bearer ${editorToken}` },
    data: { site_skin: 'ocean' },
  });
  expect(res.status()).toBe(403);
});

// ─────────────────────────────────────────────
// TC-I004: 게스트 댓글 → admin 승인 → 공개 노출 전체 흐름
// ─────────────────────────────────────────────
test('TC-I004: 게스트 댓글 작성(pending) → 미노출 확인 → admin 승인 → 노출 확인', async ({ request }) => {
  const ctx = await playwrightRequest.newContext();

  // 포스트 생성
  const postRes = await ctx.post(`${API_BASE}/api/posts`, {
    headers: { Authorization: `Bearer ${editorToken}` },
    data: {
      title: 'Integration Comment Test Post',
      content: '통합 댓글 테스트용 포스트',
      slug: `integration-comment-${Date.now()}`,
      status: 'published',
      visibility: 'public',
    },
  });
  const { data: postData } = await postRes.json();
  const postId = postData.id;

  // Step 1: 비로그인 게스트 댓글 작성
  const commentRes = await request.post(`${API_BASE}/api/comments`, {
    data: {
      post_id: postId,
      author_name: 'Integration Guest',
      author_email: 'intguest@test.com',
      author_password: 'intguestpass',
      content: '통합 테스트 게스트 댓글',
    },
  });
  expect(commentRes.status()).toBe(201);
  const { data: commentData } = await commentRes.json();
  const commentId = commentData.id;

  try {
    // Step 2: 공개 댓글 목록에 미노출 (pending 상태)
    const beforeRes = await ctx.get(`${API_BASE}/api/comments/post/${postId}`);
    const { data: beforeData } = await beforeRes.json();
    const beforeIds = (beforeData.items || beforeData).map((c) => c.id);
    expect(beforeIds).not.toContain(commentId);

    // Step 3: admin 승인
    const approveRes = await request.put(
      `${API_BASE}/api/admin/comments/${commentId}/approve`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(approveRes.status()).toBe(200);

    // Step 4: 승인 후 공개 목록에 노출
    const afterRes = await ctx.get(`${API_BASE}/api/comments/post/${postId}`);
    const { data: afterData } = await afterRes.json();
    const afterIds = (afterData.items || afterData).map((c) => c.id);
    expect(afterIds).toContain(commentId);
  } finally {
    await ctx.delete(`${API_BASE}/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${editorToken}` },
    });
    await ctx.dispose();
  }
});
