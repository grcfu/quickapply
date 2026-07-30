import { useEffect, useState } from "react";
import {
  addAnswer,
  getProfile,
  removeAnswer,
} from "./storage/profileStorage";
import type { AnswerEntry } from "./types/profile";

const COPIED_FEEDBACK_MS = 1500;

/**
 * `navigator.clipboard` needs a secure context and, in some Chrome versions,
 * document focus — both of which an extension popup can lose mid-click. The
 * hidden-textarea + execCommand path is the fallback that still works there.
 */
async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    /* fall through to the legacy path below */
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "-1000px";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  try {
    ta.select();
    const ok = document.execCommand("copy");
    if (!ok) throw new Error("Clipboard copy was blocked by the browser.");
  } finally {
    ta.remove();
  }
}

export function AnswerManager() {
  const [answers, setAnswers] = useState<AnswerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const profile = await getProfile();
      setAnswers(profile?.answers ?? []);
    })();
  }, []);

  async function refresh() {
    const profile = await getProfile();
    setAnswers(profile?.answers ?? []);
  }

  function startAdd() {
    setAdding(true);
    setError(null);
  }

  function cancelAdd() {
    setAdding(false);
    setNewQuestion("");
    setNewAnswer("");
    setError(null);
  }

  async function onSave() {
    const q = newQuestion.trim();
    const a = newAnswer.trim();
    if (!q || !a) {
      setError("Question and answer are both required.");
      return;
    }
    try {
      await addAnswer({
        id: crypto.randomUUID(),
        question: q,
        answer: a,
        createdAt: Date.now(),
      });
      cancelAdd();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onCopy(entry: AnswerEntry) {
    try {
      await copyText(entry.answer);
      setError(null);
      setCopiedId(entry.id);
      window.setTimeout(
        () => setCopiedId((cur) => (cur === entry.id ? null : cur)),
        COPIED_FEEDBACK_MS,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onRemove(id: string) {
    try {
      await removeAnswer(id);
      await refresh();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <details className="panel">
      <summary className="panel__summary">
        <span className="panel__title">Saved answers</span>
        {answers.length > 0 && (
          <span className="panel__count">{answers.length}</span>
        )}
      </summary>
      <div className="panel__body">
      {answers.length === 0 ? (
        <p className="answers__empty">
          No saved answers yet. Add common application questions
          (e.g. &ldquo;Why are you interested?&rdquo;) so QuickApply
          can fill them next time.
        </p>
      ) : (
        <ul className="answers__list">
          {answers.map((a) => (
            <li key={a.id} className="answers__item">
              <div className="answers__q">{a.question}</div>
              <div className="answers__a">{a.answer}</div>
              <div className="answers__item-actions">
                <button
                  type="button"
                  className="answers__copy"
                  onClick={() => void onCopy(a)}
                  aria-label={`Copy answer for "${a.question}"`}
                >
                  {copiedId === a.id ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  className="answers__remove"
                  onClick={() => onRemove(a.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <div className="answers__form">
          <label className="answers__field">
            <span className="answers__label">Question</span>
            <textarea
              className="answers__input"
              rows={2}
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="e.g. Why are you interested in this role?"
            />
          </label>
          <label className="answers__field">
            <span className="answers__label">Answer</span>
            <textarea
              className="answers__input"
              rows={4}
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              placeholder="Your saved response."
            />
          </label>
          <div className="answers__actions">
            <button
              type="button"
              className="answers__cancel"
              onClick={cancelAdd}
            >
              Cancel
            </button>
            <button
              type="button"
              className="answers__save"
              onClick={onSave}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="answers__add-btn"
          onClick={startAdd}
        >
          + Add answer
        </button>
      )}
      {error && <p className="answers__error">{error}</p>}
      </div>
    </details>
  );
}
