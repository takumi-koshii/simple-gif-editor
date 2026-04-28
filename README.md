# Simple GIF Editor

macOS 向けのシンプルな GIF 編集アプリです。GIF ファイルに対して矩形クロップ、矩形モザイク、フレーム削減、フレーム削除を行い、GIF として書き出します。

<img width="1200" height="800" alt="Kapture 2026-04-23 at 10 58 56-2" src="https://github.com/user-attachments/assets/94555fcb-e557-494b-a9a0-f04ee2f1ad0b" />

## 機能

- **GIF 読み込み**: GIF ファイルを読み込み、即座にフレームを抽出します
- **フレームカード**: 各フレームをサムネイルで一覧表示し、クリック/Shift+クリックで選択できます
- **フレーム削除**: 選択したフレームを削除できます (Undo 対応)
- **矩形クロップ**: 矩形範囲を指定して全フレームに適用します (Undo 対応)
- **矩形モザイク**: 指定したフレーム範囲に矩形モザイクを適用します (Undo 対応)
- **フレーム削減**: 全フレームを均等に間引きます (1/2, 1/4, 1/8)。再生速度は維持されます
- **複数回 Undo / Redo**: 全ての破壊的操作に対応
- **プレビュー**: 静止画表示と GIF アニメーション再生の切替
- **GIF 書き出し**: palettegen/paletteuse による高品質 GIF を生成します

## キーボードショートカット

| ショートカット | 操作 |
|-------------|------|
| ⌘O | GIF を開く |
| ⌘E | GIF をエクスポート |
| ⌘Z | Undo |
| ⌘Y / ⌘⇧Z | Redo |
| ⌫ (delete) | 選択フレームを削除 |
| ← → | フレーム選択を移動 |

## セットアップ

### 前提条件

- macOS (Apple Silicon)
- Node.js 24 以上
- npm

### インストール

```bash
npm install
```

### 開発モードでの起動

```bash
npm run build
npm start
```

### テスト

```bash
npm test
npm run test:coverage
```

### パッケージング

```bash
npm run package
```

`out/mac-arm64/Simple GIF Editor.app` が生成されます。署名されていないアプリのため、初回起動時に右クリック→「開く」が必要です。

## 技術構成

| 分類 | 技術 |
|------|------|
| アプリシェル | Electron |
| 言語 | TypeScript (strict) |
| レンダラバンドラ | Vite |
| GIF/画像処理 | FFmpeg (ffmpeg-static および @ffprobe-installer/ffprobe でバンドル) |
| モザイク処理 | sharp |
| テスト | Vitest |
| パッケージング | electron-builder |

## ライセンス

GPL-2.0-or-later. 詳細は [LICENSE](LICENSE) を参照してください。

本アプリは FFmpeg (GPL-2.0) をバンドルしています。依存ライブラリのライセンス情報は [THIRD-PARTY-LICENSES](THIRD-PARTY-LICENSES) を参照してください。

## 更新情報

### v1.0.0

- ffprobe バイナリの差し替え
  - `ffprobe-static@3.1.0` の `darwin/arm64` バイナリが実態として x86_64 であり、 Apple Silicon の macOS で GIF を読み込むたびに 「Intel プロセッサ向けアプリ」 の通知が表示される事象に対応しました。
  - 依存を `@ffprobe-installer/ffprobe@2.1.2` に差し替え、 同梱バイナリを正しい arm64 にしました。
- THIRD-PARTY-LICENSES の更新
  - 上記差し替えに伴い、 ffprobe バイナリのライセンスを LGPL-2.1-or-later として明記しました。
  - ffmpeg-static の npm パッケージ自体のライセンスを GPL-3.0-or-later として正しく記載しました ( ffmpeg バイナリ自体は引き続き GPL-2.0-or-later です )。
- アーキテクチャ整合性テストの追加
  - 同種の事象を将来検出できるよう、 同梱 ffprobe バイナリの Mach-O ヘッダを検査するユニットテストを追加しました。

### v0.1.0

- 初回リリース
- GIF 読み込みと即時フレーム抽出
- フレームカードタイムライン (選択、削除)
- 矩形クロップ、矩形モザイク、フレーム削減
- 複数回 Undo / Redo
- GIF エクスポート
