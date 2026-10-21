/* Главная: шапка с уровнем, серией и дневной целью + карта пути по заданиям ОГЭ */
import { useEffect, useState } from "react";
import { Flame, Gem, Lock, Crown, Zap } from "lucide-react";
import { topicLabel } from "../data/subjects/index.js";
import { SubjectBar, useSubject } from "../components/SubjectBar.jsx";
import { useProgress, levelProgress, starsOf, currentStreak, todayKey } from "../lib/progress.jsx";
import { usePremium } from "../lib/premium.jsx";
import { Mascot } from "../components/Mascot.jsx";
import { haptic } from "../lib/telegram.js";

const OFFSETS = [0, 70, 100, 70, 0, -70, -100, -70];

export function Home({ go }) {
  const { state } = useProgress();
  const { premium } = usePremium();
  const lp = levelProgress(state.xp);
  const streak = currentStreak(state);
  const goal = state.profile?.daily || 50;
  const todayXp = state.today.d === todayKey() ? state.today.xp : 0;
  const subject = useSubject();
  const TOPICS = subject.topics;

  // Следующая тема — первая доступная, где ещё нет звёзд
  const nextId = (TOPICS.find((t) => (premium || t.free) && starsOf(state.topics[t.id]) < 1) || TOPICS[0]).id;

  const greeting = todayXp >= goal
    ? "Цель на сегодня выполнена! Можешь отдохнуть или набрать ещё опыта 🌟"
    : todayXp > 0 ? `Осталось ${goal - todayXp} XP до цели на сегодня` : `Привет, ${state.profile?.name || "друг"}! Начнём с разминки?`;

  return (
    <div className="screen">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row gap-s">
          <span className="chip fire"><Flame size={16} fill="currentColor" /> {streak}</span>
          <span className="chip gold"><Gem size={15} /> {state.xp} XP</span>
        </div>
        {premium
          ? <span className="premium-badge"><Crown size={13} /> PRO</span>
          : <button className="premium-badge" onClick={() => go("paywall")}><Crown size={13} /> Открыть всё</button>}
      </div>

      <SubjectBar go={go} />

      <div className="card hero mt">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="muted small" style={{ fontWeight: 800 }}>Уровень {lp.level}</div>
            <div className="h2">{lp.title}</div>
          </div>
          <div className="center">
            <DailyRing value={todayXp} goal={goal} />
          </div>
        </div>
        <div className="bar mt-s" style={{ background: "rgba(255,255,255,0.25)" }}><div style={{ width: `${lp.pct * 100}%`, background: "#fff" }} /></div>
        <div className="small mt-s" style={{ opacity: 0.85 }}>{lp.into} / {lp.need} XP до уровня {lp.level + 1}</div>
      </div>

      <div className="mt">
        <Mascot size={52} say={greeting} />
      </div>

      <button className="card tap row mt" style={{ width: "100%", textAlign: "left" }} onClick={() => { haptic.tap(); go("warmup"); }}>
        <div className="link-emoji" style={{ background: "var(--gold-soft)" }}>⚡</div>
        <div className="grow">
          <div className="h3">Разминка дня</div>
          <div className="muted small">Лёгкие примеры, чтобы включить голову</div>
        </div>
        <Zap color="var(--gold)" />
      </button>

      <div className="section-title mt-l">{subject.emoji} {subject.title}</div>
      <div className="path" key={subject.id}>
        {TOPICS.map((t, idx) => {
          const locked = !premium && !t.free;
          const stars = starsOf(state.topics[t.id]);
          const isNext = t.id === nextId;
          if (subject.id === "math" && idx === 10) {
            return (
              <div key={t.id}>
                <div className="section-title">Геометрия</div>
                <Node t={t} idx={idx} locked={locked} stars={stars} isNext={isNext} go={go} />
              </div>
            );
          }
          return <Node key={t.id} t={t} idx={idx} locked={locked} stars={stars} isNext={isNext} go={go} />;
        })}
      </div>

      {subject.hasPart2 && <div className="section-title">Часть 2</div>}
      {subject.hasPart2 && <button className="card tap row" style={{ width: "100%", textAlign: "left" }} onClick={() => go("variants")}>
        <div className="link-emoji">🧠</div>
        <div className="grow">
          <div className="h3">Задания 20–25 с разбором</div>
          <div className="muted small">Уравнения, текстовые задачи, доказательства</div>
        </div>
        {!premium && <Lock size={18} color="var(--muted)" />}
      </button>}
      {!subject.hasPart2 && (
        <button className="card tap row" style={{ width: "100%", textAlign: "left" }} onClick={() => go("variants")}>
          <div className="link-emoji">📝</div>
          <div className="grow">
            <div className="h3">Мини-тест по предмету</div>
            <div className="muted small">{subject.testInfo}</div>
          </div>
        </button>
      )}
    </div>
  );
}

function Node({ t, idx, locked, stars, isNext, go }) {
  // Сдвиг змейкой — на внешнем блоке, анимация появления — на внутреннем, чтобы они не мешали друг другу
  return (
    <div className="node-wrap" style={{ transform: `translateX(${OFFSETS[idx % OFFSETS.length]}px)` }}>
      <div className="node-inner anim-pop" style={{ animationDelay: `${Math.min(idx, 6) * 40}ms` }}>
        <button className={`node ${locked ? "locked" : ""}`} style={{ background: t.color }} onClick={() => { haptic.tap(); go(locked ? "paywall" : "topic", { id: t.id }); }} aria-label={`${t.num ? `Задание ${t.num}` : t.tag}: ${t.title}`}>
          {isNext && !locked && <span className="ring-pulse" style={{ borderColor: t.color }} />}
          <span>{t.emoji}</span>
          <span className="node-num">{topicLabel(t)}</span>
          {locked && <span className="node-lock"><Lock size={14} /></span>}
        </button>
        <div className="node-label">{t.title}</div>
        <div className="stars">{[1, 2, 3].map((s) => <span key={s} style={{ opacity: s <= stars ? 1 : 0.25 }}>⭐</span>)}</div>
      </div>
    </div>
  );
}

function DailyRing({ value, goal }) {
  const r = 24, c = 2 * Math.PI * r, p = Math.min(1, value / goal);
  // Кольцо заполняется плавно после первого кадра (CSS-переход, без JavaScript-анимации)
  const [shown, setShown] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setShown(p)); return () => cancelAnimationFrame(id); }, [p]);
  return (
    <div style={{ position: "relative", width: 60 }}>
      <svg width="60" height="60" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={r} stroke="rgba(255,255,255,0.25)" strokeWidth="7" fill="none" />
        <circle className="ring-progress" cx="30" cy="30" r={r} stroke="#ffd166" strokeWidth="7" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - shown)} transform="rotate(-90 30 30)" />
      </svg>
      <div style={{ position: "absolute", top: 0, left: 0, width: 60, height: 60, display: "grid", placeItems: "center", fontSize: 20 }}>{p >= 1 ? "🏅" : "🎯"}</div>
      <div className="small" style={{ fontWeight: 800, marginTop: 2 }}>{value}/{goal}</div>
    </div>
  );
}
