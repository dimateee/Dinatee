/* Выбор предметов: математика и русский обязательны, остальные — по выбору ученика */
import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { SUBJECTS, REQUIRED } from "../data/subjects/index.js";
import { useProgress } from "../lib/progress.jsx";
import { haptic } from "../lib/telegram.js";

export function SubjectPicker({ value, onChange }) {
  const toggle = (id) => {
    if (REQUIRED.includes(id)) return;
    haptic.select();
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };
  return (
    <div className="subject-grid">
      {SUBJECTS.map((s, i) => {
        const on = value.includes(s.id);
        return (
          <motion.button key={s.id} className={`subject-card ${on ? "on" : ""}`} onClick={() => toggle(s.id)}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} whileTap={{ scale: 0.96 }}>
            <div className="emoji">{s.emoji}</div>
            <div className="h3">{s.title}</div>
            <div className="muted small">{REQUIRED.includes(s.id) ? "обязательный" : `${s.topics.length} тем`}</div>
            {on && <span className="check"><Check size={16} /></span>}
          </motion.button>
        );
      })}
    </div>
  );
}

export function Subjects({ onExit }) {
  const { state, setProfile } = useProgress();
  const [value, setValue] = useState(state.profile?.subjects?.length ? state.profile.subjects : REQUIRED);
  return (
    <div className="screen no-tabs">
      <div className="h1">Мои предметы</div>
      <div className="muted mt-s">На ОГЭ сдают 4 предмета: математику, русский язык и два по выбору.</div>
      <div className="mt"><SubjectPicker value={value} onChange={setValue} /></div>
      <button className="btn mt" onClick={() => { setProfile({ ...state.profile, subjects: value }); onExit(); }}>Сохранить</button>
    </div>
  );
}
