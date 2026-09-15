# instagram-auto-poster

Instagramへ自動で投稿するためのサーバーレスAPI（Cloudflare Workers）です。

## これは何？ / owner-captureとの関係

owner-captureのメイン機能（`index.html`）は「ログインなし・DBなし・外部API呼び出しなし」という方針で作られた、端末内完結の会話保存ツールです。

一方、Instagramへの自動投稿は仕組み上、

- Instagram Graph API（Metaの外部API）を呼び出す必要がある
- アクセストークンをブラウザに置くと盗まれるため、サーバー側で安全に保持する必要がある

という、上記の方針とは根本的に異なる前提が必要になります。そのため、影響範囲を分離する目的で `index.html` とは別の独立したモジュール（このディレクトリ）として実装しています。`index.html` 側の「外部送信なし」という性質はそのまま維持されます。

## できること

- 画像＋キャプションの通常フィード投稿
- ストーリーズ投稿（画像のみ、キャプション不可というInstagram側の仕様に準拠）
- 予約投稿（`scheduledAt` を指定すると、その時刻以降にcronジョブが自動公開）
- RSSフィードをポーリングし、新着記事から投稿を自動生成
  - `autoPublish: true` のソースはそのまま自動投稿
  - `autoPublish: false`（デフォルト）のソースは `draft` として保存され、`/approve` で承認するまで投稿されない
  - 初回ポーリング時は過去記事を一斉投稿しないよう、最新記事のGUIDだけを記録する

## 前提条件

1. Instagram **ビジネス** または **クリエイター** アカウントを持っている
2. そのアカウントがFacebookページに連携されている
3. [Meta for Developers](https://developers.facebook.com/) でアプリを作成済みである
4. 上記アプリで以下の権限を持つ長期（60日）アクセストークンを取得済みである
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`

トークン取得やInstagramビジネスアカウントIDの確認は、Meta の [Graph API Explorer](https://developers.facebook.com/tools/explorer/) から行うのが簡単です。

```
GET /me/accounts                              → ページ一覧とページアクセストークンを取得
GET /{page-id}?fields=instagram_business_account → 連携中のInstagramビジネスアカウントIDを取得
```

ページアクセストークンは [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/) で長期トークンに交換してください。

**投稿数の上限**: Instagram Graph APIは1アカウントあたり24時間で最大25件までの投稿制限があります。RSS自動投稿を有効にする際は投稿頻度に注意してください。

## セットアップ

```bash
cd instagram-auto-poster
npm install

# KV namespaceを作成し、出力されたidをwrangler.tomlの id に設定する
npx wrangler kv namespace create IG_POSTS

# シークレットを設定する
npx wrangler secret put IG_ACCESS_TOKEN
npx wrangler secret put IG_BUSINESS_ACCOUNT_ID
npx wrangler secret put API_KEY   # 任意の文字列。APIを保護するための鍵

# デプロイ
npm run deploy
```

ローカル開発時は `.dev.vars.example` を `.dev.vars` にコピーして値を入れ、`npm run dev` で起動できます。

## API

すべてのリクエスト（`/health` を除く）には `x-api-key: <API_KEY>` ヘッダーが必要です（`API_KEY` シークレット未設定時のみ省略可、開発用）。

### 投稿を作成する

```bash
curl -X POST https://<your-worker>.workers.dev/api/posts \
  -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
  -d '{
    "type": "feed",
    "imageUrl": "https://example.com/photo.jpg",
    "caption": "こんにちは #instagram",
    "scheduledAt": "2026-09-20T09:00:00+09:00"
  }'
```

- `type`: `"feed"`（通常投稿）または `"story"`（ストーリーズ、`caption` は無視されます）
- `imageUrl`: 公開URL上の画像（Instagram側がこのURLを取得できる必要があります）
- `scheduledAt`: 省略するとcron実行時に即座に公開されます

### 投稿一覧・詳細・取消

```bash
curl -H "x-api-key: $API_KEY" https://<your-worker>.workers.dev/api/posts
curl -H "x-api-key: $API_KEY" https://<your-worker>.workers.dev/api/posts?status=pending
curl -H "x-api-key: $API_KEY" -X DELETE https://<your-worker>.workers.dev/api/posts/<id>
```

`status` は `pending` / `draft` / `published` / `failed` のいずれか。

### 下書き（RSS自動生成分）を承認する

```bash
curl -X POST -H "x-api-key: $API_KEY" https://<your-worker>.workers.dev/api/posts/<id>/approve
```

### RSSソースを登録する

```bash
curl -X POST https://<your-worker>.workers.dev/api/sources \
  -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/feed.xml",
    "captionTemplate": "{title}\n\n{link}",
    "autoPublish": false,
    "mediaType": "feed"
  }'
```

- `captionTemplate` は `{title}` `{link}` `{description}` を置換できます
- 記事に画像（`<enclosure>` / `<media:content>` / 本文中の `<img>`）が含まれない場合、その投稿は `failed` としてスキップされます

### 即時実行（手動トリガー）

cronを待たずに今すぐ実行したい場合:

```bash
curl -X POST -H "x-api-key: $API_KEY" https://<your-worker>.workers.dev/api/run/poll     # RSS取り込み
curl -X POST -H "x-api-key: $API_KEY" https://<your-worker>.workers.dev/api/run/publish  # 予約投稿の公開
```

## セキュリティ上の注意

- `IG_ACCESS_TOKEN` は必ず `wrangler secret` で設定し、コード・リポジトリに直接書かないこと
- `API_KEY` を設定せずに本番デプロイすると誰でもAPIを呼び出せてしまうため、必ず設定すること
- 画像URLは公開URLである必要があるため、他人に見られたくない画像を扱わないこと
