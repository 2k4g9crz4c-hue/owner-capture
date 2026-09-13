# owner-capture

OWNER CAPTURE - AI conversations to Markdown

## これは何？

ChatGPTやClaudeとの会話を、iPhoneのSafariから簡単にMarkdown形式で保存できる、自分専用の小さなツールです。

- ログインなし・データベースなし・外部API呼び出しなし
- 入力した会話やタイトルは**どこにも送信されません**。すべてiPhoneのブラウザの中だけで処理されます
- 保存したMarkdownファイルには「保存日時・タイトル・本文」が含まれます
- カテゴリ（Inbox / Decision / Idea、初期値はInbox）を選択でき、フロントマターの`category`として保存されます
- 将来Obsidianに取り込みやすいように、ファイルの先頭に`title`・`created`・`tags`を書いたフロントマター（YAML形式のメタ情報）を付けています

```markdown
---
title: "旅行プランの相談"
created: 2026-09-13T21:00:00+09:00
tags: [ai-conversation]
---

# 旅行プランの相談

（ここに会話本文が入ります）
```

## iPhoneでの使い方

### 1. まずはこのページをiPhoneで開けるようにする

このツールは1つのHTMLファイル（`index.html`）だけでできています。iPhoneのSafariから開くには、GitHubの「Pages」機能を使うのが一番簡単です。

1. GitHubでこのリポジトリの **Settings** タブを開く
2. 左メニューの **Pages** を選ぶ
3. 「Build and deployment」の **Source** を `Deploy from a branch` にする
4. Branch を `main`、フォルダを `/ (root)` にして **Save**
5. 数分待つと、ページ上部に `https://(あなたのユーザー名).github.io/owner-capture/` のようなURLが表示されます

### 2. iPhoneのSafariでURLを開く

表示されたURLをSafariで開くと、この保存ツールが表示されます。

- ホーム画面に追加すると、アプリのように使えて便利です
  （Safariの共有ボタン →「ホーム画面に追加」）

### 3. 会話を保存する

1. 「タイトル」欄に会話のタイトルを入力
2. 「会話本文」欄に、ChatGPTやClaudeの会話をコピー＆ペースト
3. 「Markdownに変換」ボタンを押す
4. 画面下にMarkdownのプレビューが表示されるので、好きな方法で保存する
   - **共有 / ファイルに保存**：iPhoneの共有シートが開き、「ファイルに保存」からObsidianのVaultフォルダなどに直接保存できます（iOSアプリ側がファイル共有に対応している場合）
   - **ダウンロード**：ブラウザのダウンロード機能で保存します
   - **コピー**：Markdown全文をクリップボードにコピーします。Obsidianアプリなどに直接貼り付けたいときに便利です

## Obsidianへの取り込み

保存したMarkdownファイルには、Obsidianが認識できるフロントマター（`title` / `created` / `tags`）が入っています。ファイルをObsidianのVaultフォルダに置くだけで、タイトルや作成日時、タグ付きのノートとして扱えます。

## 今回できないこと（あえて作っていない機能）

- ログイン機能
- 会話の一覧管理・検索・データベース保存
- ChatGPT/Claudeとの自動連携（API接続）
- クラウドへの自動アップロード

これらは「個人情報や会話内容を外部に送信しない」「シンプルに保つ」という方針のため、最小版としてはあえて含めていません。将来必要になったら追加を検討してください。
