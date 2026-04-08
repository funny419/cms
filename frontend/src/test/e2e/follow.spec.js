/**
 * 팔로우 / 이웃 피드 E2E 테스트
 * TC-U031: 팔로우/언팔로우 토글
 * TC-U032: 본인 팔로우 불가 → 400
 * TC-U033: 이웃 피드 포스트 노출
 * TC-U034: 피드 — private 포스트 미노출
 * TC-I002: 팔로우 후 피드 visibility 필터 (public+members_only 노출, private 미노출)
 */
import { readFileSync } from 'fs';
import { test, expect, request as playwrightRequest } from '@playwright/test';
import { AUTH_PATHS, EDITOR } from './globalSetup.js';

const API_BASE = 'http://localhost:5000';

let editorToken = null;
let editor2Token = null;

function getTokenFromStorageState(authPath) {
  const state = JSON.parse(readFileSync(authPath, 'utf8'));
  const ls = state.origins?.[0]?.localStorage ?? [];
  return ls.find((x) => x.name === 'token')?.value;
}

test.beforeAll(async () => {
  editorToken = getTokenFromStorageState(AUTH_PATHS.editor);
  editor2Token = getTokenFromStorageState(AUTH_PATHS.editor2);

  // 혹시 남아있는 팔로우 관계 정리
  await fetch(`${API_BASE}/api/users/${EDITOR.username}/follow`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${editor2Token}` },
  }).catch(() => {});
});

// ─────────────────────────────────────────────
// TC-U031: 팔로우/언팔로우 토글
// ─────────────────────────────────────────────
test('TC-U031: 팔로우 후 follower_count +1, 언팔로우 후 -1', async ({ request }) => {
  // 팔로우 전 follower_count 조회
  const beforeRes = await request.get(`${API_BASE}/api/auth/users/${EDITOR.username}`);
  const { data: before } = await beforeRes.json();
  const beforeCount = before.follower_count;

  // editor2가 editor1(pw_editor)을 팔로우
  const followRes = await request.post(`${API_BASE}/api/users/${EDITOR.username}/follow`, {
    headers: { Authorization: `Bearer ${editor2Token}` },
  });
  expect([200, 201]).toContain(followRes.status());
  const { data: followData } = await followRes.json();
  expect(followData.following).toBe(true);

  // follower_count +1 확인
  const afterFollowRes = await request.get(`${API_BASE}/api/auth/users/${EDITOR.username}`);
  const { data: afterFollow } = await afterFollowRes.json();
  expect(afterFollow.follower_count).toBe(beforeCount + 1);

  // 언팔로우
  const unfollowRes = await request.delete(`${API_BASE}/api/users/${EDITOR.username}/follow`, {
    headers: { Authorization: `Bearer ${editor2Token}` },
  });
  expect(unfollowRes.status()).toBe(200);
  const { data: unfollowData } = await unfollowRes.json();
  expect(unfollowData.following).toBe(false);

  // follower_count 복원 확인
  const afterUnfollowRes = await request.get(`${API_BASE}/api/auth/users/${EDITOR.username}`);
  const { data: afterUnfollow } = await afterUnfollowRes.json();
  expect(afterUnfollow.follower_count).toBe(beforeCount);
});

// ─────────────────────────────────────────────
// TC-U032: 본인 팔로우 불가 → 400
// ─────────────────────────────────────────────
test('TC-U032: 본인 팔로우 시도 → 400', async ({ request }) => {
  const res = await request.post(`${API_BASE}/api/users/${EDITOR.username}/follow`, {
    headers: { Authorization: `Bearer ${editorToken}` },
  });
  expect(res.status()).toBe(400);
});

// ─────────────────────────────────────────────
// TC-U033: 이웃 피드 포스트 노출
// ─────────────────────────────────────────────
test('TC-U033: editor2가 editor1 팔로우 후 피드에 editor1 포스트 노출', async ({ request }) => {
  const ctx = await playwrightRequest.newContext();

  // editor1 public 포스트 생성
  const postRes = await ctx.post(`${API_BASE}/api/posts`, {
    headers: { Authorization: `Bearer ${editorToken}` },
    data: {
      title: 'Feed Test Public Post',
      content: '피드 테스트 포스트',
      slug: `feed-test-public-${Date.now()}`,
      status: 'published',
      visibility: 'public',
    },
  });
  const { data: postData } = await postRes.json();
  const postId = postData.id;

  // editor2가 editor1 팔로우
  await ctx.post(`${API_BASE}/api/users/${EDITOR.username}/follow`, {
    headers: { Authorization: `Bearer ${editor2Token}` },
  });

  try {
    // editor2 피드에서 editor1 포스트 확인
    const feedRes = await request.get(`${API_BASE}/api/feed`, {
      headers: { Authorization: `Bearer ${editor2Token}` },
    });
    expect(feedRes.status()).toBe(200);
    const { data: feedData } = await feedRes.json();
    const postIds = feedData.items.map((p) => p.id);
    expect(postIds).toContain(postId);
  } finally {
    // 언팔로우 + 포스트 삭제
    await ctx.delete(`${API_BASE}/api/users/${EDITOR.username}/follow`, {
      headers: { Authorization: `Bearer ${editor2Token}` },
    });
    await ctx.delete(`${API_BASE}/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${editorToken}` },
    });
    await ctx.dispose();
  }
});

// ─────────────────────────────────────────────
// TC-U034: 피드 — private 포스트 미노출
// ─────────────────────────────────────────────
test('TC-U034: editor1 private 포스트는 editor2 피드에 미노출', async ({ request }) => {
  const ctx = await playwrightRequest.newContext();

  // editor1 private 포스트 생성
  const postRes = await ctx.post(`${API_BASE}/api/posts`, {
    headers: { Authorization: `Bearer ${editorToken}` },
    data: {
      title: 'Feed Test Private Post',
      content: '비공개 포스트',
      slug: `feed-test-private-${Date.now()}`,
      status: 'published',
      visibility: 'private',
    },
  });
  const { data: postData } = await postRes.json();
  const postId = postData.id;

  // editor2가 editor1 팔로우
  await ctx.post(`${API_BASE}/api/users/${EDITOR.username}/follow`, {
    headers: { Authorization: `Bearer ${editor2Token}` },
  });

  try {
    // editor2 피드에 private 포스트 없어야 함
    const feedRes = await request.get(`${API_BASE}/api/feed`, {
      headers: { Authorization: `Bearer ${editor2Token}` },
    });
    expect(feedRes.status()).toBe(200);
    const { data: feedData } = await feedRes.json();
    const postIds = feedData.items.map((p) => p.id);
    expect(postIds).not.toContain(postId);
  } finally {
    await ctx.delete(`${API_BASE}/api/users/${EDITOR.username}/follow`, {
      headers: { Authorization: `Bearer ${editor2Token}` },
    });
    await ctx.delete(`${API_BASE}/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${editorToken}` },
    });
    await ctx.dispose();
  }
});

// ─────────────────────────────────────────────
// TC-I002: 팔로우 후 피드 visibility 필터 검증
// ─────────────────────────────────────────────
test('TC-I002: 피드 — public+members_only 노출, private 미노출', async ({ request }) => {
  const ctx = await playwrightRequest.newContext();
  const createdIds = [];

  // editor1 포스트 3종 생성
  const visibilities = [
    { title: 'Feed Visibility Public', visibility: 'public' },
    { title: 'Feed Visibility Members', visibility: 'members_only' },
    { title: 'Feed Visibility Private', visibility: 'private' },
  ];

  for (const v of visibilities) {
    const pr = await ctx.post(`${API_BASE}/api/posts`, {
      headers: { Authorization: `Bearer ${editorToken}` },
      data: {
        title: v.title,
        content: `${v.title} 내용`,
        slug: `feed-vis-${v.visibility}-${Date.now()}`,
        status: 'published',
        visibility: v.visibility,
      },
    });
    const { data } = await pr.json();
    createdIds.push(data.id);
  }

  // editor2가 editor1 팔로우
  await ctx.post(`${API_BASE}/api/users/${EDITOR.username}/follow`, {
    headers: { Authorization: `Bearer ${editor2Token}` },
  });

  try {
    const feedRes = await request.get(`${API_BASE}/api/feed`, {
      headers: { Authorization: `Bearer ${editor2Token}` },
    });
    expect(feedRes.status()).toBe(200);
    const { data: feedData } = await feedRes.json();
    const feedPostIds = feedData.items.map((p) => p.id);

    // public 포스트: 피드에 있음
    expect(feedPostIds).toContain(createdIds[0]);
    // members_only 포스트: 피드에 있음 (팔로워는 로그인 사용자)
    expect(feedPostIds).toContain(createdIds[1]);
    // private 포스트: 피드에 없음
    expect(feedPostIds).not.toContain(createdIds[2]);
  } finally {
    await ctx.delete(`${API_BASE}/api/users/${EDITOR.username}/follow`, {
      headers: { Authorization: `Bearer ${editor2Token}` },
    });
    for (const pid of createdIds) {
      await ctx.delete(`${API_BASE}/api/posts/${pid}`, {
        headers: { Authorization: `Bearer ${editorToken}` },
      });
    }
    await ctx.dispose();
  }
});
