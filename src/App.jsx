/* Навигация: четыре вкладки внизу и стек экранов поверх них */
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Map as MapIcon, Zap, FileText, User, ChevronLeft } from "lucide-react";
import { ProgressProvider, useProgress } from "./lib/progress.jsx";
import { PremiumProvider } from "./lib/premium.jsx";
import { setBackButton, haptic, inTelegram } from "./lib/telegram.js";
import { topicById } from "./data/oge.js";
import { WARMUPS, blitzTask } from "./data/warmup.js";
import { Toasts } from "./components/Toasts.jsx";
import { Home } from "./screens/Home.jsx";
import { Topic } from "./screens/Topic.jsx";
import { Practice } from "./screens/Practice.jsx";
import { Warmup } from "./screens/Warmup.jsx";
import { Variants } from "./screens/Variants.jsx";
import { VariantRun } from "./screens/VariantRun.jsx";
import { Part2Task } from "./screens/Part2Task.jsx";
import { Paywall } from "./screens/Paywall.jsx";
import { Profile } from "./screens/Profile.jsx";
import { Onboarding } from "./screens/Onboarding.jsx";

const TABS = [
  { id: "home", label: "Путь", Icon: MapIcon },
  { id: "warmup", label: "Разминка", Icon: Zap },
  { id: "variants", label: "Варианты", Icon: FileText },
  { id: "profile", label: "Профиль", Icon: User },
];

function Shell() {
  const { state } = useProgress();
  const [tab, setTab] = useState("home");
  const [stack, setStack] = useState([]);

  const go = useCallback((name, params = {}) => {
    if (TABS.some((t) => t.id === name)) { setStack([]); setTab(name); return; }
    setStack((s) => [...s, { name, params, key: Math.random() }]);
  }, []);
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);

  useEffect(() => setBackButton(stack.length ? back : null), [stack.length, back]);
  useEffect(() => { window.scrollTo(0, 0); }, [tab, stack.length]);

  if (!state.profile) return <Onboarding onDone={() => setTab("home")} />;

  const top = stack[stack.length - 1];
  let screen;
  if (top) {
    const { name, params } = top;
    if (name === "topic") screen = <Topic id={params.id} go={go} />;
    else if (name === "practice") {
      const t = topicById(params.id);
      screen = <Practice title={`№${t.num} · ${t.title}`} gen={t.gen} topicId={t.id} onExit={back} />;
    } else if (name === "drill") {
      const w = WARMUPS.find((x) => x.id === params.id);
      screen = <Practice title={w.title} gen={w.gen} warmId={w.id} onExit={back} />;
    } else if (name === "blitz") screen = <Practice title="Блиц" gen={blitzTask} warmId="blitz" blitz count={999} onExit={back} />;
    else if (name === "variant") screen = <VariantRun onExit={back} />;
    else if (name === "part2") screen = <Part2Task id={params.id} onExit={back} />;
    else if (name === "paywall") screen = <Paywall onExit={back} />;
    else if (name === "onboarding") screen = <Onboarding onDone={back} />;
  } else {
    screen = tab === "home" ? <Home go={go} />
      : tab === "warmup" ? <Warmup go={go} />
      : tab === "variants" ? <Variants go={go} />
      : <Profile go={go} />;
  }

  return (
    <div className="app">
      <AnimatePresence mode="wait">
        <motion.div key={top ? top.key : tab} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {/* Вне Telegram нет системной кнопки «Назад» — показываем свою */}
          {top && !inTelegram && ["topic", "paywall", "part2", "onboarding"].includes(top.name) && (
            <button className="chip" style={{ margin: "12px 16px 0" }} onClick={back}><ChevronLeft size={16} /> Назад</button>
          )}
          {screen}
        </motion.div>
      </AnimatePresence>

      {!top && (
        <nav className="tabs">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} className={`tab ${tab === id ? "on" : ""}`} onClick={() => { haptic.select(); setTab(id); }}>
              {tab === id && <motion.span layoutId="tab-dot" className="tab-dot" transition={{ type: "spring", stiffness: 500, damping: 35 }} />}
              <Icon size={22} strokeWidth={2.4} />
              {label}
            </button>
          ))}
        </nav>
      )}
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <ProgressProvider>
      <PremiumProvider>
        <Shell />
      </PremiumProvider>
    </ProgressProvider>
  );
}
