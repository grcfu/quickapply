import { AutofillButton } from "./AutofillButton";
import { DebugPanel } from "./debug/DebugPanel";
import "./App.css";

function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">QuickApply</h1>
        <span className="app__tag">v0.0.1</span>
      </header>
      <AutofillButton />
      <hr className="app__divider" />
      <DebugPanel />
    </div>
  );
}

export default App;
