/* Задание второй части: ребёнок решает в тетради, потом открывает решение по шагам
   и сам ставит себе баллы по критериям ФИПИ */
import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, PenLine } from "lucide-react";
import { PART2 } from "../data/part2.js";
import { MathText } from "../components/MathText.jsx";
import { Figure } from "../components/Figure.jsx";
import { Mascot } from "../components/Mascot.jsx";
import { useProgress } from "../lib/progress.jsx";
import { haptic } from "../lib/telegram.js";
import { celebrate } from "../lib/confetti.js";

export function Part2Task({ id, onExit }) {
  const t = PART2.find((x) => x.id === id);
  const progress = useProgress();
  const [shown, setShown] = useState(0);
  const [graded, setGraded] = useState(null);
  const all = shown >= t.steps.length;

  const grade = (pts) => {
    haptic.ok();
    setGraded(pts);
    progress.part2(t.id, pts);
    if (pts === t.points) celebrate(1);
  };

  return (
    <div className="screen no-tabs">
      <div className="chip">Задание №{t.num} · {t.points} балла</div>
      <div className="h2 mt-s">{t.title}</div>
      <div className="card mt">
        <MathText as="div" className="task-q" text={t.q} />
      </div>

      {shown === 0 && (
        <div className="mt"><Mascot mood="think" say="Реши в тетради — как на экзамене, с записью всех шагов. Потом сверим!" /></div>
      )}

      <div className="steps">
        {t.steps.slice(0, shown).map((s, i) => (
          <motion.div key={i} className="step" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <span className="step-n">{i + 1}</span>
            <MathText as="div" className="grow" text={s} />
          </motion.div>
        ))}
      </div>
      {all && t.fig && <div className="card"><Figure fig={t.fig} /></div>}

      {!all ? (
        <button className="btn ghost" onClick={() => { haptic.tap(); setShown((s) => s + 1); }}>
          <PenLine size={18} /> {shown === 0 ? "Я решил — показать решение" : "Следующий шаг"} <ChevronRight size={18} />
        </button>
      ) : (
        <motion.div className="col" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="chip good" style={{ fontSize: 16, padding: "8px 14px", alignSelf: "flex-start" }}>Ответ: <MathText text={t.answer} /></div>
          <div className="card">
            <div className="h3">Критерии оценивания</div>
            <ul className="theory">{t.criteria.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
          {graded === null ? (
            <>
              <div className="h3">Сколько баллов ты бы получил?</div>
              <div className="row">
                {[0, 1, 2].map((p) => <button key={p} className={`btn ${p === 2 ? "good" : p === 1 ? "gold" : "ghost"}`} onClick={() => grade(p)}>{p}</button>)}
              </div>
            </>
          ) : (
            <>
              <Mascot mood={graded === 2 ? "party" : "happy"} say={graded === 2 ? "Отлично! Так и на экзамене 💪" : "Хорошо, что честно! Посмотри, какой шаг упустил, и попробуй похожую задачу в банке ФИПИ"} />
              <button className="btn" onClick={onExit}>Готово</button>
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}
