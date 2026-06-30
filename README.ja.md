# プリントサービス監視システム

[![English](https://img.shields.io/badge/lang-English-blue)](README.md) [![简体中文](https://img.shields.io/badge/lang-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-red)](README.zh-CN.md) [![繁體中文](https://img.shields.io/badge/lang-%E7%B9%81%E9%AB%94%E4%B8%AD%E6%96%87-red)](README.zh-TW.md) [![日本語](https://img.shields.io/badge/lang-%E6%97%A5%E6%9C%AC%E8%AA%9E-orange)](README.ja.md) [![한국어](https://img.shields.io/badge/lang-%ED%95%9C%EA%B5%AD%EC%96%B4-yellow)](README.ko.md) [![Français](https://img.shields.io/badge/lang-Fran%C3%A7ais-purple)](README.fr.md) [![Deutsch](https://img.shields.io/badge/lang-Deutsch-green)](README.de.md) [![Español](https://img.shields.io/badge/lang-Espa%C3%B1ol-orange)](README.es.md)

エンタープライズプリンター機器管理、プリントサーバー監視、自動レポート生成、資産棚卸追跡、Jira チケット連携に対応した、フル機能・セルフホスト型のWebアプリケーションです。

**React 18 + Material UI** フロントエンドと **Node.js + Express** バックエンドで構築され、バイリンガルUI（English / 简体中文）、ダークモード、Windows Server オフラインデプロイに対応しています。

🌐 **Portal**: [http://papercut001.example-corp.com.cn:9191/](http://papercut001.example-corp.com.cn:9191/)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)
![React](https://img.shields.io/badge/react-18-blue.svg)

---

## 機能

### 🖨️ プリンター監視
- **リアルタイムステータス監視**（SNMP プロトコル経由：トナー残量、用紙状態、エラー検知）
- **30秒ポーリング間隔**（設定可能なバックオフ付き）
- **複数プリンター対応**（個別のIP/SNMP設定）
- **ステータス履歴追跡**（日次スナップショット）
- **メンテナンスモード**（特定プリンターの監視を一時停止）

### 🖥️ プリントサーバー監視
- **CPU、メモリ、ディスク使用率**の Windows プリントサーバー監視
- **稼働時間追跡**とステータス履歴
- **ビジュアルダッシュボード**（色分けされたヘルスインジケーター）
- **サーバー設定管理**（追加/編集/削除）

### 📊 ステータスダッシュボード
- **ライブ概要**（すべてのプリンターとサーバーを一画面で表示）
- **ライセンス管理**（有効期限追跡）
- **印刷分析**（日別使用量チャート、機能フラグ制御）

### 📧 自動レポート生成
- **定期週次レポート**（メール配信）
- **5種類のレポートスタイルテンプレート**から選択可能
- **HTMLメールレポート**（プリンターステータステーブル付き）
- **受信者設定**とスケジュール時間設定
- **手動レポート生成**（即時プレビュー）

### 🔔 アラートシステム
- **トナー残量アラート**（閾値設定可能：5% / 10%）
- **プリンターオフラインアラート**（メール通知）
- **プリントサーバーエラーアラート**
- **SMTPメール連携**（リトライ機構付き）
- **ブリージングアニメーション**（アクティブアラートインジケーター）

### 📦 資産棚卸
- **ハードウェア資産追跡**と管理
- **棚卸セッション管理**（定期監査用）
- **Excelエクスポート**対応（オフライン利用向けに ExcelJS 同梱）

### 🎫 Jira チケット連携
- **テンプレートベースのチケット作成**（20以上の設定可能なテンプレート）
- **一括チケット作成**（複数の報告者に対応）
- **変数自動入力**：`{ntid}`、`{fullname}`、`{DATE_COMPACT}` 等
- **チケット検索**（プレフィックスによる段階的検索：ISDS → TPX → CHG → ECSR）
- **承認待ち監視**（リアルタイムポーリング）
- **サービスデスク承認**対応（ISDSチケットの承認/却下）
- **クイックアクション**：コメント、解決、クローズ（Internal Component 自動入力）
- **コメントテンプレート**（ユーザー間で共有、バックエンドで永続化）
- **テンプレート管理**（使用頻度によるソートと最近使用の追跡）

### 👥 ユーザー管理
- **ロールベースアクセス制御**：管理者、編集者、閲覧者
- **JWT認証**（リフレッシュトークン対応）
- **ユーザープロフィール管理**

### 🌐 国際化
- **バイリンガルUI**：英語と簡体字中国語
- **リアルタイム言語切替**（ページリロード不要）
- **全UIテキスト**を i18n キーで管理

### 🌙 ダークモード
- **完全なダークテーマ対応**（全コンポーネント）
- **CSS変数ベースのテーマ設計**（一貫したスタイリング）
- **ワンクリック切替**（設定の永続化）

---

## 技術スタック

### フロントエンド
| 技術 | 用途 |
|---|---|
| React 18 | UIフレームワーク |
| Material UI 7 | コンポーネントライブラリ |
| Vite 7 | ビルドツール＆開発サーバー |
| Chart.js | データ可視化 |
| i18next | 国際化 |
| Axios | HTTPクライアント |
| react-hook-form | フォーム管理 |

### バックエンド
| 技術 | 用途 |
|---|---|
| Node.js 18+ | ランタイム |
| Express 5 | Webフレームワーク |
| net-snmp | SNMPプリンタークエリ |
| nodemailer | メール配信 |
| jsonwebtoken | JWT認証 |
| bcryptjs | パスワードハッシュ化 |
| Puppeteer | スクリーンショット取得 |
| Tesseract.js | OCR処理 |
| cheerio | HTMLパース |

---

## プロジェクト構成

```
├── src/                          # フロントエンドソース
│   ├── components/               # Reactコンポーネント
│   │   ├── StatusDashboard.jsx   # メイン監視ダッシュボード
│   │   ├── PrintServerDashboard.jsx
│   │   ├── ReportForm.jsx        # レポート生成
│   │   ├── AlertSettings.jsx     # アラート設定
│   │   ├── JiraTickets.jsx       # Jira連携
│   │   ├── AssetInventory.jsx    # 資産追跡
│   │   ├── SettingsPanel.jsx     # システム設定
│   │   └── ...
│   ├── i18n/locales/             # 翻訳ファイル
│   │   ├── en.json               # 英語
│   │   └── zh-CN.json            # 簡体字中国語
│   ├── context/                  # React Context（グローバルステート）
│   ├── hooks/                    # カスタムフック
│   ├── services/                 # フロントエンドサービス
│   └── theme/                    # テーマ設定
├── backend/                      # バックエンドソース
│   ├── server.js                 # Expressサーバーエントリー
│   ├── config/                   # 設定ファイル（JSON）
│   │   ├── printers.json         # プリンター定義
│   │   ├── printServers.json     # プリントサーバー設定
│   │   ├── alertConfig.json      # アラートルール
│   │   ├── jiraTemplates.json    # Jiraチケットテンプレート
│   │   └── ...
│   ├── routes/                   # APIルートハンドラー
│   ├── services/                 # ビジネスロジック（16サービス）
│   │   ├── printerMonitoringService.js
│   │   ├── printServerMonitoringService.js
│   │   ├── scheduledReportService.js
│   │   ├── snmpService.js
│   │   ├── jiraService.js
│   │   ├── emailService.js
│   │   └── ...
│   ├── middleware/               # 認証、バリデーション、フォーマット
│   └── utils/                    # JWT、ユーティリティ
├── deploy/                       # デプロイスクリプト
│   ├── pack-offline.sh           # オフラインパッケージビルダー
│   ├── install-service.bat       # Windowsサービスインストーラー
│   ├── frontend-server.js        # 本番用静的サーバー
│   └── offline-package/          # ビルド済みデプロイパッケージ
└── public/                       # 静的アセット
```

---

## はじめに

### 前提条件
- **Node.js 18+**（[ダウンロード](https://nodejs.org/)）
- **npm**（Node.js に同梱）

### 開発環境セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/your-org/printer-status-report.git
cd printer-status-report

# フロントエンドの依存関係をインストール
npm install

# バックエンドの依存関係をインストール
cd backend
cp .env.example .env    # 環境変数を設定
npm install
cd ..

# 両方のサービスを起動（別々のターミナルで）
npm run dev             # フロントエンド：http://localhost:5175
cd backend && node server.js  # バックエンド：http://localhost:3001
```

### 環境変数

`.env.example` から `backend/.env` を作成：

```env
PORT=3001
NODE_ENV=development

# SMTP設定
SMTP_HOST=your-smtp-server
SMTP_PORT=25
SMTP_FROM=printer-monitor@yourcompany.com
ALERT_RECIPIENTS=admin@yourcompany.com

# JWTシークレット（未設定の場合は自動生成）
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
```

### デフォルトログイン
- **ユーザー名**：`admin`
- **パスワード**：`admin123`（初回ログイン後に変更してください）

---

## 本番環境デプロイ（Windows Server）

### オフラインデプロイ

本システムは**エアギャップ Windows Server** 環境向けに設計されています：

```bash
# 開発マシン上（macOS/Linux）：オフラインパッケージをビルド
bash deploy/pack-offline.sh
```

必要なすべてのファイルを含む `.zip` ファイルが生成されます：

1. `.zip` を Windows Server にコピー
2. ディレクトリに展開（例：`C:\PrinterStatus`）
3. Node.js 18+ がインストールされていることを確認
4. `install-service.bat` を右クリック → **管理者として実行**
5. `http://server-ip:9191` でアクセス

インストーラーは **NSSM** を使用して Windows サービスを登録し、サインアウトや再起動後も動作を継続します：
- `PrinterStatusBackend`（ポート 3001）
- `PrinterStatusFrontend`（ポート 9191）

---

## API概要

| メソッド | エンドポイント | 説明 |
|---|---|---|
| `GET` | `/api/health` | ヘルスチェック |
| `POST` | `/api/auth` | ユーザー認証 |
| `GET/POST` | `/api/printers` | プリンター管理 |
| `GET/POST` | `/api/settings` | システム設定 |
| `POST/GET` | `/api/reports` | レポート生成 |
| `GET/POST` | `/api/alerts` | アラート設定 |
| `GET` | `/api/jira/templates` | Jiraチケットテンプレート |
| `POST` | `/api/jira/tickets` | Jiraチケット作成 |
| `GET` | `/api/jira/issues` | Jira課題検索 |
| `GET` | `/api/jira/pending-approvals` | 承認待ちチケット |
| `POST` | `/api/jira/issues/:key/transition` | チケットトランジション実行 |
| `GET/POST/DELETE` | `/api/jira/comment-templates` | コメントテンプレート |

---

## スクリーンショット

> メインダッシュボード、Jiraチケット作成、ダークモードなどのスクリーンショットを追加してください。

---

## コントリビューション

1. リポジトリをフォーク
2. フィーチャーブランチを作成（`git checkout -b feature/amazing-feature`）
3. 変更をコミット（`git commit -m 'Add amazing feature'`）
4. ブランチにプッシュ（`git push origin feature/amazing-feature`）
5. Pull Request を作成

### 開発ガイドライン
- ユーザー向けのすべてのテキストは react-i18next の `t('key')` を使用すること
- `src/i18n/locales/zh-CN.json` と `en.json` の両方に対応するキーを追加すること
- 既存のコードパターンとコンポーネント構造に従うこと

---

## ライセンス

このプロジェクトは MIT ライセンスの下で公開されています — 詳細は [LICENSE](LICENSE) ファイルをご覧ください。

---

## 謝辞

- [Material UI](https://mui.com/) — React コンポーネントライブラリ
- [Vite](https://vitejs.dev/) — 次世代フロントエンドツール
- [NSSM](https://nssm.cc/) — Windows サービスマネージャー
- [net-snmp](https://github.com/markabrahams/node-net-snmp) — Node.js 用 SNMP プロトコル
