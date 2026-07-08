import { load } from "js-yaml";

function normalizeYamlValue(value: unknown): unknown {
  if (value === null) return "";
  if (typeof value === "string") return value.replace(/\n$/, "");
  if (Array.isArray(value)) return value.map(normalizeYamlValue);
  if (typeof value === "object" && value) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, normalizeYamlValue(child)])
    );
  }
  return value;
}

export function parseYamlScalar(value: string): unknown {
  const parsed = load(value);
  return normalizeYamlValue(parsed);
}

export function parseYamlFrontmatter(source: string): Record<string, unknown> {
  const parsed = load(source);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  return normalizeYamlValue(parsed) as Record<string, unknown>;
}

export function yamlString(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/"/g, "\\\"")}"`;
}

export function yamlBlock(value: string) {
  return `|\n${value.split("\n").map((line) => `  ${line}`).join("\n")}`;
}

export function yamlArray(items: string[]) {
  return `[${items.map(yamlString).join(", ")}]`;
}

export function yamlObjectArray(items: Array<Record<string, string>>) {
  return `\n${items.map((item) => Object.entries(item).map(([key, value], index) => `${index === 0 ? "  -" : "  "} ${key}: ${yamlString(value)}`).join("\n")).join("\n")}`;
}
