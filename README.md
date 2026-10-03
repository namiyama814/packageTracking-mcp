# package-tracking-mcp

日本の配送会社の荷物追跡を AI クライアントから使えるようにする、Cloudflare Workers 上の remote MCP サーバーです。

対応キャリア:

- 日本郵便
- 佐川急便
- ヤマト運輸
- 西濃運輸
- 福山通運

伝票番号だけ渡せばキャリアを自動判定して問い合わせます。`carrier` を明示指定することもできます。

## 注意

- 各社の**公開追跡 Web ページを取得して HTML をパース**しています（公式 API ではありません）。
- HTML 構造の変更で壊れる可能性があります。
- 各社の利用規約の範囲で、個人利用を想定しています。
- 本番公開する場合は共有シークレットを必ず設定してください。

## MCP ツール

### `track_package`

荷物を追跡します。

| 引数 | 必須 | 説明 |
| --- | --- | --- |
| `tracking_number` | yes | 伝票番号（ハイフン付き可） |
| `carrier` | no | `japanpost` / `sagawa` / `yamato` / `seino` / `fukuyama` |

### `list_carriers`

対応キャリアと伝票番号の目安を返します。

## セットアップ

```bash
npm install
npm run types
cp .dev.vars.example .dev.vars
# .dev.vars の MCP_SHARED_SECRET を長いランダム文字列に変更
```

## ローカル起動

```bash
npm run dev
```

エンドポイント:

- 案内: `http://localhost:8787/`
- MCP: `http://localhost:8787/mcp`

認証ヘッダー:

```http
Authorization: Bearer <MCP_SHARED_SECRET>
```

## デプロイ

```bash
npx wrangler secret put MCP_SHARED_SECRET
npm run deploy
```

デプロイ後の MCP URL 例:

`https://package-tracking-mcp.<your-subdomain>.workers.dev/mcp`

## クライアント接続例

### MCP Inspector

```bash
npx @modelcontextprotocol/inspector@latest
```

Inspector で MCP URL を入力し、Authorization に `Bearer <secret>` を設定して接続します。

### Cursor / Claude Desktop（mcp-remote）

クライアントが remote MCP のカスタムヘッダーに対応している場合は、直接 `/mcp` を指定し Bearer を付けてください。

`mcp-remote` 経由の例:

```json
{
  "mcpServers": {
    "package-tracking": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://package-tracking-mcp.<your-subdomain>.workers.dev/mcp",
        "--header",
        "Authorization: Bearer ${MCP_SHARED_SECRET}"
      ],
      "env": {
        "MCP_SHARED_SECRET": "your-secret-here"
      }
    }
  }
}
```

## 開発コマンド

```bash
npm run typecheck
npm test
npm run dev
```

## 自動判定の限界

12 桁などはヤマト / 佐川 / 日本郵便で重複するため、候補順に問い合わせて最初の有効ヒットを返します。誤判定を避けたい場合は `carrier` を指定してください。

## 既知の制約

- 佐川急便の公開追跡ページがメンテナンス中のときは `upstream_error` になります。
- ローカルの `wrangler dev` では、一部キャリア（特にヤマト運輸）への outbound fetch が workerd 側で失敗することがあります。パーサ自体はフィクスチャテストで検証済みです。本番 Worker 上での動作を確認してください。
- HTML スクレイピングのため、各社サイトの変更でパーサ修正が必要になることがあります。
