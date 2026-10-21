/* Пробные варианты и вторая часть */
import { motion } from "framer-motion";
import { FileText, Lock, ChevronRight, Clock } from "lucide-react";
import { PART2 } from "../data/part2.js";
import { SCALE_NOTE } from "../data/sources.js";
import { useProgress } from "../lib/progress.jsx";
import { usePremium } from "../lib/premium.jsx";
import { haptic } from "../lib/telegram.js";

export const FREE_VARIANTS = 1;
export const FREE_PART2 = ["20a", "23a"];

export function Variants({ go }) {
  const { state } = useProgress();
  const { premium } = usePremium();
  const canVariant = premium || state.variants.length < FREE_VARIANTS;

  return (
    <div className="screen">
      <div className="h1">Варианты</div>
      <div className="muted mt-s">Пробный экзамен по первой части: 19 заданий, таймер и оценка по шкале ФИПИ.</div>

      <motion.div className="card hero mt" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="row">
          <FileText size={40} />
          <div className="grow">
            <div className="h2">Новый вариант</div>
            <div className="muted small">Задания 1–19 · каждый раз новые числа</div>
          </div>
        </div>
        <button className="btn white mt" onClick={() => { haptic.tap(); go(canVariant ? "variant" : "paywall"); }}>
          {canVariant ? "Начать" : <><Lock size={18} /> Доступно с подпиской</>}
        </button>
        {!premium && <div className="small mt-s center" style={{ opacity: 0.85 }}>Бесплатно: {FREE_VARIANTS} пробный вариант</div>}
      </motion.div>

      {state.variants.length > 0 && (
        <div className="card mt">
          <div className="h3">История</div>
          <div className="col gap-s mt-s">
            {state.variants.map(([d, score, grade], i) => (
              <div key={i} className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted"><Clock size={14} style={{ verticalAlign: -2 }} /> {d.split("-").reverse().join(".")}</span>
                <span><b>{score}</b>/19 · <span className={`chip ${grade >= 4 ? "good" : grade === 3 ? "gold" : ""}`}>«{grade}»</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section-title mt-l">Часть 2 · развёрнутый ответ</div>
      <div className="col">
        {PART2.map((t, i) => {
          const locked = !premium && !FREE_PART2.includes(t.id);
          const pts = state.p2[t.id];
          return (
            <motion.button key={t.id} className="card tap row" style={{ width: "100%", textAlign: "left" }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              whileTap={{ scale: 0.98 }} onClick={() => go(locked ? "paywall" : "part2", { id: t.id })}>
              <div className="link-emoji" style={{ fontWeight: 900, fontSize: 18 }}>№{t.num}</div>
              <div className="grow">
                <div className="h3">{t.title}</div>
                <div className="muted small">{pts === undefined ? `${t.points} балла` : `Твоя оценка: ${pts} из ${t.points}`}</div>
              </div>
              {locked ? <Lock size={18} color="var(--muted)" /> : <ChevronRight size={18} color="var(--muted)" />}
            </motion.button>
          );
        })}
      </div>
      <div className="muted small mt">{SCALE_NOTE}</div>
    </div>
  );
}
