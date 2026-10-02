import { useEffect, useRef, useState } from "react";

export function useTabLock(onAcquire: () => void) {
  const [tabId] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<"checking" | "owner" | "other" | "unavailable">("checking");
  const callback = useRef(onAcquire); callback.current = onAcquire;
  useEffect(() => {
    const key = "riddle-cms-active-tab";
    let wasBlocked = false;
    const claim = () => {
      try {
        let owner: { id?: string; at?: number } | null = null;
        try { owner = JSON.parse(localStorage.getItem(key) || "null"); } catch { /* Invalid locks may be replaced. */ }
        if (owner?.id && owner.id !== tabId && typeof owner.at === "number" && Date.now() - owner.at < 15000) { wasBlocked = true; setState("other"); return; }
        localStorage.setItem(key, JSON.stringify({ id: tabId, at: Date.now() }));
        setState("owner"); if (wasBlocked) { wasBlocked = false; callback.current(); }
      } catch { setState("unavailable"); }
    };
    const receive = (event: StorageEvent) => { if (event.key === key || event.key === null) claim(); };
    const release = () => { try { const owner = JSON.parse(localStorage.getItem(key) || "null"); if (owner?.id === tabId) localStorage.removeItem(key); } catch { /* No accessible lock to release. */ } };
    claim(); const timer = window.setInterval(claim, 5000);
    window.addEventListener("storage", receive); window.addEventListener("focus", claim); window.addEventListener("beforeunload", release);
    return () => { window.clearInterval(timer); window.removeEventListener("storage", receive); window.removeEventListener("focus", claim); window.removeEventListener("beforeunload", release); release(); };
  }, [tabId]);
  return { isOwner: () => { try { const owner = JSON.parse(localStorage.getItem("riddle-cms-active-tab") || "null"); return owner?.id === tabId && Date.now() - owner.at < 15000; } catch { return false; } }, blocked: state !== "owner", message: state === "other" ? "別のタブでCMSを使用中です。このタブは読み取り専用です" : state === "unavailable" ? "ブラウザの保存領域を利用できません" : state === "checking" ? "編集タブを確認しています" : "" };
}
