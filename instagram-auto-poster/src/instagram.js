// Instagram Graph API（Content Publishing API）を呼び出す薄いクライアント。
// 事前に「Facebookページ ⇔ Instagramビジネス/クリエイターアカウント」の連携と、
// instagram_basic / instagram_content_publish 権限を持つ長期アクセストークンが必要。
const DEFAULT_API_VERSION = 'v21.0';

function apiBase(env) {
  const version = env.GRAPH_API_VERSION || DEFAULT_API_VERSION;
  return `https://graph.facebook.com/${version}`;
}

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const message = data.error ? data.error.message : `HTTP ${res.status}`;
    const err = new Error(`Instagram Graph API error: ${message}`);
    err.detail = data;
    throw err;
  }
  return data;
}

async function graphFetch(env, path, params, method = 'GET') {
  const token = env.IG_ACCESS_TOKEN;
  if (!token) throw new Error('IG_ACCESS_TOKEN is not configured');
  const url = new URL(apiBase(env) + path);

  if (method === 'GET') {
    Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
    url.searchParams.set('access_token', token);
    const res = await fetch(url.toString());
    return handleResponse(res);
  }

  const body = new URLSearchParams({ ...(params || {}), access_token: token });
  const res = await fetch(url.toString(), {
    method,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return handleResponse(res);
}

async function createMediaContainer(env, { imageUrl, caption, mediaType }) {
  const igUserId = env.IG_BUSINESS_ACCOUNT_ID;
  if (!igUserId) throw new Error('IG_BUSINESS_ACCOUNT_ID is not configured');
  if (!imageUrl) throw new Error('imageUrl is required');

  const params = { image_url: imageUrl };
  if (mediaType === 'STORIES') {
    // ストーリーズはキャプション不可。
    params.media_type = 'STORIES';
  } else if (caption) {
    params.caption = caption;
  }
  const data = await graphFetch(env, `/${igUserId}/media`, params, 'POST');
  return data.id;
}

async function publishMediaContainer(env, creationId) {
  const igUserId = env.IG_BUSINESS_ACCOUNT_ID;
  const data = await graphFetch(env, `/${igUserId}/media_publish`, { creation_id: creationId }, 'POST');
  return data.id;
}

export async function publishFeedPost(env, { imageUrl, caption }) {
  const creationId = await createMediaContainer(env, { imageUrl, caption, mediaType: 'IMAGE' });
  return publishMediaContainer(env, creationId);
}

export async function publishStory(env, { imageUrl }) {
  const creationId = await createMediaContainer(env, { imageUrl, mediaType: 'STORIES' });
  return publishMediaContainer(env, creationId);
}

export async function publishPost(env, post) {
  if (post.type === 'story') {
    return publishStory(env, { imageUrl: post.imageUrl });
  }
  return publishFeedPost(env, { imageUrl: post.imageUrl, caption: post.caption });
}
