/* Знакомство: имя, предметы, цель по оценке и сколько заниматься в день */
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mascot } from "../components/Mascot.jsx";
import { useProgress } from "../lib/progress.jsx";
import { tgUser, haptic } from "../lib/telegram.js";
import { SubjectPicker } from "./Subjects.jsx";
import { REQUIRED } from "../data/subjects/index.js";

const GOALS = [
  [3, "«3» — сдать уверенно", "Сосредоточимся на самых важных темах"],
  [4, "«4» — хорошо", "Уверенно по всем темам"],
  [5, "«5» — отлично", "Все темы + сложные задания"],
];
const DAILY = [
  [30, "5 минут", "Лёгкий режим"],
  [50, "10 минут", "Оптимально"],
  [100, "20 минут", "Интенсив"],
];

export function Onboarding({ onDone }) {
  const { state, setProfile } = useProgress();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(state.profile?.name || tgUser()?.first_name || "");
  const [goal, setGoal] = useState(state.profile?.goal || 4);
  const [daily, setDaily] = useState(state.profile?.daily || 50);
  const [subjects, setSubjects] = useState(state.profile?.subjects?.length ? state.profile.subjects : REQUIRED);

  const nextStep = () => {
    haptic.tap();
    if (step < 3) return setStep(step + 1);
    setProfile({ name: name.trim() || "Ученик", goal, daily, subjects });
    onDone();
  };

  const says = [
    "Привет! Я Огуша 🦉 Помогу подготовиться к ОГЭ — шаг за шагом, без скуки. Как тебя зовут?",
    `${name.trim() || "Отлично"}, какие предметы сдаёшь? Математика и русский — обязательные, отметь ещё два.`,
    "На какую оценку целимся?",
    "Сколько времени в день готов заниматься? Главное — каждый день!",
  ];

  return (
    <div className="screen no-tabs" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="bar mt"><div style={{ width: `${((step + 1) / 4) * 100}%` }} /></div>
      <AnimatePresence mode="wait">
        <motion.div key={step} className="col mt-l grow" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
          <Mascot size={72} mood={step === 2 ? "wow" : "happy"} say={says[step]} />
          {step === 0 && (
            <input
              className="answer-box focus mt" style={{ fontSize: 22, width: "100%", outline: "none", color: "var(--ink)" }}
              value={name} onChange={(e) => setName(e.target.value)} placeholder="Твоё имя" maxLength={24} autoFocus
            />
          )}
          {step === 1 && <SubjectPicker value={subjects} onChange={setSubjects} />}
          {step === 2 && GOALS.map(([v, t, d]) => (
            <button key={v} className={`option ${goal === v ? "sel" : ""}`} onClick={() => { haptic.select(); setGoal(v); }}>
              <span style={{ fontSize: 28 }}>{v === 5 ? "🏆" : v === 4 ? "⭐" : "✅"}</span>
              <span><span style={{ display: "block" }}>{t}</span><span className="muted small" style={{ fontWeight: 600 }}>{d}</span></span>
            </button>
          ))}
          {step === 3 && DAILY.map(([v, t, d]) => (
            <button key={v} className={`option ${daily === v ? "sel" : ""}`} onClick={() => { haptic.select(); setDaily(v); }}>
              <span style={{ fontSize: 28 }}>{v === 30 ? "🐢" : v === 50 ? "🦊" : "🚀"}</span>
              <span className="grow">{t}</span>
              <span className="muted small">{d} · {v} XP</span>
            </button>
          ))}
        </motion.div>
      </AnimatePresence>
      <button className="btn mt" onClick={nextStep}>{step < 3 ? "Дальше" : "Поехали! 🚀"}</button>
    </div>
  );
}
