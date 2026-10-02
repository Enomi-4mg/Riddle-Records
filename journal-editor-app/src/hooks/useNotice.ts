import { useCallback, useEffect, useState } from "react";

export type NoticeMessage = { id: string; message: string; tone: "info" | "error" };
export function useNotice() {
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const notify = useCallback((message: string, tone: NoticeMessage["tone"] = "info") => setNotice({ id: crypto.randomUUID(), message, tone }), []);
  const dismiss = useCallback(() => setNotice(null), []);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(dismiss, notice.tone === "error" ? 10000 : 5000); return () => window.clearTimeout(timer); }, [notice, dismiss]);
  return { notice, notify, dismiss };
}
