export const contentKinds = ["journal", "songs", "gallery", "projects"] as const;

export type ContentKind = (typeof contentKinds)[number];

export type ContentFieldType = "text" | "textarea" | "date" | "boolean" | "list" | "select";

export type ContentFieldSchema = {
  key: string;
  label: string;
  type: ContentFieldType;
  required?: boolean;
  options?: readonly string[];
  placeholder?: string;
};

export type ContentKindSchema = {
  kind: ContentKind;
  label: string;
  directory: string;
  routeBase: string;
  fields: readonly ContentFieldSchema[];
};

export type ContentFileInfo = {
  kind: ContentKind;
  path: string;
  mtimeMs: number;
};

export type ContentFileListResult = {
  available: boolean;
  files: ContentFileInfo[];
  error?: string;
};

export const contentKindSchemas: Record<ContentKind, ContentKindSchema> = {
  journal: {
    kind: "journal",
    label: "Journal",
    directory: "src/content/journal",
    routeBase: "/journal/",
    fields: [
      { key: "title", label: "title", type: "text", required: true },
      { key: "date", label: "date", type: "date", required: true },
      { key: "type", label: "type", type: "select", options: ["journal", "making", "report"], required: true },
      { key: "slug", label: "slug", type: "text" },
      { key: "description", label: "description", type: "textarea" },
      { key: "tags", label: "tags", type: "list" },
      { key: "draft", label: "draft", type: "boolean" },
      { key: "thumbnail", label: "thumbnail", type: "text" },
      { key: "thumbnail_alt", label: "thumbnail_alt", type: "text" },
      { key: "og_image", label: "og_image", type: "text" },
      { key: "featured_related", label: "featured_related", type: "list" },
      { key: "use_math", label: "use_math", type: "boolean" },
      { key: "permalink", label: "permalink", type: "text" },
      { key: "og_description", label: "og_description", type: "text" },
      { key: "image", label: "image", type: "text" },
      { key: "thumbnail_class", label: "thumbnail_class", type: "text" }
    ]
  },
  songs: {
    kind: "songs",
    label: "Songs",
    directory: "src/content/songs",
    routeBase: "/disco/",
    fields: [
      { key: "title", label: "title", type: "text", required: true },
      { key: "date", label: "date", type: "date", required: true },
      { key: "youtube_id", label: "youtube_id", type: "text", required: true },
      { key: "description", label: "description", type: "textarea" },
      { key: "credits", label: "credits", type: "textarea" },
      { key: "lyrics", label: "lyrics", type: "textarea" },
      { key: "tags", label: "tags", type: "list" }
    ]
  },
  gallery: {
    kind: "gallery",
    label: "Gallery",
    directory: "src/content/gallery",
    routeBase: "/gallery/",
    fields: [
      { key: "slug", label: "slug", type: "text", required: true },
      { key: "detail", label: "detail", type: "boolean" },
      { key: "title", label: "title", type: "text", required: true },
      { key: "date", label: "date", type: "date", required: true },
      { key: "image", label: "image", type: "text", required: true },
      { key: "description", label: "description", type: "textarea" },
      { key: "tags", label: "tags", type: "list" },
      { key: "article_url", label: "article_url", type: "text" },
      { key: "making_article_url", label: "making_article_url", type: "text" },
      { key: "thumbnail", label: "thumbnail", type: "boolean" }
    ]
  },
  projects: {
    kind: "projects",
    label: "Projects",
    directory: "src/content/projects",
    routeBase: "/project/",
    fields: [
      { key: "slug", label: "slug", type: "text", required: true },
      { key: "title", label: "title", type: "text", required: true },
      { key: "date", label: "date", type: "date", required: true },
      { key: "description", label: "description", type: "textarea" },
      { key: "hero", label: "hero", type: "text" },
      { key: "status", label: "status", type: "select", options: ["active", "paused", "archived", "completed"] },
      { key: "tags", label: "tags", type: "list" },
      { key: "links", label: "links", type: "textarea" },
      { key: "features", label: "features", type: "list" }
    ]
  }
};

export const contentKindLabels = contentKinds.map((kind) => ({
  kind,
  label: contentKindSchemas[kind].label
}));

export function isContentKind(value: string | null | undefined): value is ContentKind {
  return Boolean(value && (contentKinds as readonly string[]).includes(value));
}
