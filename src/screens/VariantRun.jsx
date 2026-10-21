/* Пробный вариант: 19 заданий, свободный переход между ними, таймер как на экзамене.
   Ответы проверяются только в конце — как на настоящем ОГЭ. */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Flag, X } from "lucide-react";
import { makeVariant, gradeOf } from "../data/oge.js";
import { TaskView, Steps } from "../components/TaskView.jsx";
import { MathText } from "../components/MathText.jsx";
import { Mascot } from "../components/Mascot.jsx";
import { checkAnswer } from "../lib/math.js";
import { useProgress } from "../lib/progress.jsx";
import { celebrate } from "../lib/confetti.js";
import { haptic } from "../lib/telegram.js";

// На всю работу даётся 3 ч 55 мин; на первую часть рекомендуем около 1 ч 30 мин
const PART1_SECONDS = 90 * 60;
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function VariantRun({ onExit }) {
  const progress = useProgress();
  const tasks = useMemo(makeVariant, []);
  const [answers, setAnswers] = useState(() => tasks.map(() => ""));
  const [cur, setCur] = useState(0);
  const [left, setLeft] = useState(PART1_SECONDS);
  const [result, setResult] = useState(null);
  const [review, setReview] = useState(null);

  useEffect(() => {
    if (result) return;
    if (left <= 0) { finish(); return; }
    const t = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [left, result]);

  function finish() {
    const marks = tasks.map((t, i) => checkAnswer(t, answers[i]));
    const score = marks.filter(Boolean).length;
    const geometry = tasks.filter((t, i) => t.geometry && marks[i]).length;
    const grade = gradeOf(score, geometry);
    setResult({ marks, score, geometry, grade });
    progress.variant(score, grade);
    progress.bonus(score * 5);
    if (grade >= 4) setTimeout(() => celebrate(grade === 5 ? 2 : 1), 300);
  }

  const setAnswer = (v) => setAnswers((a) => a.map((x, i) => (i === cur ? v : x)));

  if (review !== null) {
    const t = tasks[review];
    const ok = result.marks[review];
    return (
      <div className="screen no-tabs">
        <div className="session-top">
          <button className="icon-btn" onClick={() => setReview(null)}><ChevronLeft size={20} /></button>
          <div className="h3 grow">Задание {t.num}</div>
          <span className={`chip ${ok ? "good" : ""}`} style={ok ? {} : { background: "var(--bad-soft)", color: "var(--bad)" }}>{ok ? "Верно" : "Ошибка"}</span>
        </div>
        <TaskView task={t} input={answers[review]} setInput={() => {}} status={ok ? "ok" : "no"} />
        <div className="card mt">
          <div>Твой ответ: <b>{answers[review] || "—"}</b> · Правильный: <b><MathText text={t.kind === "choice" ? `вариант ${t.answer}` : t.answer} /></b></div>
          <Steps steps={t.steps} />
        </div>
      </div>
    );
  }

  if (result) {
    const { marks, score, geometry, grade } = result;
    const say = grade === 5 ? "Это уровень пятёрки! Для максимума добавь вторую часть 🚀"
      : grade === 4 ? "Твёрдая четвёрка по первой части. Ещё чуть-чуть до пятёрки!"
      : grade === 3 ? "Порог пройден! Разбери ошибки ниже — каждая даёт +1 балл"
      : geometry < 2 && score >= 8 ? "Баллов хватает, но нужно минимум 2 задания по геометрии (15–19)"
      : "Не страшно! Нажми на красные номера и посмотри решения";
    return (
      <div className="screen no-tabs">
        <motion.div className="center mt" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}>
          <div className="muted">Результат первой части</div>
          <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 1.1 }}>«{grade}»</div>
          <div className="h2">{score} из 19 баллов</div>
          <div className="muted small">из них по геометрии: {geometry}</div>
        </motion.div>
        <div className="mt"><Mascot mood={grade >= 4 ? "party" : grade === 3 ? "wow" : "think"} say={say} /></div>
        <div className="card mt">
          <div className="h3">Разбор ответов</div>
          <div className="muted small">Нажми на номер, чтобы увидеть решение</div>
          <div className="grid-nums mt-s">
            {tasks.map((t, i) => (
              <button key={i} className={`num-cell ${marks[i] ? "ok" : "no"}`} onClick={() => setReview(i)}>{t.num}</button>
            ))}
          </div>
        </div>
        <div className="muted small mt">Оценка — по рекомендованной шкале ФИПИ только за первую часть. На экзамене вторая часть даёт ещё до 12 баллов.</div>
        <button className="btn mt" onClick={onExit}>Готово</button>
      </div>
    );
  }

  const t = tasks[cur];
  const answered = answers.filter(Boolean).length;
  return (
    <div className="screen no-tabs">
      <div className="session-top">
        <button className="icon-btn" onClick={onExit} aria-label="Выйти"><X size={20} /></button>
        <div className="grow">
          <div className="bar"><div style={{ width: `${(answered / tasks.length) * 100}%` }} /></div>
        </div>
        <span className="timer" style={{ color: left < 300 ? "var(--bad)" : "var(--ink)" }}>⏱ {mmss(left)}</span>
      </div>

      <div className="grid-nums" style={{ gridTemplateColumns: "repeat(10, 1fr)", gap: 5 }}>
        {tasks.map((x, i) => (
          <button key={i} className={`num-cell ${answers[i] ? "done" : ""} ${i === cur ? "cur" : ""}`} style={{ height: 34, borderRadius: 10, fontSize: 13 }} onClick={() => { haptic.select(); setCur(i); }}>{x.num}</button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={cur} className="mt" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }}>
          <div className="chip mt-s">Задание {t.num}{t.geometry ? " · геометрия" : ""}</div>
          <div className="mt-s"><TaskView task={t} input={answers[cur]} setInput={setAnswer} status="answer" /></div>
        </motion.div>
      </AnimatePresence>

      <div className="row mt">
        <button className="btn ghost" style={{ width: 64 }} disabled={cur === 0} onClick={() => setCur((c) => c - 1)}><ChevronLeft /></button>
        {cur < tasks.length - 1
          ? <button className="btn" onClick={() => setCur((c) => c + 1)}>Дальше <ChevronRight size={18} /></button>
          : <button className="btn good" onClick={finish}><Flag size={18} /> Завершить</button>}
      </div>
      {cur < tasks.length - 1 && answered >= 10 && (
        <button className="btn ghost mt-s" onClick={finish}><Flag size={18} /> Завершить ({answered}/19)</button>
      )}
    </div>
  );
}
