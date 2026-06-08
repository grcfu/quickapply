import { useEffect, useState } from "react";
import { AnswerManager } from "./AnswerManager";
import { AutofillButton } from "./AutofillButton";
import { DebugPanel } from "./debug/DebugPanel";
import { OnboardingForm } from "./onboarding/OnboardingForm";
import { ProfileCompleteness } from "./ProfileCompleteness";
import { ResumeManager } from "./ResumeManager";
import { SettingsPanel } from "./SettingsPanel";
import { getProfile } from "./storage/profileStorage";
import "./App.css";

type View =
  | { kind: "loading" }
  | { kind: "onboarding"; canCancel: boolean }
  | { kind: "main" };

function App() {
  const [view, setView] = useState<View>({ kind: "loading" });

  useEffect(() => {
    void (async () => {
      const profile = await getProfile();
      setView(
        profile?.identity
          ? { kind: "main" }
          : { kind: "onboarding", canCancel: false },
      );
    })();
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">QuickApply</h1>
        <div className="app__header-right">
          {view.kind === "main" && (
            <button
              className="app__header-btn"
              onClick={() =>
                setView({ kind: "onboarding", canCancel: true })
              }
            >
              Edit profile
            </button>
          )}
          <span className="app__tag">v0.0.1</span>
        </div>
      </header>
      {view.kind === "onboarding" && (
        <OnboardingForm
          onComplete={() => setView({ kind: "main" })}
          onCancel={
            view.canCancel ? () => setView({ kind: "main" }) : undefined
          }
        />
      )}
      {view.kind === "main" && (
        <>
          <ProfileCompleteness />
          <AutofillButton />
          <ResumeManager />
          <AnswerManager />
          <SettingsPanel />
          <DebugPanel />
        </>
      )}
    </div>
  );
}

export default App;
