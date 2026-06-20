function stripComment(value: string) {
  let quote = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ((char === "\"" || char === "'") && value[index - 1] !== "\\") {
      quote = quote === char ? "" : quote || char;
    }
    if (char === "#" && !quote && /\s/.test(value[index - 1] || "")) {
      return value.slice(0, index).trimEnd();
    }
  }
  return value.trimEnd();
}

export function parseYamlScalar(value: string): unknown {
  const trimmed = stripComment(value).trim();
  if (!trimmed) return "";
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null" || trimmed === "~") return null;
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    const inner = trimmed.slice(1, -1);
    return trimmed.startsWith("\"")
      ? inner.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\"/g, "\"").replace(/\\\\/g, "\\")
      : inner.replace(/''/g, "'");
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((item) => parseYamlScalar(item)).filter((item) => item !== "");
  }
  return trimmed;
}

export function parseYamlFrontmatter(source: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = source.replace(/\r\n/g, "\n").split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    const keyValue = line.match(/^([A-Za-z0-9_]+):(?:\s*(.*))?$/);
    if (!keyValue) continue;
    const [, key, rawValue = ""] = keyValue;
    const value = rawValue.trimEnd();

    if (value === "|" || value === ">") {
      const block: string[] = [];
      while (index + 1 < lines.length && /^(?:\s{2,}|\s*$)/.test(lines[index + 1])) {
        index += 1;
        block.push(lines[index].replace(/^ {2}/, ""));
      }
      result[key] = value === ">" ? block.join(" ").replace(/\s+/g, " ").trimEnd() : block.join("\n").trimEnd();
      continue;
    }

    if (!value) {
      const array: unknown[] = [];
      const object: Record<string, unknown> = {};
      let mode: "array" | "object" | null = null;
      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
        index += 1;
        const nested = lines[index];
        const arrayItem = nested.match(/^\s*-\s*(.*)$/);
        const nestedKeyValue = nested.match(/^\s+([A-Za-z0-9_]+):\s*(.*)$/);
        if (arrayItem) {
          mode = "array";
          const inlineObject = arrayItem[1].match(/^([A-Za-z0-9_]+):\s*(.*)$/);
          if (inlineObject) {
            const object: Record<string, unknown> = {
              [inlineObject[1]]: parseYamlScalar(inlineObject[2])
            };
            while (index + 1 < lines.length && /^\s{4,}[A-Za-z0-9_]+:/.test(lines[index + 1])) {
              index += 1;
              const child = lines[index].match(/^\s+([A-Za-z0-9_]+):\s*(.*)$/);
              if (child) object[child[1]] = parseYamlScalar(child[2]);
            }
            array.push(object);
          } else {
            array.push(parseYamlScalar(arrayItem[1]));
          }
        } else if (nestedKeyValue) {
          mode = "object";
          object[nestedKeyValue[1]] = parseYamlScalar(nestedKeyValue[2]);
        }
      }
      result[key] = mode === "object" ? object : mode === "array" ? array : "";
      continue;
    }

    result[key] = parseYamlScalar(value);
  }

  return result;
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
