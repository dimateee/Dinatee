import { useProgress } from "../lib/progress.jsx";

export function Toasts() {
  const { toasts } = useProgress();
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span className="toast-emoji">{t.emoji}</span>
          <div>
            <div className="h3">{t.kind === "ach" ? `Достижение: ${t.title}` : t.title}</div>
            <div className="muted small">{t.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
