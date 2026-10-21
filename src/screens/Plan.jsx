/* План подготовки к ОГЭ-2027: обратный отсчёт, этапы, задачи на неделю, готовность по предметам,
   ключевые даты, изменения 2027 года и свежие материалы */
import { Check, ExternalLink, ChevronRight, CalendarClock } from "lucide-react";
import { useProgress } from "../lib/progress.jsx";
import { openLink, haptic } from "../lib/telegram.js";
import { mySubjects } from "../components/SubjectBar.jsx";
import { Mascot } from "../components/Mascot.jsx";
import { EXAM_DATE, MILESTONES, CHANGES, MATERIALS, PHASES, weekTasks, readiness, daysUntil, dayKey } from "../data/plan.js";
import { plural } from "../lib/math.js";

const fmtDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

export function Plan({ go }) {
  const { state, togglePlan, setSubject } = useProgress();
  const subjects = mySubjects(state);
  const goal = state.profile?.goal || 4;
  const { phase, target, week, tasks } = weekTasks({ state, subjects, goal });
  const done = tasks.filter((t) => t.done).length;
  const toExam = daysUntil(EXAM_DATE);
  const toInterview = daysUntil("2027-02-10");
  const today = dayKey(new Date());

  const open = (t) => {
    haptic.tap();
    if (t.kind === "manual") return togglePlan(week, t.id);
    if (!t.go) return;
    const [name, params] = t.go;
    if (params?.subject) setSubject(params.subject);
    go(name, params);
  };

  return (
    <div className="screen">
      <div className="h1">План до ОГЭ-2027</div>
      <div className="muted mt-s">Цель — «{goal}», предметы: {subjects.map((s) => s.short.toLowerCase()).join(", ")}</div>

      <div className="card hero mt anim-in">
        <div className="row">
          <CalendarClock size={40} />
          <div className="grow">
            <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1 }}>{toExam > 0 ? plural(toExam, ["день", "дня", "дней"]) : "Экзамены идут"}</div>
            <div className="muted small">до основного периода ОГЭ (ориентир — начало июня 2027)</div>
          </div>
        </div>
        {subjects.some((s) => s.id === "rus") && toInterview > 0 && (
          <div className="small mt-s" style={{ fontWeight: 800 }}>🗣️ Итоговое собеседование через {plural(toInterview, ["день", "дня", "дней"])} — 10 февраля</div>
        )}
      </div>

      {/* Этапы */}
      <div className="phase-line mt">
        {PHASES.map((p) => (
          <div key={p.id} className={`phase-step ${p.id === phase.id ? "on" : today > p.to ? "past" : ""}`}>
            <div className="phase-emoji">{p.emoji}</div>
            <div className="phase-title">{p.title}</div>
            <div className="phase-date">{fmtDate(p.from).replace(/ \d{4}.*/, "")}</div>
          </div>
        ))}
      </div>
      <div className="card mt-s">
        <div className="h3">{phase.emoji} Сейчас: {phase.title}</div>
        <div className="mt-s">{phase.goal}</div>
        <ul className="theory">{phase.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
        <div className="muted small">Цель этапа по темам: {"⭐".repeat(target)} в каждой теме · до {fmtDate(phase.to)}</div>
      </div>

      {/* Неделя */}
      <div className="row mt-l" style={{ justifyContent: "space-between" }}>
        <div className="h2">Эта неделя</div>
        <span className={`chip ${done === tasks.length ? "good" : ""}`}>{done} из {tasks.length}</span>
      </div>
      <div className="bar mt-s good"><div style={{ width: `${(done / tasks.length) * 100}%` }} /></div>
      <div className="col gap-s mt stagger">
        {tasks.map((t) => (
          <button key={t.id} className={`card tap row plan-task ${t.done ? "done" : ""}`} onClick={() => open(t)}>
            <span className="plan-check">{t.done && <Check size={16} strokeWidth={3} />}</span>
            <span className="grow" style={{ textAlign: "left" }}>
              <span className="h3" style={{ display: "block", fontSize: 15 }}>{t.title}</span>
              <span className="muted small">{t.detail}{t.kind === "manual" ? " · отметь, когда сделаешь" : ""}</span>
            </span>
            {t.url ? <ExternalLink size={18} color="var(--muted)" onClick={(e) => { e.stopPropagation(); openLink(t.url); }} /> : t.go ? <ChevronRight size={18} color="var(--muted)" /> : null}
          </button>
        ))}
      </div>
      <div className="mt"><Mascot size={44} mood={done === tasks.length ? "party" : "happy"} say={done === tasks.length ? "Неделя закрыта! Ты молодец 🎉" : "Задачи обновляются каждый понедельник и подстраиваются под твой прогресс"} /></div>

      {/* Готовность */}
      <div className="h2 mt-l">Готовность по предметам</div>
      <div className="card col gap-s mt-s">
        {subjects.map((s) => {
          const r = readiness(s, state.topics);
          return (
            <div key={s.id} className="row small">
              <span style={{ width: 110, fontWeight: 800 }}>{s.emoji} {s.short}</span>
              <div className="bar grow" style={{ height: 10 }}><div style={{ width: `${r}%`, background: s.color }} /></div>
              <span style={{ width: 40, textAlign: "right", fontWeight: 800 }}>{r}%</span>
            </div>
          );
        })}
        <div className="muted small">100% — все темы на три звезды</div>
      </div>

      {/* Даты */}
      <div className="h2 mt-l">Ключевые даты</div>
      <div className="col gap-s mt-s">
        {MILESTONES.filter((m) => m.date >= today).map((m) => (
          <div key={m.date} className="card row" style={{ alignItems: "flex-start" }}>
            <div className="date-badge">{fmtDate(m.date).replace(" ", "\n")}</div>
            <div className="grow">
              <div className="h3" style={{ fontSize: 15 }}>{m.title}</div>
              <div className="muted small">{m.note}</div>
              {m.approx && <span className="chip gold mt-s" style={{ fontSize: 11 }}>ориентир — дата не утверждена</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Изменения */}
      <div className="h2 mt-l">Что изменилось в 2027 году</div>
      <div className="card col gap-s mt-s">
        {subjects.map((s) => (
          <div key={s.id}>
            <div className="h3" style={{ fontSize: 15 }}>{s.emoji} {s.title}</div>
            <div className="small">{CHANGES[s.id]}</div>
          </div>
        ))}
        <div className="muted small">По проектам демоверсий ФИПИ от 26 августа 2026 года. Итоговые версии ФИПИ публикует осенью — сверяйся с fipi.ru.</div>
      </div>

      {/* Материалы */}
      <div className="h2 mt-l">Свежие материалы</div>
      <div className="col mt-s">
        {MATERIALS.map((m) => (
          <button key={m.url} className="card tap link-card" onClick={() => openLink(m.url)}>
            <span className="link-emoji">{m.emoji}</span>
            <span className="grow">
              <span className="h3" style={{ display: "block", fontSize: 15 }}>{m.title}</span>
              <span className="muted small">{m.text}</span>
            </span>
            <ExternalLink size={18} color="var(--muted)" />
          </button>
        ))}
      </div>
      <div className="muted small mt">Данные актуальны на октябрь 2026 года. Расписание ОГЭ-2027 ещё не утверждено: даты экзаменов здесь — ориентиры по 2026 году.</div>
    </div>
  );
}
