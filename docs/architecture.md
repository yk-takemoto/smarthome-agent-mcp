# smarthome-agent-mcp アーキテクチャ・設計ドキュメント

> 2026-07 時点の `org/smarthome-agent-mcp` ソース解析に基づく。機能詳細は [functional-design.md](./functional-design.md) を参照。

## 1. 概要

チャット（テキスト/音声）でスマートホーム機器（SwitchBot 経由の TV / 照明 / エアコン）を操作する
エージェントアプリ。旧 `smarthome-agent` リポジトリを **MCP (Model Context Protocol) 対応**に
再構成したもので、デバイス操作ツールを MCP サーバとして切り出している。

## 2. リポジトリ構成（yarn v1 workspaces）

```text
smarthome-agent-mcp/
├── packages/
│   ├── webui/        Next.js 14 (Pages Router) — チャット UI + API ルート + MCP クライアント
│   └── mcp_server/   MCP サーバ (stdio / Streamable HTTP) — SwitchBot 操作ツール
├── scripts/start-server.mjs   起動オーケストレーション（transport モード別に両者を concurrently 起動）
└── infra/Dockerfile           ※旧リポジトリ（pre-MCP）由来で現構成と不整合（stale）
```

## 3. 全体アーキテクチャ

```text
[Browser]
  ├─ React 18 + MUI v5 + Emotion（チャット UI）
  ├─ react-speech-recognition（ブラウザ内 STT / Web Speech API）
  └─ next-auth/react（セッション）
      │ fetch /api/*
      ▼
[Next.js webui サーバ（API Routes = BFF）]
  ├─ /api/auth/[...nextauth]     NextAuth v4: Credentials(local) or Cognito(production)
  ├─ /api/accountInfo            account-manager: YAML 由来のユーザ/組織/LLM リスト解決
  ├─ /api/[orgId]/initialize     MCP listTools → クライアントへツール一覧返却
  ├─ /api/[orgId]/requestOperation  エージェントループ（LLM ⇄ MCP ツール実行）
  ├─ /api/[orgId]/textToSpeech   llm-adapter TTS
  └─ /api/[orgId]/terminate      MCP セッション破棄
      │                                  │
      │ llm-adapter / translate-adapter  │ MCP SDK Client（McpClientManager）
      ▼                                  ▼
[LLM/翻訳 API 群]                [mcp_server（別プロセス/別コンテナ or stdio 子プロセス）]
 OpenAI/Azure/Anthropic/          ├─ tools: tv / light / aircon
 Gemini/Groq/Bedrock, DeepL       └─ SwitchBot Cloud API（HMAC-SHA256 署名）
```

### MCP transport の3モード（`MCP_CLIENT_TRANSPORT_TYPE`）

| モード | 内容 | セッション管理 |
| --- | --- | --- |
| `stdio`（既定） | webui が mcp_server の build/index.js を子プロセス起動 | 単一共有セッション |
| `streamableHttp` | HTTP + セッション ID（stateful） | ユーザ ID ごとに `ClientSession` を Map 管理、2h 無活動で自動破棄 |
| `streamableHttpStateless` | HTTP（リクエスト毎に新規サーバインスタンス） | なし |

### mcp_server 側の認証（2 方式）

- 既定（`http_app.ts`）: webui が `key_util.ts` で発行する**自前トークン**を Bearer 検証。
  RSA 鍵ペア（.keys/）で「公開鍵で暗号化 → 秘密鍵で復号して一致確認」する方式（§6 参照）。
- `MCP_AUTH_MODE=oauth`（`oauth_app.ts`）: MCP SDK の `ProxyOAuthServerProvider` で外部 IdP に
  委譲する構成だが、**コールバック処理などが大部分コメントアウトの未完成実装**。

## 4. 技術スタック

| 区分 | 採用技術 | 備考 |
| --- | --- | --- |
| フレームワーク | Next.js 14.2.5（Pages Router）, React 18 | App Router 未使用 |
| UI | MUI v5 + @emotion, @mui/icons-material | テーマは `theme.ts` |
| 認証 | next-auth 4.24（Credentials / Cognito）+ account-manager | JWT セッション戦略 |
| LLM/翻訳 | @yk-takemoto/llm-adapter #0.0.3, translate-adapter #0.0.3 | GitHub 直参照 |
| MCP | @modelcontextprotocol/sdk ^1.13.0 | client / server 両方 |
| mcp_server | Node + express 5 + zod 3 | tsx 実行 or tsc ビルド |
| 音声入力 | react-speech-recognition（ブラウザ） | 音声出力は LLM TTS |
| ビルド/品質 | tsc, prettier, eslint 8(webui)/9(server) | テストは mcp_server の node:test のみ |

## 5. 設計思想・ポリシー

- **BFF パターン**: ブラウザは自 API ルートのみ呼び出し、LLM キー・SwitchBot キー等の
  シークレットはサーバ側（env / `APP_SECRETS` JSON）に閉じる。
- **ツール実行の MCP 化**: LLM への tools 提示は MCP `listTools` の結果をそのまま
  `llm-adapter` の MCP Tool 形式に渡し、tool_calls を MCP `callTool` で実行する
  「MCP ネイティブなエージェントループ」。
- **マルチ LLM / 翻訳切替**: org.yaml の `llm_apis` / `translate_apis` に列挙された選択肢を
  ユーザがドロワーで選択（セッションに保存）。日本語入力は DeepL で英訳してから LLM に渡す設計
  （システムプロンプトで「回答は日本語」と指示）。
- **org/user の静的 YAML 管理**: DB を持たず、org.yaml / user.{env}.yaml で組織・ユーザを定義。
- **環境の2値切替**: `AUTHSERVER_ACCOUNT_ENV=local|production` が認証方式・ユーザ定義ファイルを切り替える。

## 6. 既知の課題（リアーキ観点・重要）

1. **API ルートに認可チェックがない**: `requestOperation` 等は body の `userId` を信頼し、
   `getServerSession` 等でのセッション検証を行っていない（未ログインでも userId を知っていれば実行可能）。
2. **自前トークン方式が暗号学的に不適切**: `key_util.createAuthToken` は「公開鍵で暗号化した値」を
   署名代わりに使う（JWT ヘッダ `alg: RSA-OAEP-256`）。公開鍵を入手した第三者は誰でも有効トークンを
   偽造できるため、署名（RS256 等）としての意味を成していない。標準 JWT + JWKS への刷新が必要。
3. **oauth_app.ts が未完成**のまま同居しており、認証モードの完成形が定まっていない。
4. webui / mcp_server ともに `console.log` デバッグ出力が大量に本番コードへ混入
   （リクエストヘッダ・トークン・メッセージ全文などを出力）。
5. `infra/Dockerfile` は pre-MCP 構成（`funcdef/`, `devctl.yaml`, ルート `src/`）を参照しており、
   現在のワークスペース構成ではビルド不能（stale）。
6. kakeibo-agent と **auth 設定・key_util・mcp_client_manager・http_app・start-server.mjs が
   ほぼコピペ共有**されており、二重保守になっている（モノレポ共通化の第一候補）。
7. SwitchBot ツール実装（特に aircon）は fetch 逐次呼び出し + 分岐の重複が多く、
   デバイス設定（部屋名・デバイス ID マップ）が env の JSON 文字列
   `SWITCHBOT_FUNCTION_DEVICEIDS_MAP` にハードコードされている。宣言的なデバイス定義への再設計余地。
8. 会話履歴が1往復のみ（`requestOperation` は毎回新規会話）で、チャットとしての文脈保持がない。
