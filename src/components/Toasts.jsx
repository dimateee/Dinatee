import { AnimatePresence, motion } from "framer-motion";
import { useProgress } from "../lib/progress.jsx";

export function Toasts() {
  const { toasts } = useProgress();
  return (
    <div className="toasts">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} className="toast" initial={{ y: -40, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -30, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 26 }}>
            <span className="toast-emoji">{t.emoji}</span>
            <div>
              <div className="h3">{t.kind === "ach" ? `Достижение: ${t.title}` : t.title}</div>
              <div className="muted small">{t.text}</div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
