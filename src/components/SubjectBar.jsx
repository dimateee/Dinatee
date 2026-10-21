/* Переключатель предметов — горизонтальная лента, как список предметов в электронном дневнике */
import { Plus } from "lucide-react";
import { SUBJECTS, subjectById, REQUIRED } from "../data/subjects/index.js";
import { useProgress } from "../lib/progress.jsx";
import { haptic } from "../lib/telegram.js";

export const mySubjects = (state) => {
  const ids = state.profile?.subjects?.length ? state.profile.subjects : REQUIRED;
  return SUBJECTS.filter((s) => ids.includes(s.id));
};

// Текущий предмет: выбранный, если он есть среди предметов ученика
export function useSubject() {
  const { state } = useProgress();
  const list = mySubjects(state);
  return list.find((s) => s.id === state.subject) || list[0] || subjectById("math");
}

export function SubjectBar({ go }) {
  const { state, setSubject } = useProgress();
  const current = useSubject();
  return (
    <div className="subject-bar">
      {mySubjects(state).map((s) => {
        const on = s.id === current.id;
        return (
          <button key={s.id} className={`subject-chip ${on ? "on" : ""}`} style={on ? { background: s.color, borderColor: s.color } : undefined}
            onClick={() => { haptic.select(); setSubject(s.id); }}>
            <span>{s.emoji}</span>{s.short}
          </button>
        );
      })}
      <button className="subject-chip" onClick={() => go("subjects")} aria-label="Выбрать предметы"><Plus size={16} /></button>
    </div>
  );
}
