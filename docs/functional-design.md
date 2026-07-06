# smarthome-agent-mcp 機能設計ドキュメント

> 2026-07 時点のソース解析に基づく。全体像は [architecture.md](./architecture.md) を参照。

## 1. 画面構成（webui）

| 画面 | パス | 内容 |
| --- | --- | --- |
| チャット | `/`（pages/index.tsx） | メッセージリスト + 入力欄 + マイク + 読み上げトグル。ツール実行結果は「詳細」折りたたみでテーブル表示 |
| 共通レイアウト | `components/Layout.tsx` | AppBar + 左ドロワー（メニュー）+ 右ドロワー（アカウント情報 / LLM 選択 / 翻訳 API 選択 / ログアウト） |

- 未ログイン時は `Layout` の `useEffect` で `signIn()` に強制リダイレクト。
- ログイン後 `accountInfo` 取得 → `chat.initialize()`（MCP listTools）でツール一覧を
  `AccountSettingsContext` に保持。
- LLM / 翻訳 API の選択値は `session.update()` で NextAuth の JWT にも保存（リロード耐性）。

## 2. 主要フロー

### 2.1 ログイン〜初期化

```text
signIn() → NextAuth（Credentials or Cognito）
  → Layout: /api/accountInfo { userId, accessToken? }
      → AuthFunctionServer.getAccountInfo → AccountInfo（org 名 / llmList / translateList）
  → chat.initialize → /api/[orgId]/initialize → MCP listTools → tools[] を Context 保存
```

### 2.2 チャット操作リクエスト（エージェントループ）

```text
ユーザ入力（テキスト or Web Speech API の音声認識結果）
  → POST /api/[orgId]/requestOperation { userId, tools, requestMessage, requestLlmId, requestTranslateId }
      1. translateId ≠ None なら DeepL で requestMessage を英訳
      2. llmAdapter.chatCompletions(systemPrompt + message, tools, toolOption: function/auto)
      3. tool_calls が無ければ text を応答
      4. tool_calls ごとに MCP callTool（SwitchBot 操作）→ 結果を toolResults に蓄積
      5. llmAdapter.chatCompletions(inProgress: { messages, toolResults }) で最終応答生成
  → { resAssistantMessage, resToolMessages[] }
音声読み上げ ON の場合:
  → POST /api/[orgId]/textToSpeech（iOS は aac、他は wav）→ blob URL を <audio> 再生
```

- システムプロンプトは固定文字列（"You are a smart home agent ..."）。
- 会話はリクエスト単位で完結（履歴の持ち回りなし）。
- LLM 既定値は `AzureOpenAI`、翻訳既定値は `DeepL`（フロントの既定は None）。

### 2.3 ログアウト

`chat.terminate`（MCP セッション破棄）→ `signOut()`。

## 3. MCP サーバ機能（packages/mcp_server）

### 3.1 ツール定義（server.ts + tools/switchbot/*）

| ツール | 引数（zod） | 動作 |
| --- | --- | --- |
| `tv` | commandType（power/channel/volume 等）ほか | SwitchBot 赤外線リモコンへコマンド送信 |
| `light` | commandType, commandTarget ほか | 照明 On/Off 等 |
| `aircon` | commandTarget（main/work/bed）, commandType（power/mode/tempset/tempchange）, command* | 部屋別エアコン制御。mode/temp 変更時は turnOn → 現在状態取得 → setAll の多段呼び出し |

- 共通基底 `SwitchbotControlFunction`:
  - env（`SWITCHBOT_TOKEN`/`SECRET_KEY`/`ENDPOINT`/`FUNCTION_DEVICEIDS_MAP`）から設定を zod 検証
  - SwitchBot API v1.1 の HMAC-SHA256 署名ヘッダ生成（token + timestamp + nonce）
  - `convertedArgsSchema` で LLM の引数（`commandOfXxx`）を `{ commandType, commandTarget, command }` に正規化
- 引数スキーマの `describe()` に「living room → main」等の**マッピング指示を英語で埋め込み**、
  LLM の引数生成を誘導するプロンプトエンジニアリングを行っている。
- 応答は `{ success: "リビングのエアコンを..." }` / `{ error: ... }` の日本語メッセージ。

### 3.2 起動形態（index.ts）

| 起動 | transport | 認証 |
| --- | --- | --- |
| 引数なし | stdio | なし（子プロセス前提） |
| `--http <port>` | Streamable HTTP（stateful, InMemoryEventStore + session-id） | Bearer（自前トークン or oauth） |
| `--http-stateless <port>` | Streamable HTTP（リクエスト毎に新規サーバ） | 同上 |

## 4. 設定・シークレット一覧

| 種別 | キー | 用途 |
| --- | --- | --- |
| YAML | `org.yaml` | orgId → display_name / llm_apis / translate_apis |
| YAML | `user.local.yaml` / `user.production.yaml` | userId（production は Cognito sub）→ display_name / organization |
| env | `AUTHSERVER_ACCOUNT_ENV` | local / production（認証方式切替） |
| env | `NEXTAUTH_SECRET`, `COGNITO_CLIENT_ID/SECRET/ISSUER` | NextAuth |
| env | `MCP_CLIENT_TRANSPORT_TYPE`, `MCPSERVER_URL`, `MCPSERVER_ROOTPATH`, `NODE_HOME` | MCP 接続 |
| env | `SWITCHBOT_TOKEN/SECRET_KEY/ENDPOINT/FUNCTION_DEVICEIDS_MAP` | デバイス操作 |
| env | `OPENAI_* / AZURE_OPENAI_* / ANTHROPIC_* / GOOGLE_* / GROQ_* / DEEPL_*` | 各 API（llm/translate-adapter 規約） |
| env | `APP_SECRETS` | 上記シークレットを JSON でまとめて渡すコンテナ向け規約（個別 env より優先） |
| ファイル | `.keys/public_key.pem`, `.keys/private_key.pem` | 自前トークンの鍵ペア（webui=公開鍵 / mcp_server=秘密鍵） |

## 5. 非機能・運用

- 起動: `yarn start[:http|:http-stateless]` → `scripts/start-server.mjs` が
  mcp_server（port 3100 既定）と webui（3000）を concurrently 起動。
- テスト: mcp_server に node:test の枠組みがあるが実体テストはサンプル程度。webui は無し。
- i18n: UI 文言は日本語ハードコード。エラーメッセージは英日混在。
- アクセシビリティ: MUI 既定に依存。aria 属性の明示的な付与は「詳細」ボタン程度。
