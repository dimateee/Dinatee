/* Профиль: уровень, достижения, статистика, подписка, источники */
import { motion } from "framer-motion";
import { Crown, ExternalLink, ChevronRight } from "lucide-react";
import { useProgress, levelProgress, ACHIEVEMENTS, currentStreak, starsOf } from "../lib/progress.jsx";
import { usePremium } from "../lib/premium.jsx";
import { TOPICS } from "../data/oge.js";
import { SOURCES, SCALE_NOTE } from "../data/sources.js";
import { openLink, tgUser, confirmDialog } from "../lib/telegram.js";

export function Profile({ go }) {
  const { state, reset } = useProgress();
  const { premium, until } = usePremium();
  const lp = levelProgress(state.xp);
  const solved = Object.values(state.topics).reduce((a, [c]) => a + c, 0) + Object.values(state.warm).reduce((a, [c]) => a + c, 0);
  const user = tgUser();

  // Слабые темы — где точность ниже 60% при хотя бы 5 попытках
  const weak = TOPICS.filter((t) => {
    const [c = 0, n = 0] = state.topics[t.id] || [];
    return n >= 5 && c / n < 0.6;
  });

  return (
    <div className="screen">
      <div className="row">
        <motion.div className="node" style={{ background: "var(--grad)", width: 72, height: 72, fontSize: 30 }} animate={{ rotate: [0, 6, -6, 0] }} transition={{ duration: 3, repeat: Infinity }}>
          {user?.photo_url ? <img src={user.photo_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%" }} /> : "🦉"}
        </motion.div>
        <div className="grow">
          <div className="h1">{state.profile?.name || "Ученик"}</div>
          <div className="muted">Уровень {lp.level} · {lp.title}</div>
        </div>
      </div>

      <div className="card row mt">
        <div className="stat"><b>🔥 {currentStreak(state)}</b><span className="muted small">дней подряд</span></div>
        <div className="stat"><b>💎 {state.xp}</b><span className="muted small">опыта</span></div>
        <div className="stat"><b>✅ {solved}</b><span className="muted small">решено</span></div>
      </div>

      <button className="card tap row mt" style={{ width: "100%", textAlign: "left", background: premium ? "var(--gold-soft)" : "var(--card)" }} onClick={() => go("paywall")}>
        <Crown color="var(--gold)" />
        <div className="grow">
          <div className="h3">{premium ? "PRO активна" : "ОГЭ Квест PRO — 150 ₽/мес"}</div>
          <div className="muted small">{premium ? `до ${new Date(until).toLocaleDateString("ru-RU")}` : "Все темы, варианты и вторая часть"}</div>
        </div>
        <ChevronRight color="var(--muted)" />
      </button>

      {weak.length > 0 && (
        <div className="card mt">
          <div className="h3">🎯 Стоит подтянуть</div>
          <div className="col gap-s mt-s">
            {weak.map((t) => (
              <button key={t.id} className="row" onClick={() => go("topic", { id: t.id })}>
                <span>{t.emoji}</span><span className="grow" style={{ textAlign: "left", fontWeight: 700 }}>№{t.num} {t.title}</span><ChevronRight size={16} color="var(--muted)" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card mt">
        <div className="h3">Прогресс по темам</div>
        <div className="col gap-s mt-s">
          {TOPICS.map((t) => {
            const [c = 0, n = 0] = state.topics[t.id] || [];
            return (
              <div key={t.id} className="row small">
                <span style={{ width: 34, fontWeight: 900 }}>{t.num}</span>
                <div className="bar grow" style={{ height: 8 }}><div style={{ width: `${Math.min(100, (c / 30) * 100)}%`, background: t.color }} /></div>
                <span style={{ width: 48, textAlign: "right" }}>{"⭐".repeat(starsOf(state.topics[t.id])) || (n ? `${Math.round((c / n) * 100)}%` : "—")}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="h2 mt-l">Достижения</div>
      <div className="ach-grid mt-s">
        {ACHIEVEMENTS.map((a, i) => {
          const on = state.ach.includes(a.id);
          return (
            <motion.div key={a.id} className={`ach ${on ? "" : "off"}`} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: on ? 1 : 0.4, scale: 1 }} transition={{ delay: i * 0.03 }}>
              <div className="ach-emoji">{a.emoji}</div>
              <div className="small" style={{ fontWeight: 900 }}>{a.title}</div>
              <div className="muted" style={{ fontSize: 11 }}>{a.text}</div>
            </motion.div>
          );
        })}
      </div>

      <div className="h2 mt-l">Проверенные источники</div>
      <div className="col mt-s">
        {SOURCES.map((s) => (
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
      <div className="muted small mt">{SCALE_NOTE}</div>
      <div className="muted small mt">Задания в приложении составлены по образцу открытого банка ФИПИ и генерируются автоматически. Задания с сайтов ФИПИ и РешуОГЭ открываются по ссылкам.</div>

      <button className="btn ghost mt-l" onClick={() => go("onboarding")}>Изменить цель и имя</button>
      <button className="btn ghost mt-s" style={{ color: "var(--bad)", background: "var(--bad-soft)" }} onClick={async () => { if (await confirmDialog("Сбросить весь прогресс? Подписка останется.")) reset(); }}>Сбросить прогресс</button>
    </div>
  );
}
