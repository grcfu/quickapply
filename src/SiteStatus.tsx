import { useEffect, useState } from "react";

type SiteState =
  | { kind: "loading" }
  | { kind: "supported"; ats: string; title: string }
  | { kind: "unsupported" }
  | { kind: "no-tab" };

const ATS_LABELS: Record<string, string> = {
  "greenhouse.io": "Greenhouse",
  "lever.co": "Lever",
  "ashbyhq.com": "Ashby",
  "myworkdayjobs.com": "Workday",
};

function detectAts(host: string): string | null {
  for (const [suffix, label] of Object.entries(ATS_LABELS)) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return label;
  }
  return null;
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
        const ats = detectAts(host);
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
        Not on a supported ATS. Open a Greenhouse, Lever, Ashby, or Workday
        posting to use autofill.
      </span>
    </div>
  );
}
