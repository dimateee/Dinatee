/* Игровая тренировка: 10 заданий подряд, комбо, опыт и разбор каждой ошибки.
   Режим «блиц» — 60 секунд лёгких примеров на скорость. */
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Flame, Check, Timer, BookOpen } from "lucide-react";
import { TaskView, Steps } from "../components/TaskView.jsx";
import { MathText } from "../components/MathText.jsx";
import { Mascot } from "../components/Mascot.jsx";
import { checkAnswer } from "../lib/math.js";
import { haptic } from "../lib/telegram.js";
import { useProgress } from "../lib/progress.jsx";
import { celebrate } from "../lib/confetti.js";

const PRAISE = ["Отлично!", "Супер!", "Так держать!", "Верно!", "Круто!", "Великолепно!", "В точку!"];
const SUPPORT = ["Ничего страшного — разберём", "Почти! Посмотри решение", "Ошибки помогают учиться", "Сейчас станет понятно"];
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
const BLITZ_SECONDS = 60;

export function Practice({ title, gen, topicId, warmId, count = 10, blitz = false, onExit }) {
  const progress = useProgress();
  const [i, setI] = useState(0);
  const [task, setTask] = useState(() => gen());
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("answer");
  const [combo, setCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [xp, setXp] = useState(0);
  const [floatXp, setFloatXp] = useState(null);
  const [done, setDone] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [left, setLeft] = useState(BLITZ_SECONDS);
  const phrase = useRef("");

  // Таймер блица
  useEffect(() => {
    if (!blitz || done) return;
    if (left <= 0) { finish(); return; }
    const t = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [blitz, left, done]);

  function finish() {
    setDone(true);
    if (blitz) progress.blitz(correct);
    else progress.bonus(15);
    const ratio = blitz ? Math.min(1, correct / 20) : correct / count;
    if (ratio >= 0.7) setTimeout(() => celebrate(ratio >= 0.9 ? 2 : 1), 250);
  }

  function check() {
    if (!input) return;
    const ok = checkAnswer(task, input);
    const gained = progress.answer({ topic: topicId, warm: warmId, correct: ok, combo });
    if (ok) {
      haptic.ok();
      setCorrect((c) => c + 1);
      setCombo((c) => c + 1);
      setXp((x) => x + gained);
      setFloatXp({ v: gained, k: Math.random() });
      phrase.current = pickOne(PRAISE);
    } else {
      haptic.error();
      setCombo(0);
      phrase.current = pickOne(SUPPORT);
    }
    setStatus(ok ? "ok" : "no");
    setShowSteps(!ok);
    if (blitz) setTimeout(() => next(true), ok ? 350 : 1100);
  }

  function next(fromBlitz = false) {
    if (!blitz && i + 1 >= count) return finish();
    if (blitz && !fromBlitz) return;
    setI((x) => x + 1);
    setTask(gen());
    setInput("");
    setStatus("answer");
    setShowSteps(false);
  }

  if (done) return <Results title={title} blitz={blitz} correct={correct} total={blitz ? i + (status === "answer" ? 0 : 1) : count} xp={xp} onExit={onExit} />;

  const pct = blitz ? (left / BLITZ_SECONDS) * 100 : ((i + (status === "answer" ? 0 : 1)) / count) * 100;

  return (
    <div className="screen no-tabs">
      <div className="session-top">
        <button className="icon-btn" onClick={onExit} aria-label="Выйти"><X size={20} /></button>
        <div className={`bar grow ${blitz ? "gold" : ""}`}><div style={{ width: `${pct}%` }} /></div>
        {blitz
          ? <span className="timer row gap-s" style={{ color: left <= 10 ? "var(--bad)" : "var(--ink)" }}><Timer size={18} />{left}</span>
          : <span className="combo">{combo >= 2 && <><Flame size={18} fill="currentColor" />×{combo}</>}</span>}
      </div>

      <div className="row muted small" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <b>{title}</b>
        <span>{blitz ? `Верно: ${correct}` : `${i + 1} / ${count}`}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={i} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ type: "spring", stiffness: 380, damping: 32 }}>
          <TaskView task={task} input={input} setInput={setInput} status={status} big={Boolean(warmId) || blitz} />
          {status === "answer" && (
            <button className="btn mt" disabled={!input} onClick={check}><Check size={20} /> Проверить</button>
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {floatXp && (
          <motion.div key={floatXp.k} className="float-xp" initial={{ opacity: 0, y: 10, scale: 0.6 }} animate={{ opacity: 1, y: -40, scale: 1.1 }} exit={{ opacity: 0 }} transition={{ duration: 0.7 }} onAnimationComplete={() => setFloatXp(null)}>
            +{floatXp.v} XP
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!blitz && status !== "answer" && (
          <motion.div className={`feedback ${status}`} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 340, damping: 32 }}>
            <div className="feedback-title">{status === "ok" ? "🎉" : "💡"} {phrase.current}</div>
            {status === "no" && <div className="mt-s">Правильный ответ: <b><MathText text={task.kind === "choice" ? `вариант ${task.answer}` : task.answer} /></b></div>}
            {showSteps ? <Steps steps={task.steps} /> : (
              <button className="chip mt-s" onClick={() => setShowSteps(true)}><BookOpen size={14} /> Показать решение</button>
            )}
            <button className={`btn ${status === "ok" ? "good" : "bad"} mt-s`} onClick={() => next()}>
              {i + 1 >= count ? "Завершить" : "Дальше"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {blitz && status === "no" && (
        <div className="center mt"><span className="chip" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>Ответ: {task.answer}</span></div>
      )}
    </div>
  );
}

function Results({ title, blitz, correct, total, xp, onExit }) {
  const ratio = total ? correct / total : 0;
  const mood = blitz ? (correct >= 15 ? "party" : "happy") : ratio >= 0.9 ? "party" : ratio >= 0.6 ? "wow" : "think";
  const say = blitz
    ? `${correct} правильных за минуту! ${correct >= 20 ? "Ты молния ⚡" : "Попробуй побить рекорд"}`
    : ratio >= 0.9 ? "Блестяще! Тема почти освоена" : ratio >= 0.6 ? "Хороший результат! Ещё немного практики" : "Каждая попытка делает тебя сильнее. Повтори теорию и попробуй снова";
  const stats = useMemo(() => [
    { label: "Верно", value: `${correct}${blitz ? "" : `/${total}`}` },
    { label: "Точность", value: `${Math.round(ratio * 100)}%` },
    { label: "Опыт", value: `+${xp + (blitz ? 0 : 15)}` },
  ], [correct, total, ratio, xp, blitz]);

  return (
    <div className="screen no-tabs">
      <motion.div className="col" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
        <div className="center mt-l">
          <motion.div initial={{ rotate: -20, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", delay: 0.1 }} style={{ fontSize: 84 }}>
            {ratio >= 0.9 || (blitz && correct >= 15) ? "🏆" : ratio >= 0.6 ? "⭐" : "💪"}
          </motion.div>
          <div className="h1 mt-s">{blitz ? "Блиц завершён" : "Тренировка пройдена"}</div>
          <div className="muted">{title}</div>
        </div>
        <div className="card row mt">
          {stats.map((s, k) => (
            <motion.div key={s.label} className="stat" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + k * 0.1 }}>
              <b>{s.value}</b><span className="muted small">{s.label}</span>
            </motion.div>
          ))}
        </div>
        <Mascot mood={mood} say={say} />
        <button className="btn mt" onClick={onExit}>Продолжить</button>
      </motion.div>
    </div>
  );
}
