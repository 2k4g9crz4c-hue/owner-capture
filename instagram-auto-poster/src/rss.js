// RSS/Atomフィードを取得し、Instagram投稿の下書きを自動生成するためのヘルパー。
// Cloudflare Workers環境にはXML DOMパーサーが無いため、簡易的な正規表現ベースで
// 一般的なRSS 2.0 / Atomフィードから必要な項目だけを抜き出す（厳密なXMLパースは行わない）。
const SOURCE_PREFIX = 'rss:source:';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function addSource(env, { url, captionTemplate, autoPublish, mediaType }) {
  const id = genId();
  const source = {
    id,
    url,
    captionTemplate: captionTemplate || '{title}\n\n{link}',
    autoPublish: !!autoPublish,
    mediaType: mediaType === 'story' ? 'story' : 'feed',
    lastSeenGuid: null,
    createdAt: new Date().toISOString(),
  };
  await env.IG_POSTS.put(SOURCE_PREFIX + id, JSON.stringify(source));
  return source;
}

export async function listSources(env) {
  const list = await env.IG_POSTS.list({ prefix: SOURCE_PREFIX });
  const sources = [];
  for (const key of list.keys) {
    const raw = await env.IG_POSTS.get(key.name);
    if (raw) sources.push(JSON.parse(raw));
  }
  return sources;
}

export async function deleteSource(env, id) {
  await env.IG_POSTS.delete(SOURCE_PREFIX + id);
}

export async function saveSourceState(env, source) {
  await env.IG_POSTS.put(SOURCE_PREFIX + source.id, JSON.stringify(source));
}

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!match) return '';
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function extractImage(block) {
  const enclosure = block.match(/<enclosure[^>]*url="([^"]+)"[^>]*>/i);
  if (enclosure) return enclosure[1];
  const mediaContent = block.match(/<media:content[^>]*url="([^"]+)"[^>]*>/i);
  if (mediaContent) return mediaContent[1];
  const imgTag = block.match(/<img[^>]*src="([^"]+)"/i);
  if (imgTag) return imgTag[1];
  return null;
}

function extractAtomLink(block) {
  const match = block.match(/<link[^>]*href="([^"]+)"[^>]*\/?>/i);
  return match ? match[1] : '';
}

export async function fetchFeedItems(feedUrl) {
  const res = await fetch(feedUrl);
  if (!res.ok) throw new Error(`RSSの取得に失敗しました: HTTP ${res.status}`);
  const xml = await res.text();

  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  const items = [];
  for (const block of itemBlocks) {
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link') || extractAtomLink(block);
    const guid = extractTag(block, 'guid') || extractTag(block, 'id') || link;
    const description = extractTag(block, 'description') || extractTag(block, 'summary');
    const image = extractImage(block);
    if (!guid) continue;
    items.push({ guid, title, link, description, image });
  }
  return items;
}

export function renderTemplate(template, item) {
  return template
    .replace(/\{title\}/g, item.title || '')
    .replace(/\{link\}/g, item.link || '')
    .replace(/\{description\}/g, item.description || '');
}

// 新着記事だけを検出する。初回ポーリング（lastSeenGuidが無い状態）では、
// 過去記事を一斉投稿してしまわないよう、最新GUIDの記録のみ行い投稿は生成しない。
export async function pollSourceForNewItems(source) {
  const items = await fetchFeedItems(source.url);
  if (!items.length) return { newItems: [], latestGuid: source.lastSeenGuid };

  if (!source.lastSeenGuid) {
    return { newItems: [], latestGuid: items[0].guid };
  }

  const lastIndex = items.findIndex((i) => i.guid === source.lastSeenGuid);
  const newItems = lastIndex === -1 ? items.slice(0, 5) : items.slice(0, lastIndex);
  return { newItems: newItems.reverse(), latestGuid: items[0].guid };
}
