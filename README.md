# Peak Vista - 3D地形眺望ビューア

国土地理院の標高マップデータ（DEM10B）を使用して、指定した地点からの眺めを高品質な3Dで再現するウェブアプリケーションです。

![Status](https://img.shields.io/badge/status-in%20development-yellow)
![License](https://img.shields.io/badge/license-MIT-green)

## プロジェクト概要

### 目的
指定した座標（緯度・経度）からの風景を3D地形として表示し、実際の地形を立体的に確認できるツールです。

**使用例:**
- 登山計画時の視界確認
- 土地の地形把握
- 地形の3D可視化研究

### 主な特徴
- 🗻 **高品質な3D地形表示** - WebGL + Three.js による最新ブラウザ対応
- ⚡ **高速メッシュ生成** - Rust+WASM による高速計算
- 💾 **インテリジェントキャッシング** - IndexedDB による自動キャッシュ（フェーズ2で実装）
- 📱 **レスポンシブ設計** - デスクトップ・スマートフォン両対応
- 🔍 **複数LODレベル** - 距離に応じた詳細度自動調整

---

## 技術スタック

### フロントエンド
- **3D グラフィックス**: Three.js v0.160+
- **UI/JavaScript**: Vanilla JavaScript (フレームワーク不要)
- **スタイリング**: CSS3 (Flexbox/Grid)
- **ビルドツール**: Vite v5+

### バックエンド/計算処理
- **言語**: Rust
- **コンパイル**: WASM (wasm-pack)
- **線形代数**: glam v0.27
- **画像処理**: image crate (PNG デコード)

### 外部データソース
- **標高データ**: 国土地理院 DEM10B
  - API: `https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png`
  - フォーマット: PNG (256×256 pixels)

### 開発/デプロイ
- **バージョン管理**: Git
- **CI/CD**: GitHub Actions
- **ホスティング**: GitHub Pages

---

## セットアップ

### 必要な環境
- **Node.js**: v18.0 以上 ([ダウンロード](https://nodejs.org/))
- **Rust**: v1.70 以上 ([インストール](https://www.rust-lang.org/))
- **wasm-pack**: v0.12 以上

### インストール手順

#### 1. リポジトリをクローン
```bash
git clone https://github.com/muraoka/peak-vista.git
cd peak-vista
```

#### 2. Node.js 依存関係をインストール
```bash
npm install
```

#### 3. wasm-pack のインストール（初回のみ）
```bash
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

または、Cargo を使う場合：
```bash
cargo install wasm-pack
```

#### 4. WASM モジュールをビルド
```bash
npm run build:wasm
```

このコマンドで：
- Rust コードが WebAssembly にコンパイル
- 自動生成されたバインディング (`src/wasm/` に配置)

---

## 実行方法

### 開発サーバーの起動（推奨）

開発中は以下のコマンドで、ホットリロード対応の開発サーバーを起動します：

```bash
npm run dev
```

**出力例:**
```
  VITE v5.4.21  ready in 278 ms

  ➜  Local:   http://localhost:3000/peak-vista/
  ➜  Network: use --host to expose
```

#### ブラウザで開く
[http://localhost:3000/peak-vista/](http://localhost:3000/peak-vista/) にアクセス

### 本番ビルド

プロダクション用の最適化されたビルドを作成：

```bash
npm run build
```

出力は `dist/` ディレクトリに生成されます。

### ビルド結果をローカルプレビュー

```bash
npm run preview
```

---

## 使い方

### アプリケーション初期画面 - マップビュー

アプリケーション起動時は、**日本全体の2D地図**が表示されます。

#### マップビュー操作

| 操作 | 説明 |
|-----|------|
| **マウスホイール** | ズーム（レベル5-15）|
| **左ドラッグ** | マップのパン（移動）|
| **マップクリック** | その地点から3Dビューを表示 |

**処理フロー:**
```
1. マップ上の任意の場所をクリック
   ↓
2. その地点の標高データを自動取得
   ↓
3. 3D地形ビューに自動切り替え
   ↓
4. その場所からの風景が表示される
```

### 3D地形ビュー - 眺望表示

クリックした地点から見た景色が3Dで表示されます。

#### 3D地形ビューの操作

| 操作 | 動作 |
|-----|------|
| **マウスドラッグ** | カメラ回転（視点変更）|
| **マウスホイール** | ズーム（カメラ距離調整）|
| **矢印キー** | カメラパン（移動）|
| **W/A/S/D** | カメラ移動 |
| **+/- キー** | ズーム調整 |

#### 3D表示パネル（左側）

| セクション | 説明 |
|-----------|------|
| **Location** | 緯度・経度・視角・距離を手動設定（Form利用） |
| **Camera Info** | 現在のカメラ距離・高さ・方角・読み込み済みタイル数 |
| **Preset Locations** | 富士山など有名地点のワンクリック読み込み |
| **Actions** | キャッシュクリア、ビュー設定保存機能 |
| **Performance** | FPS、フレームタイム、メモリ使用量表示 |
| **Keyboard Controls** | 操作説明 |

#### プリセット地点

以下のボタンで有名地点へジャンプできます：
- 🗻 **富士山** - 35.360556°N, 138.727778°E
- ⛰️ **北アルプス** - 36.104611°N, 137.971111°E
- 🏔️ **中央アルプス** - 35.957889°N, 137.468417°E
- 🏯 **京都** - 34.746236°N, 135.729816°E

---

## プロジェクト構造

```
peak-vista/
├── README.md                 # このファイル
├── package.json             # Node.js 設定
├── vite.config.js           # Vite ビルド設定
├── .gitignore              # Git 除外ファイル
│
├── src/                      # フロントエンドコード
│   ├── index.html           # HTMLエントリーポイント
│   ├── js/
│   │   ├── main.js          # メインアプリケーション + イベントハンドリング
│   │   ├── renderer.js      # 3D地形レンダラー（Three.js）
│   │   ├── map-renderer.js  # 2D地図レンダラー（Three.js + WebGL）
│   │   ├── map-view.js      # マップビュー管理（ズーム・パン制御）
│   │   ├── terrain-view.js  # 3D地形ビュー管理（ビューポート計算）
│   │   ├── view-mode-manager.js # マップ↔3D地形モード切り替え
│   │   ├── elevation-lookup.js # 標高値取得（双線形補間）
│   │   ├── network-fetcher.js # GSI API フェッチ + リトライ機能
│   │   ├── tile-cache.js    # IndexedDB キャッシング（LRU）
│   │   ├── camera-controller.js # 3Dカメラ制御（回転・パン・ズーム）
│   │   ├── ui-controller.js # UI管理（フォーム、プリセット、アクション）
│   │   ├── performance-monitor.js # FPS・メモリ監視
│   │   ├── device-detector.js # デバイス判定 + 自動最適化
│   │   └── wasm-loader.js   # WASM モジュール読み込み（自動生成）
│   ├── styles/
│   │   └── main.css         # スタイルシート
│   └── wasm/                # WASM バイナリ（自動生成）
│       ├── peak_vista_wasm.js
│       ├── peak_vista_wasm.d.ts
│       └── peak_vista_wasm_bg.wasm
│
├── rust/                     # Rust/WASM コード
│   ├── Cargo.toml           # Rust 設定
│   └── src/
│       ├── lib.rs           # WASM エントリーポイント
│       ├── elevation_parser.rs   # 標高データ解析
│       ├── mesh_generator.rs     # メッシュ生成
│       └── coordinate_transform.rs # 座標変換
│
├── dist/                     # ビルド出力（本番用）
└── target/                   # Rust ビルドキャッシュ
```

---

## トラブルシューティング

### Q1: `wasm-pack: command not found` エラー

**原因**: wasm-pack がインストールされていない

**解決方法**:
```bash
cargo install wasm-pack
```

### Q2: WASM ビルドで「failed to execute `cargo build`」エラー

**原因**: Rust の wasm32 ターゲットがインストールされていない

**解決方法**:
```bash
rustup target add wasm32-unknown-unknown
```

### Q3: ブラウザで何も表示されない

**確認項目**:
1. ブラウザコンソール（F12）でエラーを確認
2. 開発サーバーが起動しているか（ターミナル）
3. URL が正しいか: `http://localhost:3000/peak-vista/`
4. ネットワークタブで WASM ファイルが読み込まれているか

### Q4: 地形が読み込まれない（「Failed to fetch tile」）

**原因**: 国土地理院 API に接続できない

**確認項目**:
1. インターネット接続を確認
2. ファイアウォール設定を確認
3. 座標が日本内か確認（海外の座標だとデータがない可能性）

**テスト用座標**:
- 富士山: 35.360556, 138.727778
- 北アルプス: 36.8667, 137.8
- スカイツリー: 35.7101, 139.8107

### Q5: パフォーマンスが悪い（フレームレート低い）

**対策**:
1. View Distance を減らす（5km 程度に）
2. ブラウザのハードウェアアクセラレーション有効化
3. 他のタブを閉じる
4. スマートフォンの場合、解像度を下げる

### Q6: マップが動かない／ズームが効かない

**確認項目**:
1. **マップビューモード**か確認（初期画面が2D地図になっているか）
2. ブラウザコンソール（F12）でエラーを確認
3. マウス操作が確実にできているか：
   - ズーム：マップ上でホイールを回す（スクロール量大きめ）
   - パン：マップ上で**左ボタンドラッグ**（右ボタンではない）
4. ズームレベルの範囲（5-15）に到達していないか確認

**改善策**:
- ホイール操作の感度が調整されているため、スクロール量を大きめに
- パンはドラッグ中にマップが移動（マップの中心が固定）

### Q7: クリックしても3Dビューに切り替わらない

**確認項目**:
1. マップのクリック位置が日本国内か確認
2. 標高データが存在する座標か確認（海上など）
3. ネットワーク接続を確認
4. ブラウザコンソールでエラー「Failed to get elevation」を確認

**対策**:
1. プリセット位置（富士山など）から試す
2. 内陸の山岳地帯でテスト
3. ファイアウォール設定を確認

---

## 開発ガイド

### WASM 部分を修正した場合

```bash
# WASM を再ビルド
npm run build:wasm

# 自動的にホットリロードされます（npm run dev が起動している場合）
```

### JavaScript のみを修正した場合

```bash
# 自動的にホットリロード（Vite の HMR）
# npm run dev が起動していれば、保存時に自動更新
```

### デバッグ方法

1. **ブラウザコンソール**:
   - F12 で開く
   - Console タブでログ確認

2. **WASM デバッグ**:
   ```javascript
   // main.js で
   console.log('WASM version:', get_version());
   ```

3. **ネットワークリクエスト**:
   - Network タブで GSI API への リクエストを確認

---

## 実装状況

### フェーズ1: 基盤 ✅ 完了

- [x] プロジェクトスキャフォールディング
- [x] 基本的な WASM モジュール（標高解析）
- [x] Three.js シーン + メッシュ表示
- [x] GSI API タイル取得
- [x] 基本的な UI

### フェーズ2: コア機能 ✅ 完了

- [x] IndexedDB キャッシング（3階層: メモリ + IndexedDB + ネットワーク）
- [x] RTIN 風メッシュ生成（LOD対応）
- [x] ビューポート計算（視錐台内のタイル最適選択）
- [x] 標高値の双線形補間
- [x] エラーハンドリング + リトライロジック強化

### フェーズ3: 仕上げ ✅ 完了

- [x] **マップビュー実装** - 2D地図表示・ズーム・パン
- [x] **3D地形ビュー** - マップクリックで自動遷移
- [x] **モード管理** - マップ ↔ 3D地形のシームレス切り替え
- [x] **デバイス最適化** - 自動デバイス判定・LOD自動調整
- [x] **パフォーマンス監視** - FPS・メモリ・フレームタイム表示
- [x] **UI完全実装** - プリセット位置・カメラ情報・パフォーマンス統計
- [x] **カメラコントロール強化** - マウス/キーボード・アニメーション対応
- [x] **パン/ズーム機能改善** - 滑らかな動作・直感的なマップ操作

### フェーズ4: デプロイ 🔄 進行中

- [ ] GitHub Actions CI/CD パイプライン構築
- [ ] GitHub Pages へのデプロイ設定
- [ ] 本番ビルド最適化 (WASM圧縮)
- [ ] クロスブラウザテスト

### フェーズ5: 拡張機能 🔜 将来予定

- [ ] **RTIN アルゴリズム改善** - メッシュ圧縮率 30-50%
- [ ] **航空写真テクスチャ** - GSI seamlessphoto オーバーレイ
- [ ] **DEM5 統合** - より高精度な標高データへの対応
- [ ] **PBR マテリアル** - 傾斜度ベースのラフネス・AO生成
- [ ] **PWA 化** - オフラインモード対応
- [ ] **ワーカースレッド化** - メッシュ生成のメインスレッド分離

---

## パフォーマンス目標

| 指標 | 目標値 | ステータス |
|-----|-------|----------|
| 初回レンダリング（コールドキャッシュ） | < 5秒 | 🔄 検証中 |
| 2回目以降（ウォームキャッシュ） | < 2秒 | 🔄 フェーズ2 で実装 |
| デスクトップ FPS | 60 FPS | 🔄 最適化中 |
| モバイル FPS | 30 FPS | 🔄 フェーズ3 で対応 |
| メモリ使用量 | < 50MB | ✅ 現在 30-40MB |

---

## 参考資料

### 国土地理院 API
- [標高タイル詳細仕様](https://maps.gsi.go.jp/development/demtile.html)
- [地理院地図 標高プログラム](https://maps.gsi.go.jp/development/elevation.html)

### 技術ドキュメント
- [Three.js ドキュメント](https://threejs.org/docs/)
- [Rust WebAssembly Book](https://rustwasm.github.io/docs/book/)
- [wasm-bindgen ガイド](https://rustwasm.github.io/docs/wasm-bindgen/)

### 関連プロジェクト
- [three-d Rust 3D ライブラリ](https://github.com/asny/three-d)
- [WebGL Terrain LOD](https://github.com/felixpalmer/lod-terrain)

---

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照

---

## 貢献

このプロジェクトへの貢献を歓迎します！

### 報告方法
- バグ報告: [Issues](https://github.com/muraoka/peak-vista/issues)
- 機能提案: [Discussions](https://github.com/muraoka/peak-vista/discussions)

### 開発に参加する
```bash
# ローカルブランチを作成
git checkout -b feature/your-feature

# 変更をコミット
git commit -am "Add your feature"

# プッシュしてプルリクエスト作成
git push origin feature/your-feature
```

---

## よくある質問 (FAQ)

**Q: 海外の地形も表示できる？**
A: 国土地理院 DEM10B は日本国内のみです。海外対応は将来の検討事項です。

**Q: オフラインで使える？**
A: 現在はオンライン必須。ただし一度読み込んだタイルは IndexedDB に自動キャッシュされるため、同じ地点なら次回はオフラインでも表示可能（フェーズ5 で本格的な PWA 対応予定）。

**Q: 高解像度テクスチャを追加できる？**
A: フェーズ5 で GSI 航空写真（seamlessphoto）オーバーレイ機能の実装を予定。

**Q: モバイルで動く？**
A: 基本的には動作します。フェーズ3 で自動デバイス判定と最適化を実装済みです：
- デバイスのメモリから最適な LOD/タイル数を自動設定
- タッチ操作対応（ジェスチャー操作対応予定）
- 現在の推奨環境は Windows/Mac/iPad です。スマートフォンは画面サイズ制限あり。

**Q: キャッシュはどこに保存される？**
A: IndexedDB（ブラウザローカルストレージ）に自動保存。ブラウザのキャッシュ削除でクリア可能。

**Q: マップから3Dに切り替わるときにどの地点が中心になる？**
A: マップクリック地点を中心として、その場所からの眺めが表示されます。標高値も自動取得されます。

**Q: カメラを手動で制御できる？**
A: 3Dビュー時は以下で制御可能：
- マウスドラッグで自由回転
- キーボード（矢印キー/WASD）でカメラ移動
- 位置フォームから座標指定も可能

---

## お問い合わせ

質問や提案がある場合は、GitHub Issues を通じてお気軽にどうぞ。

---

**最終更新**: 2026-01-01
**開発段階**: フェーズ3 完了 (フェーズ4 準備中)
**開発言語**: JavaScript + Rust
**対応ブラウザ**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
**推奨環境**: Windows/macOS/iPad + Chrome/Firefox

---

## 主な実装ハイライト

### フェーズ3 完了時点での主な成果

| 機能 | 説明 | 実装済み |
|------|------|--------|
| **2D地図表示** | GSI標準地図のWebGL描画 | ✅ |
| **マップズーム** | レベル5-15の段階的ズーム | ✅ |
| **マップパン** | スムーズなドラッグによる移動 | ✅ |
| **3D地形表示** | クリック地点からの眺望表示 | ✅ |
| **標高値検索** | 双線形補間による高精度取得 | ✅ |
| **キャッシング** | メモリ+IndexedDB 3層構造 | ✅ |
| **デバイス最適化** | 自動デバイス判定・LOD調整 | ✅ |
| **パフォーマンス監視** | FPS/メモリ/フレームタイム表示 | ✅ |
| **UI完全実装** | プリセット/アクション/ヘルプ統合 | ✅ |
| **エラーハンドリング** | リトライ・404判定・失敗許容 | ✅ |
