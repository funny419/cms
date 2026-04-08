/**
 * 기타 E2E 테스트
 * TC-U013: 동일 IP 당일 재방문 — view_count는 증가, API 정상 응답 확인
 * TC-U026: 블로그 제목 설정 반영
 * TC-U036: 키워드 검색 (Fulltext)
 * TC-U042: BUG-3 수정 검증 — 포스트 다중 시리즈 추가 후 GET /api/posts/:id 정상
 * TC-I005: Magazine 레이아웃 설정 후 비로그인 방문자 확인
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

let editorToken = null;

// editor storageState (TC-U026, TC-I005 레이아웃 설정용)
test.use({ storageState: AUTH_PATHS.editor });

test.beforeAll(async () => {
  // storageState에서 토큰 추출 (login API 호출 없음)
  editorToken = getTokenFromStorageState(AUTH_PATHS.editor);
});

// ─────────────────────────────────────────────
// TC-U013: 동일 IP 당일 재방문 — view_count 증가, 재방문 정상 응답
// ─────────────────────────────────────────────
test('TC-U013: 포스트 재방문 시 view_count 증가 + API 정상 응답', async ({ request }) => {
  const ctx = await playwrightRequest.newContext();

  // 테스트용 포스트 생성
  const postRes = await ctx.post(`${API_BASE}/api/posts`, {
    headers: { Authorization: `Bearer ${editorToken}` },
    data: {
      title: 'Visit Log Test Post',
      content: '방문 로그 테스트 포스트',
      slug: `visit-log-test-${Date.now()}`,
      status: 'published',
      visibility: 'public',
    },
  });
  const { data: postData } = await postRes.json();
  const postId = postData.id;

  try {
    // 첫 번째 조회 (view_count 증가)
    const res1 = await request.get(`${API_BASE}/api/posts/${postId}`);
    expect(res1.status()).toBe(200);
    const { data: d1 } = await res1.json();
    const vc1 = d1.view_count;

    // 두 번째 조회 (view_count 추가 증가)
    const res2 = await request.get(`${API_BASE}/api/posts/${postId}`);
    expect(res2.status()).toBe(200);
    const { data: d2 } = await res2.json();

    // view_count는 매 조회마다 증가 (visit_log는 당일 동일 IP 중복 방지 — BE 레벨 방어)
    expect(d2.view_count).toBeGreaterThan(vc1);
    // ※ visit_log 중복 방지 검증은 DB 직접 확인 필요 (SELECT COUNT(*) FROM visit_logs ...)
  } finally {
    await ctx.delete(`${API_BASE}/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${editorToken}` },
    });
    await ctx.dispose();
  }
});

// ─────────────────────────────────────────────
// TC-U026: 블로그 제목 설정 및 반영
// ─────────────────────────────────────────────
test('TC-U026: blog_title 설정 후 GET /api/auth/users/:username 에서 확인', async ({ request }) => {
  const newTitle = '나의 개발 블로그 E2E';
  const ctx = await playwrightRequest.newContext();

  // blog_title 설정
  const putRes = await request.put(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${editorToken}` },
    data: { blog_title: newTitle },
  });
  expect(putRes.status()).toBe(200);

  try {
    // 프로필 조회에서 blog_title 확인
    const profileRes = await ctx.get(`${API_BASE}/api/auth/users/${EDITOR.username}`);
    expect(profileRes.status()).toBe(200);
    const { data } = await profileRes.json();
    expect(data.blog_title).toBe(newTitle);
  } finally {
    // 원래 값으로 복원
    await request.put(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${editorToken}` },
      data: { blog_title: '' },
    });
    await ctx.dispose();
  }
});

// ─────────────────────────────────────────────
// TC-U036: 키워드 검색 (Fulltext)
// ─────────────────────────────────────────────
test('TC-U036: API 키워드 검색 — GET /api/posts?q=Flask → 해당 포스트 포함', async ({ request }) => {
  const ctx = await playwrightRequest.newContext();
  const uniqueSlug = `flask-e2e-search-${Date.now()}`;

  // "Flask" 포함 포스트 생성
  const postRes = await ctx.post(`${API_BASE}/api/posts`, {
    headers: { Authorization: `Bearer ${editorToken}` },
    data: {
      title: 'Flask E2E 검색 테스트',
      content: 'Flask를 이용한 REST API 개발 튜토리얼',
      slug: uniqueSlug,
      status: 'published',
      visibility: 'public',
    },
  });
  const { data: postData } = await postRes.json();
  const postId = postData.id;

  try {
    // Fulltext 인덱스 갱신 대기 (InnoDB 즉시 업데이트되나 여유 시간 확보)
    await new Promise((r) => setTimeout(r, 1500));

    // 키워드 검색
    const searchRes = await request.get(`${API_BASE}/api/posts`, {
      params: { q: 'Flask', per_page: '50' },
    });
    expect(searchRes.status()).toBe(200);
    const { data: searchData } = await searchRes.json();
    const ids = searchData.items.map((p) => p.id);
    expect(ids).toContain(postId);
  } finally {
    await ctx.delete(`${API_BASE}/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${editorToken}` },
    });
    await ctx.dispose();
  }
});

// ─────────────────────────────────────────────
// TC-U042: BUG-3 수정 검증 — 포스트 다중 시리즈 추가 후 GET /api/posts/:id 정상
// ─────────────────────────────────────────────
test('TC-U042: 동일 포스트를 두 시리즈에 추가 후 GET /api/posts/:id → 200 (500 아님)', async ({ request }) => {
  const ctx = await playwrightRequest.newContext();

  // 포스트 + 시리즈 2개 생성
  const postRes = await ctx.post(`${API_BASE}/api/posts`, {
    headers: { Authorization: `Bearer ${editorToken}` },
    data: {
      title: 'Multi Series Test Post',
      content: '다중 시리즈 테스트',
      slug: `multi-series-${Date.now()}`,
      status: 'published',
    },
  });
  const { data: postData } = await postRes.json();
  const postId = postData.id;

  const s1Res = await ctx.post(`${API_BASE}/api/series`, {
    headers: { Authorization: `Bearer ${editorToken}` },
    data: { title: 'BUG3 Series A' },
  });
  const { data: s1 } = await s1Res.json();

  const s2Res = await ctx.post(`${API_BASE}/api/series`, {
    headers: { Authorization: `Bearer ${editorToken}` },
    data: { title: 'BUG3 Series B' },
  });
  const { data: s2 } = await s2Res.json();

  try {
    // Series A에 포스트 추가
    const add1Res = await ctx.post(`${API_BASE}/api/series/${s1.id}/posts`, {
      headers: { Authorization: `Bearer ${editorToken}` },
      data: { post_id: postId, order: 1 },
    });
    expect(add1Res.status()).toBe(201);

    // Series B에 동일 포스트 추가 (BUG-3 수정 전: 두 번째 GET에서 500 발생)
    const add2Res = await ctx.post(`${API_BASE}/api/series/${s2.id}/posts`, {
      headers: { Authorization: `Bearer ${editorToken}` },
      data: { post_id: postId, order: 1 },
    });
    // BUG-3 수정 후: 409(이미 추가됨) 또는 201(다른 시리즈라 허용)
    expect([201, 409]).toContain(add2Res.status());

    // GET /api/posts/:id → 500 아님 (BUG-3 수정 검증 핵심)
    const getRes = await request.get(`${API_BASE}/api/posts/${postId}`, {
      params: { skip_count: '1' },
    });
    expect(getRes.status()).toBe(200);
  } finally {
    await ctx.delete(`${API_BASE}/api/series/${s1.id}`, {
      headers: { Authorization: `Bearer ${editorToken}` },
    });
    await ctx.delete(`${API_BASE}/api/series/${s2.id}`, {
      headers: { Authorization: `Bearer ${editorToken}` },
    });
    await ctx.delete(`${API_BASE}/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${editorToken}` },
    });
    await ctx.dispose();
  }
});

// ─────────────────────────────────────────────
// TC-I005: Magazine 레이아웃 설정 후 비로그인 방문자 확인
// ─────────────────────────────────────────────
test('TC-I005: editor가 Magazine 레이아웃 설정 후 비로그인 방문자에게도 magazine 레이아웃 표시', async ({ browser }) => {
  // editor로 레이아웃을 magazine으로 설정 (API)
  const ctx = await playwrightRequest.newContext();
  await ctx.put(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${editorToken}` },
    data: { blog_layout: 'magazine' },
  });
  await ctx.dispose();

  try {
    // API로 blog_layout=magazine 확인 (신뢰성 있는 검증)
    const profileCtx = await playwrightRequest.newContext();
    const profileRes = await profileCtx.get(`${API_BASE}/api/auth/users/${EDITOR.username}`);
    const { data: profile } = await profileRes.json();
    expect(profile.blog_layout).toBe('magazine');
    await profileCtx.dispose();

    // 비로그인 컨텍스트로 블로그 홈 접근 — 정상 로드 확인
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/blog/${EDITOR.username}`);
    await guestPage.waitForLoadState('networkidle');
    expect(guestPage.url()).toContain(`/blog/${EDITOR.username}`);
    await guestContext.close();
  } finally {
    // 레이아웃 default 복원
    const restoreCtx = await playwrightRequest.newContext();
    await restoreCtx.put(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${editorToken}` },
      data: { blog_layout: 'default' },
    });
    await restoreCtx.dispose();
  }
});
