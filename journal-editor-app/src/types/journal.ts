export const articleTypes = ["journal", "making", "report"] as const;

export type ArticleType = (typeof articleTypes)[number];
export type View = "list" | "editor";
export type ReviewMode = "preview" | "checks" | "output";
export type DraftSource = "manual" | "imported" | "uploaded";

export type FrontmatterForm = {
  title: string;
  date: string;
  type: ArticleType;
  slug: string;
  description: string;
  tags: string;
  draft: boolean;
  thumbnail: string;
  thumbnail_alt: string;
  thumbnail_fit: string;
  thumbnail_position: string;
  og_image: string;
  featured_related: string;
  use_math: boolean;
  permalink: string;
  og_description: string;
  image: string;
  thumbnail_class: string;
};

export type StoredDraft = {
  id: string;
  createdAt: string;
  updatedAt: string;
  importedAt?: string;
  editedAt?: string;
  source: DraftSource;
  sourcePath?: string;
  sourceFileName?: string;
  loadedFilePath?: string;
  loadedFileMtime?: number;
  frontmatter: FrontmatterForm;
  body: string;
};

export type JournalFileInfo = {
  path: string;
  mtimeMs: number;
};

export type JournalFileEntry = {
  file: JournalFileInfo;
  filename: string;
  draft: StoredDraft;
};

export type DraftOverrides = Omit<Partial<StoredDraft>, "frontmatter"> & {
  frontmatter?: Partial<FrontmatterForm>;
};

export type ArticleState = "draft" | "published" | "editing-published" | "scheduled";

export const today = new Date().toISOString().slice(0, 10);

export const defaultFrontmatter: FrontmatterForm = {
  title: "",
  date: today,
  type: "journal",
  slug: "",
  description: "",
  tags: "",
  draft: true,
  thumbnail: "",
  thumbnail_alt: "",
  thumbnail_fit: "",
  thumbnail_position: "",
  og_image: "",
  featured_related: "",
  use_math: false,
  permalink: "",
  og_description: "",
  image: "",
  thumbnail_class: ""
};

export const defaultBody = "# 見出し\n\nここに本文を書きます。\n";
