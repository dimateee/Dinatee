/* Тема (номер задания ОГЭ): шпаргалка, пошаговый разбор примера и тренировка */
import { useState } from "react";
import { Play, RefreshCw, ChevronRight, ExternalLink } from "lucide-react";
import { topicById, subjectById } from "../data/subjects/index.js";
import { subjectSources } from "../data/sources.js";
import { MathText } from "../components/MathText.jsx";
import { Figure } from "../components/Figure.jsx";
import { useProgress, starsOf } from "../lib/progress.jsx";
import { openLink, haptic } from "../lib/telegram.js";

export function Topic({ id, go }) {
  const t = topicById(id);
  const subject = subjectById(t.subject);
  const { state } = useProgress();
  const [tab, setTab] = useState("theory");
  const [c = 0, total = 0] = state.topics[id] || [];
  const stars = starsOf(state.topics[id]);

  return (
    <div className="screen no-tabs">
      <div className="card" style={{ background: t.color, color: "#fff", border: 0 }}>
        <div className="row">
          <div style={{ fontSize: 54 }}>{t.emoji}</div>
          <div className="grow">
            <div style={{ fontWeight: 800, opacity: 0.85 }}>{t.num ? `${subject.title} · задание №${t.num}` : `${subject.title} · ${t.tag}`}</div>
            <div className="h1">{t.title}</div>
            <div className="stars mt-s">{[1, 2, 3].map((s) => <span key={s} style={{ opacity: s <= stars ? 1 : 0.35 }}>⭐</span>)}</div>
          </div>
        </div>
        <div className="small mt-s" style={{ opacity: 0.9 }}>
          {total ? `Решено верно ${c} из ${total} (${Math.round((c / total) * 100)}%)` : "Ещё не решал — начни с теории"}
          {starHint(stars, c)}
        </div>
      </div>

      <div className="seg mt">
        {[["theory", "Теория"], ["example", "Разбор"], ["sources", "Банк ФИПИ"]].map(([k, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => { haptic.select(); setTab(k); }}>{l}</button>
        ))}
      </div>

      <div key={tab} className="mt anim-in">
        {tab === "theory" && (
          <div className="card">
            <div className="h3">📌 Что нужно знать</div>
            <ul className="theory">
              {t.theory.map((s, i) => <MathText key={i} as="li" text={s} />)}
            </ul>
          </div>
        )}
        {tab === "example" && <Example gen={t.gen} />}
        {tab === "sources" && <TopicSources subject={subject} />}
      </div>

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
      {task.code && <pre className="code mt-s">{task.code}</pre>}
      <Figure fig={task.fig} />
      {task.legend && <div className="legend">{task.legend.map((l, i) => <MathText key={i} as="div" text={l} />)}</div>}
      {task.options && <div className="legend">{task.options.map((o, i) => <MathText key={i} as="div" text={`${i + 1}) ${o}`} />)}</div>}

      <div className="steps">
        {task.steps.slice(0, shown).map((s, i) => (
          <div key={`${i}-${s}`} className="step anim-in">
            <span className="step-n">{i + 1}</span>
            <MathText as="div" className="grow" text={s} />
          </div>
        ))}
      </div>
      {all ? (
        <div className="chip good" style={{ fontSize: 16, padding: "8px 14px" }}>
          ✅ Ответ: <MathText text={answerText} />
        </div>
      ) : (
        <button className="btn ghost" onClick={() => { haptic.tap(); setShown((s) => s + 1); }}>
          {shown === 0 ? "Показать первый шаг" : "Следующий шаг"} <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}

function TopicSources({ subject }) {
  const list = subjectSources(subject).slice(0, 2);
  return (
    <div className="col">
      <div className="muted small">Настоящие задания по теме — в открытом банке ФИПИ и в каталоге РешуОГЭ ({subject.title.toLowerCase()}). Решай там, а если что-то непонятно, возвращайся к разбору здесь.</div>
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
