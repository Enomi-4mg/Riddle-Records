export const projects = [
  {
    slug: "ugomemo",
    title: "Project Ugomemo",
    subtitle: "Pixel Animation Workstation",
    date: "2026-06-16",
    description: "うごくメモ帳風の、軽くて硬いピクセル描画・フレームアニメーション制作アプリです。",
    tags: ["Animation", "Pixel Art", "Tauri", "React"],
    heroImage: "https://enomi-4mg.github.io/Project-Ugomemo/assets/project-ugomemo-app.png",
    externalUrl: "https://enomi-4mg.github.io/Project-Ugomemo/",
    sourceUrl: "https://github.com/enomi-4mg/Project-Ugomemo",
    features: [
      "ペン、ブラシ、トーン、消しゴム、シェイプを使った固定パレットのピクセル描画",
      "フレームレール、FPS、再生速度を確認しながらアニメーションをプレビュー",
      "音声素材、録音、4トラック配置、ミックス、フレーム同期再生に対応",
      ".upj形式の保存・読込、画像・動画・音声つき書き出しに対応"
    ]
  },
  {
    slug: "text-video-art",
    title: "TextVideoArt",
    subtitle: "Text and Video Expression",
    date: "2026-06-16",
    description: "テキストと映像表現を組み合わせたWeb作品です。文字の動きや配置から映像的な表情を作ります。",
    tags: ["Web Art", "Text", "Video", "Experiment"],
    heroImage: "",
    externalUrl: "https://enomi-4mg.github.io/TextVideoArt/web/",
    sourceUrl: "",
    features: [
      "テキストを中心にしたWeb上の映像表現",
      "ブラウザで体験できる軽量な作品ページ",
      "文字、動き、時間変化を組み合わせた実験的なビジュアル",
      "外部公開ページで作品本体を閲覧可能"
    ]
  }
] as const;
