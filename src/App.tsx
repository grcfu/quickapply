import { useEffect, useState } from "react";
import { AutofillButton } from "./AutofillButton";
import { DebugPanel } from "./debug/DebugPanel";
import { OnboardingForm } from "./onboarding/OnboardingForm";
import { getProfile } from "./storage/profileStorage";
import "./App.css";

type View = "loading" | "onboarding" | "main";

function App() {
  const [view, setView] = useState<View>("loading");

  useEffect(() => {
    void (async () => {
      const profile = await getProfile();
      setView(profile?.identity ? "main" : "onboarding");
    })();
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">QuickApply</h1>
        <span className="app__tag">v0.0.1</span>
      </header>
      {view === "onboarding" && (
        <OnboardingForm onComplete={() => setView("main")} />
      )}
      {view === "main" && (
        <>
          <AutofillButton />
          <hr className="app__divider" />
          <DebugPanel />
        </>
      )}
    </div>
  );
}

export default App;
