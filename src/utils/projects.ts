import { getCollection } from "astro:content";
import { hasVisiblePublicationDate } from "../../shared/publicationDate";
import { projects, type ProjectDataItem } from "../data/projects";

export type ProjectItemSource = "legacy" | "collection";
export type ProjectStatus = "active" | "paused" | "archived" | "completed";

export type ProjectItemView = {
  source: ProjectItemSource;
  slug: string;
  title: string;
  date?: string;
  description?: string;
  hero?: string;
  status?: ProjectStatus;
  tags: string[];
  links: Array<{ label: string; url: string }>;
  features: string[];
  body?: string;
  draft: boolean;
};

const normalizeDate = (value: Date | string | undefined) => {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
};

const legacyLinks = (item: ProjectDataItem) => [
  item.externalUrl ? { label: "Website", url: item.externalUrl } : undefined,
  item.sourceUrl ? { label: "GitHub", url: item.sourceUrl } : undefined
].filter((link): link is { label: string; url: string } => Boolean(link));

const normalizeLegacyItem = (item: ProjectDataItem): ProjectItemView => ({
  source: "legacy",
  slug: item.slug,
  title: item.title,
  date: item.date,
  description: item.description,
  hero: item.heroImage || undefined,
  status: "active",
  tags: [...item.tags],
  links: legacyLinks(item),
  features: [...item.features],
  body: item.description,
  draft: false
});

function projectBodySections(body: string) {
  const match = body.match(/(?:^|\n)## 主な機能\s*\n([\s\S]*?)(?=\n## |$)/);
  return {
    body: match ? body.replace(match[0], "").trim() : body.trim(),
    features: match ? match[1].split("\n").flatMap((line) => { const item = line.match(/^\s*[-*]\s+(.+)$/); return item ? [item[1]] : []; }) : []
  };
}

type ProjectsCollectionEntry = Awaited<ReturnType<typeof getCollection<"projects">>>[number];

const normalizeCollectionItem = (entry: ProjectsCollectionEntry): ProjectItemView => {
  const sections = projectBodySections(entry.body ?? "");
  return {
    source: "collection",
    slug: entry.data.slug || entry.slug,
    title: entry.data.title,
    date: normalizeDate(entry.data.date),
    description: entry.data.description,
    hero: entry.data.hero || entry.data.heroImage || undefined,
    status: entry.data.status,
    tags: entry.data.tags ?? [],
    links: entry.data.links ?? [
      entry.data.externalUrl ? { label: "Website", url: entry.data.externalUrl } : undefined,
      entry.data.sourceUrl ? { label: "GitHub", url: entry.data.sourceUrl } : undefined
    ].filter((link): link is { label: string; url: string } => Boolean(link)),
    features: sections.features.length ? sections.features : entry.data.features ?? [],
    body: sections.body || entry.data.description,
    draft: entry.data.draft === true
  };
};

const validateProjectItems = (items: readonly ProjectItemView[]) => {
  const owners = new Map<string, ProjectItemView>();
  const errors: string[] = [];

  items.forEach((item) => {
    if (!item.slug.trim()) errors.push(`Project item "${item.title}" has no slug.`);
    const owner = owners.get(item.slug);
    if (owner) {
      errors.push(`Duplicate project slug "${item.slug}" from ${owner.source}:${owner.title} and ${item.source}:${item.title}.`);
      return;
    }
    owners.set(item.slug, item);
  });

  if (errors.length) {
    throw new Error(`Invalid Project items:\n${errors.join("\n")}`);
  }
};

export const getProjectItems = async (): Promise<readonly ProjectItemView[]> => {
  const showDrafts = !import.meta.env.PROD;
  const collectionItems = (await getCollection("projects"))
    .filter((entry) => hasVisiblePublicationDate(entry.data, showDrafts))
    .map(normalizeCollectionItem);
  const items = [...projects.map(normalizeLegacyItem), ...collectionItems];
  validateProjectItems(items);
  return items;
};

export const getSortedProjectItems = async () =>
  [...await getProjectItems()].sort((left, right) => {
    const leftTime = left.date ? new Date(left.date).getTime() : 0;
    const rightTime = right.date ? new Date(right.date).getTime() : 0;
    return rightTime - leftTime;
  });
