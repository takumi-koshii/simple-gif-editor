# Simple GIF Editor

macOS 向けのシンプルな GIF 編集アプリです。GIF ファイルに対して矩形クロップ、矩形モザイク、フレーム削減、フレーム削除を行い、GIF として書き出します。

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
| GIF/画像処理 | FFmpeg (ffmpeg-static でバンドル) |
| モザイク処理 | sharp |
| テスト | Vitest |
| パッケージング | electron-builder |

## ライセンス

GPL-2.0-or-later. 詳細は [LICENSE](LICENSE) を参照してください。

本アプリは FFmpeg (GPL-2.0) をバンドルしています。依存ライブラリのライセンス情報は [THIRD-PARTY-LICENSES](THIRD-PARTY-LICENSES) を参照してください。

## 更新情報

### v0.1.0

- 初回リリース
- GIF 読み込みと即時フレーム抽出
- フレームカードタイムライン (選択、削除)
- 矩形クロップ、矩形モザイク、フレーム削減
- 複数回 Undo / Redo
- GIF エクスポート
