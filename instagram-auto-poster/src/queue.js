// 投稿キューをCloudflare Workers KVに保存するための最小限のヘルパー群。
const POST_PREFIX = 'post:';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function createPost(env, { type, imageUrl, caption, scheduledAt, source }) {
  const id = genId();
  const post = {
    id,
    type: type === 'story' ? 'story' : 'feed',
    imageUrl,
    caption: caption || '',
    scheduledAt: scheduledAt || null,
    status: 'pending',
    source: source || 'manual',
    createdAt: new Date().toISOString(),
    publishedAt: null,
    publishedMediaId: null,
    error: null,
  };
  await env.IG_POSTS.put(POST_PREFIX + id, JSON.stringify(post));
  return post;
}

export async function getPost(env, id) {
  const raw = await env.IG_POSTS.get(POST_PREFIX + id);
  return raw ? JSON.parse(raw) : null;
}

export async function updatePost(env, id, patch) {
  const post = await getPost(env, id);
  if (!post) return null;
  const updated = { ...post, ...patch };
  await env.IG_POSTS.put(POST_PREFIX + id, JSON.stringify(updated));
  return updated;
}

export async function deletePost(env, id) {
  await env.IG_POSTS.delete(POST_PREFIX + id);
}

export async function listPosts(env, { status } = {}) {
  const list = await env.IG_POSTS.list({ prefix: POST_PREFIX });
  const posts = [];
  for (const key of list.keys) {
    const raw = await env.IG_POSTS.get(key.name);
    if (!raw) continue;
    const post = JSON.parse(raw);
    if (!status || post.status === status) posts.push(post);
  }
  posts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return posts;
}

// scheduledAtが未指定、または現在時刻を過ぎているpending投稿を返す。
export async function listDuePosts(env) {
  const pending = await listPosts(env, { status: 'pending' });
  const now = Date.now();
  return pending.filter((p) => !p.scheduledAt || new Date(p.scheduledAt).getTime() <= now);
}
