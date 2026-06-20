export type GalleryItem = {
  slug: string;
  detail?: boolean;
  title: string;
  date: string;
  cloudinary_id: string;
  description: string;
  body?: string;
  categories: readonly string[];
  article_url?: string;
  making_article_url?: string;
  thumbnail?: boolean;
  thumbnail_class?: string;
  comparison_group?: string;
  comparison_label?: string;
};

export const getGalleryDetailPath = (item: Pick<GalleryItem, "slug">) => `/gallery/${item.slug}/`;

export const hasGalleryDetail = (item: GalleryItem) => item.detail === true;

export const galleryItems: readonly GalleryItem[] = [
  {
    slug: "boring-class",
    detail: true,
    title: "つまらない授業",
    date: "2025-04-25",
    cloudinary_id: "draw_girl_isg7dp.png",
    description: "女の子のイラスト",
    body: "退屈な授業で上の空になっている女の子",
    categories: ["イラスト"],
    article_url: "",
    thumbnail: true
  },
  {
    slug: "friend",
    detail: true,
    title: "友達",
    date: "2025-04-25",
    cloudinary_id: "man_lilman_i8bkgb.png",
    description: "友達のイラスト",
    body: "ふたりは友達",
    categories: ["イラスト"],
    article_url: "",
    thumbnail: true
  },
  {
    slug: "came-to-pick-you-up",
    detail: true,
    title: "迎えに来たよ",
    date: "2025-04-25",
    cloudinary_id: "D_2025_04_25_netaa9.png",
    description: "迎えに来たキャラクターのイラスト",
    body: "友達が迎えに来てくれました",
    categories: ["イラスト"],
    article_url: "",
    thumbnail: true
  },
  {
    slug: "boat",
    detail: true,
    title: "ボート",
    date: "2025-04-25",
    cloudinary_id: "boat_pic_zxfzwh.png",
    description: "ボートのイラスト",
    body: "ボートに乗って向こう岸まで向かっているようです。",
    categories: ["イラスト"],
    thumbnail: true,
    article_url: ""
  },
  {
    slug: "five-apples",
    title: "五つのりんご",
    date: "2025-06-06",
    cloudinary_id: "five_apples_spot_angle2_pint_mgaggo.png",
    description: "被写界深度を適用、チュートリアルで作ったCG",
    categories: ["3DCG"],
    article_url: "/journal/2025-06-06/",
    thumbnail: true
  },
  {
    slug: "witness",
    detail: true,
    title: "四コマ漫画：目撃",
    date: "2025-10-01",
    cloudinary_id: "witness_krpm8q.jpg",
    description: "お絵描き練習",
    body: "四コマ漫画形式で描いた練習作品。",
    categories: ["四コマ漫画"],
    thumbnail: true,
    article_url: "/journal/2025-10-01/"
  },
  {
    slug: "homework",
    detail: true,
    title: "四コマ漫画：宿題",
    date: "2025-10-01",
    cloudinary_id: "homework_cbrujv.jpg",
    description: "お絵描き練習",
    body: "四コマ漫画形式で描いた練習作品。",
    categories: ["四コマ漫画"],
    thumbnail: true,
    article_url: "/journal/2025-10-01/"
  },
  {
    slug: "cry",
    detail: true,
    title: "Cry",
    date: "2026-01-17",
    cloudinary_id: "Cry_vvf90d.png",
    description: "夏コミ2025寄稿イラスト",
    body: "夏コミ2025の寄稿用に制作したイラストです。青色を使っています。",
    categories: ["イラスト"],
    article_url: "/journal/2026-01-17/",
    thumbnail: false,
    comparison_group: "diary/2026-01-17/",
    comparison_label: "Cry"
  },
  {
    slug: "light",
    detail: true,
    title: "Light",
    date: "2026-01-17",
    cloudinary_id: "Light_ldkae3.png",
    description: "冬コミ2025寄稿イラスト",
    body: "冬コミ2025の寄稿用に制作したイラスト。光の描き方をすこし工夫",
    categories: ["イラスト"],
    article_url: "/journal/2026-01-17/",
    thumbnail: true,
    comparison_group: "diary/2026-01-17/",
    comparison_label: "Light"
  },
  {
    slug: "dunes-simulation",
    title: "砂の風紋シミュレーション",
    date: "2026-01-30",
    cloudinary_id: "result-4_qptaza.gif",
    description: "砂の風紋シミュレーション",
    categories: ["3DCG"],
    article_url: "/journal/2026-01-30/dunes-making/",
    thumbnail: true
  }
] as const;
