import type { WorkReference } from "./workIdentity";
export type AboutProfile = {
  icon: string; name: string; bio: string; birthday: string; motto: string;
  hobbies: string[]; skills: string[]; likes: string[];
  sns: Array<{ service: string; url: string; label: string }>;
  featuredWorks: WorkReference[];
};
export const aboutKeys = ["icon", "name", "bio", "birthday", "motto", "hobbies", "skills", "likes", "sns", "featured_works"];
export const emptyAboutProfile = (): AboutProfile => ({ icon: "", name: "", bio: "", birthday: "", motto: "", hobbies: [], skills: [], likes: [], sns: [], featuredWorks: [] });
const cleanTags = (tags: string[]) => tags.map((tag) => tag.trim()).filter(Boolean);
export function normalizeAboutProfile(profile: AboutProfile): AboutProfile {
  return { ...profile, icon: profile.icon.trim(), name: profile.name.trim(), birthday: profile.birthday.trim(),
    hobbies: cleanTags(profile.hobbies), skills: cleanTags(profile.skills), likes: cleanTags(profile.likes),
    sns: profile.sns.map((item) => ({ service: item.service.trim(), url: item.url.trim(), label: item.label.trim() })) };
}
export function readAboutProfile(raw: Record<string, unknown>): AboutProfile {
  const text = (key: string) => { if (raw[key] === undefined) return ""; if (typeof raw[key] !== "string") throw new Error(`About: ${key} must be text`); return raw[key] as string; };
  const list = (key: string) => { if (raw[key] === undefined) return []; if (!Array.isArray(raw[key]) || !(raw[key] as unknown[]).every((item) => typeof item === "string")) throw new Error(`About: ${key} must be a text array`); return raw[key] as string[]; };
  const sns = raw.sns ?? [];
  if (!Array.isArray(sns) || sns.some((item) => !item || typeof item !== "object" || typeof item.service !== "string" || typeof item.url !== "string" || item.label !== undefined && typeof item.label !== "string")) throw new Error("About: invalid SNS entries");
  return normalizeAboutProfile({ icon: text("icon"), name: text("name"), bio: text("bio"), birthday: text("birthday"), motto: text("motto"), hobbies: list("hobbies"), skills: list("skills"), likes: list("likes"), sns: sns.map((item) => ({ service: item.service, url: item.url, label: item.label ?? "" })), featuredWorks: list("featured_works") as WorkReference[] });
}
export function aboutFrontmatter(profile: AboutProfile) {
  const { featuredWorks, ...fields } = normalizeAboutProfile(profile);
  return { ...fields, featured_works: featuredWorks };
}
function webUrl(value: string) {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password; } catch { return false; }
}
export function aboutProfileErrors(profile: AboutProfile, workIds?: Iterable<string>): string[] {
  const value = normalizeAboutProfile(profile); const errors: string[] = [];
  if (!value.name) errors.push("名前を入力してください");
  if (value.birthday) {
    const match = value.birthday.match(/^(\d{2})-(\d{2})$/);
    const date = match ? new Date(Date.UTC(2000, Number(match[1]) - 1, Number(match[2]))) : null;
    if (!match || date?.getUTCMonth() !== Number(match[1]) - 1 || date?.getUTCDate() !== Number(match[2])) errors.push("誕生日は有効な月日（MM-DD）で入力してください");
  }
  if (value.icon && (/^https?:/i.test(value.icon) ? !webUrl(value.icon) : /(^\/\/|[:\\\s\u0000-\u001f])/.test(value.icon))) errors.push("アイコンには画像URL、サイト内パス、Cloudinary IDを入力してください");
  for (const [index, item] of value.sns.entries()) {
    if (!item.service || !webUrl(item.url)) errors.push(`SNS ${index + 1}: サービス名と有効なhttp(s) URLを入力してください`);
  }
  if (new Set(value.featuredWorks).size !== value.featuredWorks.length) errors.push("Featured Worksに同じ作品を重複して選択できません");
  const available = workIds ? new Set(workIds) : undefined;
  for (const ref of value.featuredWorks) {
    if (!/^(gallery|songs):[^\s:]+$/.test(ref)) errors.push(`Featured Worksの作品IDが不正です: ${ref}`);
    else if (available && !available.has(ref)) errors.push(`Featured Worksの作品が存在しないか非公開です: ${ref}`);
  }
  return errors;
}
