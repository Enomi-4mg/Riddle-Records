import { useEffect, useRef, useState } from "react";
import { parseTagInput } from "../lib/cmsMarkdown";

export function TagInput({ documentId, tags, onCommit }: { documentId: string; tags: string[]; onCommit: (tags: string[]) => void }) {
  const savedTags = tags.join(", ");
  const [text, setText] = useState(savedTags);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (input.current !== document.activeElement) setText(savedTags);
  }, [documentId, savedTags]);
  return <input ref={input} value={text} onChange={(event) => setText(event.target.value)} onBlur={() => onCommit(parseTagInput(text))} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} placeholder="タグをカンマで区切る" />;
}
