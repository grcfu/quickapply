import { useEffect, useState } from "react";
import { SUPPORTED_ATS_LABELS, getAtsLabel } from "./ats/fieldMapRegistry";

type SiteState =
  | { kind: "loading" }
  | { kind: "supported"; ats: string; title: string }
  | { kind: "unsupported" }
  | { kind: "no-tab" };

function humanList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")}, or ${items[items.length - 1]}`;
}

export function SiteStatus() {
  const [state, setState] = useState<SiteState>({ kind: "loading" });

  useEffect(() => {
    void (async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.url) {
        setState({ kind: "no-tab" });
        return;
      }
      try {
        const host = new URL(tab.url).hostname;
        const ats = getAtsLabel(host);
        if (ats) {
          setState({ kind: "supported", ats, title: tab.title ?? "" });
        } else {
          setState({ kind: "unsupported" });
        }
      } catch {
        setState({ kind: "unsupported" });
      }
    })();
  }, []);

  if (state.kind === "loading" || state.kind === "no-tab") return null;

  if (state.kind === "supported") {
    return (
      <div className="site-status site-status--ok">
        <span className="site-status__dot" aria-hidden="true" />
        <span className="site-status__ats">{state.ats}</span>
        {state.title && (
          <span className="site-status__title" title={state.title}>
            · {state.title}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="site-status site-status--off">
      <span className="site-status__dot" aria-hidden="true" />
      <span>
        Not on a supported ATS. Open a {humanList(SUPPORTED_ATS_LABELS)} posting
        to use autofill.
      </span>
    </div>
  );
}
