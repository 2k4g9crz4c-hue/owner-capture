---
title: "この外部脳について"
created: 2026-09-14T00:00:00+09:00
category: Meta
tags: [external-brain, readme]
---

# この外部脳について

このVaultは、owner-capture（AI会話をMarkdownに保存するツール）で
保存した会話や、日々のメモ・決定・アイデアを受け止めるための
「外部脳」です。

## フォルダ構成

- `00_Inbox/` … まだ整理していない会話・メモ（owner-captureの
  初期カテゴリ `Inbox`）
- `10_Decision/` … 決めたこと・意思決定の記録（`Decision`）
- `20_Idea/` … アイデア・発想のメモ（`Idea`）

（カテゴリを追加した場合は、ここに追記する）

## owner-captureとの連携

1. owner-capture（`index.html`、または公開したPagesのURL）で
   ChatGPT/Claudeとの会話をMarkdownに変換する
2. カテゴリ（Inbox / Decision / Idea）を選んで保存する
3. 保存したファイルを、対応するフォルダに手動で移動する
   - `Inbox` → `00_Inbox/`
   - `Decision` → `10_Decision/`
   - `Idea` → `20_Idea/`

## frontmatterの形式

```markdown
---
title: "会話のタイトル"
created: 2026-09-13T21:00:00+09:00
category: Inbox
tags: [ai-conversation]
---
```

新しく手書きでノートを作るときも、`templates/`内の各カテゴリの
テンプレートを使うと同じ形式で書ける。

## 運用のヒント

- 迷ったらまず `00_Inbox/` に入れて、あとで読み返して振り分ける
- 定期的にInboxを見直し、`Decision`/`Idea`など該当フォルダへ移す
- フォルダやカテゴリを増やしたときは、このファイルの
  「フォルダ構成」を更新しておく
