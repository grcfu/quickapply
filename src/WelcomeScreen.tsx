type Props = {
  onGetStarted: () => void;
};

const FEATURES = [
  "Fill name, email, work authorization, and demographics with one click",
  "Upload your resume once — we'll try to prefill your profile from it",
  "Save your answers to open-ended questions and reuse them on later applications",
  "Everything stays in your browser. No account, no server, no telemetry.",
];

export function WelcomeScreen({ onGetStarted }: Props) {
  return (
    <div className="welcome">
      <h2 className="welcome__title">Welcome to QuickApply</h2>
      <p className="welcome__subtitle">
        Autofill job applications across Greenhouse, Lever, Ashby, and Workday.
      </p>
      <ul className="welcome__features">
        {FEATURES.map((f) => (
          <li key={f} className="welcome__feature">
            <span className="welcome__bullet" aria-hidden="true" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="welcome__cta"
        onClick={onGetStarted}
      >
        Get started
      </button>
    </div>
  );
}
