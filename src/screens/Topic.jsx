/* Тема (номер задания ОГЭ): шпаргалка, пошаговый разбор примера и тренировка */
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play, RefreshCw, ChevronRight, ExternalLink } from "lucide-react";
import { topicById } from "../data/oge.js";
import { SOURCES } from "../data/sources.js";
import { MathText } from "../components/MathText.jsx";
import { Figure } from "../components/Figure.jsx";
import { useProgress, starsOf } from "../lib/progress.jsx";
import { openLink, haptic } from "../lib/telegram.js";

export function Topic({ id, go }) {
  const t = topicById(id);
  const { state } = useProgress();
  const [tab, setTab] = useState("theory");
  const [c = 0, total = 0] = state.topics[id] || [];
  const stars = starsOf(state.topics[id]);

  return (
    <div className="screen no-tabs">
      <motion.div className="card" style={{ background: t.color, color: "#fff", border: 0 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="row">
          <motion.div style={{ fontSize: 54 }} animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 1.2, delay: 0.3 }}>{t.emoji}</motion.div>
          <div className="grow">
            <div style={{ fontWeight: 800, opacity: 0.85 }}>Задание №{t.num}</div>
            <div className="h1">{t.title}</div>
            <div className="stars mt-s">{[1, 2, 3].map((s) => <span key={s} style={{ opacity: s <= stars ? 1 : 0.35 }}>⭐</span>)}</div>
          </div>
        </div>
        <div className="small mt-s" style={{ opacity: 0.9 }}>
          {total ? `Решено верно ${c} из ${total} (${Math.round((c / total) * 100)}%)` : "Ещё не решал — начни с теории"}
          {starHint(stars, c)}
        </div>
      </motion.div>

      <div className="seg mt">
        {[["theory", "Теория"], ["example", "Разбор"], ["sources", "Банк ФИПИ"]].map(([k, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => { haptic.select(); setTab(k); }}>{l}</button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="mt">
          {tab === "theory" && (
            <div className="card">
              <div className="h3">📌 Что нужно знать</div>
              <ul className="theory">
                {t.theory.map((s, i) => <MathText key={i} as="li" text={s} />)}
              </ul>
            </div>
          )}
          {tab === "example" && <Example gen={t.gen} />}
          {tab === "sources" && <TopicSources num={t.num} />}
        </motion.div>
      </AnimatePresence>

      <button className="btn mt-l" onClick={() => go("practice", { id })}><Play size={20} fill="currentColor" /> Тренировка · 10 заданий</button>
    </div>
  );
}

function starHint(stars, correct) {
  if (stars >= 3) return " · все звёзды собраны!";
  const need = [5, 15, 30][stars] - correct;
  return need > 0 ? ` · до звезды: ${need} верных` : " · для третьей звезды нужна точность 70%";
}

// Пример решается по шагам: ребёнок сам открывает следующий шаг
function Example({ gen }) {
  const [task, setTask] = useState(gen);
  const [shown, setShown] = useState(0);
  const all = shown >= task.steps.length;
  const answerText = task.kind === "choice" ? `вариант ${task.answer}` : task.answer;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="h3">🔍 Разбор задания</div>
        <button className="chip" onClick={() => { setTask(gen()); setShown(0); }}><RefreshCw size={14} /> Другое</button>
      </div>
      <MathText as="div" className="task-q mt-s" text={task.q} />
      <Figure fig={task.fig} />
      {task.legend && <div className="legend">{task.legend.map((l, i) => <MathText key={i} as="div" text={l} />)}</div>}
      {task.options && <div className="legend">{task.options.map((o, i) => <MathText key={i} as="div" text={`${i + 1}) ${o}`} />)}</div>}

      <div className="steps">
        {task.steps.slice(0, shown).map((s, i) => (
          <motion.div key={`${i}-${s}`} className="step" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <span className="step-n">{i + 1}</span>
            <MathText as="div" className="grow" text={s} />
          </motion.div>
        ))}
      </div>
      {all ? (
        <motion.div className="chip good" initial={{ scale: 0.8 }} animate={{ scale: 1 }} style={{ fontSize: 16, padding: "8px 14px" }}>
          ✅ Ответ: <MathText text={answerText} />
        </motion.div>
      ) : (
        <button className="btn ghost" onClick={() => { haptic.tap(); setShown((s) => s + 1); }}>
          {shown === 0 ? "Показать первый шаг" : "Следующий шаг"} <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}

function TopicSources({ num }) {
  const list = SOURCES.filter((s) => ["fipi-bank", "reshu"].includes(s.id));
  return (
    <div className="col">
      <div className="muted small">Настоящие задания №{num} из экзаменов прошлых лет — в открытом банке ФИПИ и в каталоге РешуОГЭ. Решай там, а если что-то непонятно, возвращайся к разбору здесь.</div>
      {list.map((s) => (
        <button key={s.id} className="card tap link-card" onClick={() => openLink(s.url)}>
          <span className="link-emoji">{s.emoji}</span>
          <span className="grow">
            <span className="h3" style={{ display: "block" }}>{s.title}</span>
            <span className="muted small">{s.text}</span>
          </span>
          <ExternalLink size={18} color="var(--muted)" />
        </button>
      ))}
    </div>
  );
}
