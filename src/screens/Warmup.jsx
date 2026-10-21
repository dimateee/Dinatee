/* Разминка: блиц на минуту и наборы лёгких примеров по навыкам */
import { motion } from "framer-motion";
import { Timer, Trophy } from "lucide-react";
import { WARMUPS } from "../data/warmup.js";
import { useProgress } from "../lib/progress.jsx";
import { Mascot } from "../components/Mascot.jsx";
import { haptic } from "../lib/telegram.js";

export function Warmup({ go }) {
  const { state } = useProgress();
  return (
    <div className="screen">
      <div className="h1">Разминка</div>
      <div className="muted mt-s">Простые примеры каждый день — фундамент для ОГЭ. Ошибся? Покажем решение по шагам.</div>

      <motion.button className="card hero tap mt" style={{ width: "100%", textAlign: "left", background: "var(--grad-gold)", color: "#4a2a00" }} whileTap={{ scale: 0.98 }} onClick={() => { haptic.tap(); go("blitz"); }}>
        <div className="row">
          <motion.div style={{ fontSize: 46 }} animate={{ scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}>⚡</motion.div>
          <div className="grow">
            <div className="h2">Блиц · 60 секунд</div>
            <div style={{ fontWeight: 700, opacity: 0.8 }}>Реши как можно больше примеров</div>
          </div>
          <div className="center">
            <Trophy size={20} />
            <div className="h3">{state.blitzBest}</div>
          </div>
        </div>
      </motion.button>

      <div className="col mt">
        {WARMUPS.map((w, i) => {
          const [c = 0, t = 0] = state.warm[w.id] || [];
          return (
            <motion.button key={w.id} className="card tap row" style={{ width: "100%", textAlign: "left" }}
              initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              whileTap={{ scale: 0.98 }} onClick={() => { haptic.tap(); go("drill", { id: w.id }); }}>
              <div className="link-emoji" style={{ background: `${w.color}22` }}>{w.emoji}</div>
              <div className="grow">
                <div className="h3">{w.title}</div>
                <div className="bar mt-s" style={{ height: 8 }}><div style={{ width: `${Math.min(100, (c / 30) * 100)}%`, background: w.color }} /></div>
              </div>
              <div className="muted small" style={{ minWidth: 48, textAlign: "right" }}>{t ? `${Math.round((c / t) * 100)}%` : <Timer size={16} />}</div>
            </motion.button>
          );
        })}
      </div>
      <div className="mt-l"><Mascot size={48} mood="think" say="Совет: 10 минут разминки каждый день полезнее, чем 2 часа раз в неделю" /></div>
    </div>
  );
}
