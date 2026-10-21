/* Знакомство: имя, цель по оценке и сколько заниматься в день */
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mascot } from "../components/Mascot.jsx";
import { useProgress } from "../lib/progress.jsx";
import { tgUser, haptic } from "../lib/telegram.js";

const GOALS = [
  [3, "«3» — сдать уверенно", "Сосредоточимся на заданиях, которые легче всего набрать"],
  [4, "«4» — хорошо", "Вся первая часть без ошибок"],
  [5, "«5» — отлично", "Первая часть + задания второй части"],
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

  const nextStep = () => {
    haptic.tap();
    if (step < 2) return setStep(step + 1);
    setProfile({ name: name.trim() || "Ученик", goal, daily });
    onDone();
  };

  const says = [
    "Привет! Я Огуша 🦉 Помогу подготовиться к ОГЭ по математике — шаг за шагом, без скуки. Как тебя зовут?",
    `${name.trim() || "Отлично"}, на какую оценку целимся?`,
    "Сколько времени в день готов заниматься? Главное — каждый день!",
  ];

  return (
    <div className="screen no-tabs" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="bar mt"><div style={{ width: `${((step + 1) / 3) * 100}%` }} /></div>
      <AnimatePresence mode="wait">
        <motion.div key={step} className="col mt-l grow" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
          <Mascot size={72} mood={step === 1 ? "wow" : "happy"} say={says[step]} />
          {step === 0 && (
            <input
              className="answer-box focus mt" style={{ fontSize: 22, width: "100%", outline: "none", color: "var(--ink)" }}
              value={name} onChange={(e) => setName(e.target.value)} placeholder="Твоё имя" maxLength={24} autoFocus
            />
          )}
          {step === 1 && GOALS.map(([v, t, d]) => (
            <button key={v} className={`option ${goal === v ? "sel" : ""}`} onClick={() => { haptic.select(); setGoal(v); }}>
              <span style={{ fontSize: 28 }}>{v === 5 ? "🏆" : v === 4 ? "⭐" : "✅"}</span>
              <span><span style={{ display: "block" }}>{t}</span><span className="muted small" style={{ fontWeight: 600 }}>{d}</span></span>
            </button>
          ))}
          {step === 2 && DAILY.map(([v, t, d]) => (
            <button key={v} className={`option ${daily === v ? "sel" : ""}`} onClick={() => { haptic.select(); setDaily(v); }}>
              <span style={{ fontSize: 28 }}>{v === 30 ? "🐢" : v === 50 ? "🦊" : "🚀"}</span>
              <span className="grow">{t}</span>
              <span className="muted small">{d} · {v} XP</span>
            </button>
          ))}
        </motion.div>
      </AnimatePresence>
      <button className="btn mt" onClick={nextStep}>{step < 2 ? "Дальше" : "Поехали! 🚀"}</button>
    </div>
  );
}
