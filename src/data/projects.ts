export type ProjectDataItem = {
  slug: string;
  title: string;
  subtitle?: string;
  date: string;
  description: string;
  tags: readonly string[];
  heroImage?: string;
  externalUrl?: string;
  sourceUrl?: string;
  features: readonly string[];
};

export const projects: readonly ProjectDataItem[] = [];
