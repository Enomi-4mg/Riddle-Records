import { getCollection } from "astro:content";
import { aboutProfileErrors } from "../../shared/aboutProfile";
import { getViewingWorks } from "./works";
export async function getAboutPageData() {
  const entries = await getCollection("about");
  if (entries.length !== 1 || entries[0].id !== "profile.md") throw new Error("About must contain only src/content/about/profile.md");
  const profile = entries[0].data;
  const works = await getViewingWorks();
  const errors = aboutProfileErrors(profile, works.map((work) => work.id));
  if (errors.length) throw new Error(errors.join("\n"));
  return { profile, featuredWorks: profile.featuredWorks.map((id) => works.find((work) => work.id === id)!) };
}
