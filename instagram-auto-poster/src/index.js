import { createPost, listPosts, getPost, updatePost, deletePost, listDuePosts } from './queue.js';
import { publishPost } from './instagram.js';
import { addSource, listSources, deleteSource, saveSourceState, pollSourceForNewItems, renderTemplate } from './rss.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function checkAuth(request, env) {
  // API_KEY未設定時は認証をスキップする（ローカル開発用）。本番では必ず設定すること。
  if (!env.API_KEY) return true;
  return (request.headers.get('x-api-key') || '') === env.API_KEY;
}

async function handlePosts(request, env) {
  if (request.method === 'GET') {
    const status = new URL(request.url).searchParams.get('status') || undefined;
    return json(await listPosts(env, { status }));
  }
  if (request.method === 'POST') {
    const body = await request.json().catch(() => null);
    if (!body || !body.imageUrl) return json({ error: 'imageUrl is required' }, 400);
    const post = await createPost(env, {
      type: body.type,
      imageUrl: body.imageUrl,
      caption: body.caption,
      scheduledAt: body.scheduledAt,
      source: 'manual',
    });
    return json(post, 201);
  }
  return json({ error: 'Method Not Allowed' }, 405);
}

async function handlePostById(request, env, id) {
  if (request.method === 'GET') {
    const post = await getPost(env, id);
    return post ? json(post) : json({ error: 'Not Found' }, 404);
  }
  if (request.method === 'DELETE') {
    const post = await getPost(env, id);
    if (!post) return json({ error: 'Not Found' }, 404);
    await deletePost(env, id);
    return json({ ok: true });
  }
  return json({ error: 'Method Not Allowed' }, 405);
}

async function handleApprovePost(request, env, id) {
  if (request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);
  const post = await getPost(env, id);
  if (!post) return json({ error: 'Not Found' }, 404);
  return json(await updatePost(env, id, { status: 'pending', error: null }));
}

async function handleSources(request, env) {
  if (request.method === 'GET') return json(await listSources(env));
  if (request.method === 'POST') {
    const body = await request.json().catch(() => null);
    if (!body || !body.url) return json({ error: 'url is required' }, 400);
    return json(await addSource(env, body), 201);
  }
  return json({ error: 'Method Not Allowed' }, 405);
}

async function handleSourceById(request, env, id) {
  if (request.method !== 'DELETE') return json({ error: 'Method Not Allowed' }, 405);
  await deleteSource(env, id);
  return json({ ok: true });
}

// pending状態でscheduledAtが未来ではない投稿をInstagramへ公開する。
async function publishDuePosts(env) {
  const due = await listDuePosts(env);
  const results = [];
  for (const post of due) {
    try {
      const mediaId = await publishPost(env, post);
      await updatePost(env, post.id, {
        status: 'published',
        publishedMediaId: mediaId,
        publishedAt: new Date().toISOString(),
        error: null,
      });
      results.push({ id: post.id, ok: true, mediaId });
    } catch (err) {
      await updatePost(env, post.id, { status: 'failed', error: String(err.message || err) });
      results.push({ id: post.id, ok: false, error: String(err.message || err) });
    }
  }
  return results;
}

// 登録済みRSSソースをポーリングし、新着記事から投稿の下書き/予約を作成する。
// autoPublish=trueのソースはpendingとして即キュー投入、falseのソースはdraft（レビュー待ち）にする。
async function pollAllSources(env) {
  const sources = await listSources(env);
  const created = [];
  for (const source of sources) {
    try {
      const { newItems, latestGuid } = await pollSourceForNewItems(source);
      for (const item of newItems) {
        const caption = renderTemplate(source.captionTemplate, item);
        const post = await createPost(env, {
          type: source.mediaType,
          imageUrl: item.image,
          caption,
          source: `rss:${source.id}`,
        });
        if (!item.image) {
          await updatePost(env, post.id, { status: 'failed', error: '記事内に画像が見つからなかったため投稿を保留しました' });
        } else if (!source.autoPublish) {
          await updatePost(env, post.id, { status: 'draft' });
        }
        created.push(post.id);
      }
      if (latestGuid !== source.lastSeenGuid) {
        await saveSourceState(env, { ...source, lastSeenGuid: latestGuid });
      }
    } catch (err) {
      console.error(`RSSソース ${source.url} の取得に失敗:`, err.message || err);
    }
  }
  return created;
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/health') return json({ ok: true });
    if (!checkAuth(request, env)) return json({ error: 'Unauthorized' }, 401);

    if (pathname === '/api/posts') return handlePosts(request, env);

    const approveMatch = pathname.match(/^\/api\/posts\/([^/]+)\/approve$/);
    if (approveMatch) return handleApprovePost(request, env, approveMatch[1]);

    const postMatch = pathname.match(/^\/api\/posts\/([^/]+)$/);
    if (postMatch) return handlePostById(request, env, postMatch[1]);

    if (pathname === '/api/sources') return handleSources(request, env);

    const sourceMatch = pathname.match(/^\/api\/sources\/([^/]+)$/);
    if (sourceMatch) return handleSourceById(request, env, sourceMatch[1]);

    if (pathname === '/api/run/publish' && request.method === 'POST') {
      return json({ results: await publishDuePosts(env) });
    }
    if (pathname === '/api/run/poll' && request.method === 'POST') {
      return json({ created: await pollAllSources(env) });
    }

    return json({ error: 'Not Found' }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        await pollAllSources(env);
        await publishDuePosts(env);
      })()
    );
  },
};
