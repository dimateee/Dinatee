/* Подписка 150 ₽ в месяц: карта или СБП через ЮKassa, либо Telegram Stars */
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Crown, CreditCard, Star, RefreshCw } from "lucide-react";
import { usePremium } from "../lib/premium.jsx";
import { api } from "../lib/api.js";
import { tg, openLink, haptic } from "../lib/telegram.js";
import { celebrate } from "../lib/confetti.js";
import { Mascot } from "../components/Mascot.jsx";

const PERKS = [
  ["🗺️", "Все 15 тем первой части", "с теорией, разборами и бесконечной тренировкой"],
  ["📝", "Безлимитные пробные варианты", "с таймером и оценкой по шкале ФИПИ"],
  ["🧠", "Вторая часть с решениями", "уравнения, задачи, доказательства и критерии"],
  ["🏆", "Все достижения и рейтинг уровней", "чтобы заниматься было интересно"],
];

const fmtDate = (iso) => new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

export function Paywall({ onExit }) {
  const p = usePremium();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  async function pay(method) {
    setBusy(method); setMsg("");
    haptic.tap();
    try {
      const { url, invoice } = await api.subscribe(method);
      if (method === "stars" && tg?.openInvoice) {
        tg.openInvoice(invoice, async (status) => {
          if (status === "paid") {
            setMsg("Оплата прошла! Включаем подписку…");
            await waitForPremium();
          } else if (status === "failed") setMsg("Платёж не прошёл. Попробуй ещё раз.");
          setBusy("");
        });
        return;
      }
      openLink(url);
      setMsg("Оплати на открывшейся странице и вернись сюда — подписка включится сама. Если нет, нажми «Проверить оплату».");
    } catch (e) {
      setMsg(e.message);
    }
    setBusy("");
  }

  // Вебхук оплаты приходит на сервер за несколько секунд — немного подождём
  async function waitForPremium() {
    for (let i = 0; i < 8; i++) {
      const data = await p.refresh();
      if (data?.premium) { celebrate(2); setMsg("Подписка активна 🎉"); return; }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setMsg("Платёж ещё обрабатывается. Нажми «Проверить оплату» через минуту.");
  }

  if (p.premium) {
    return (
      <div className="screen no-tabs">
        <div className="center mt-l" style={{ fontSize: 80 }}>👑</div>
        <div className="h1 center">Подписка активна</div>
        <div className="muted center mt-s">до {fmtDate(p.until)}</div>
        <div className="mt"><Mascot mood="party" say="Все задания открыты. Вперёд к пятёрке!" /></div>
        <button className="btn mt" onClick={onExit}>К заданиям</button>
      </div>
    );
  }

  const hasCard = p.methods?.includes("yookassa");
  const hasStars = p.methods?.includes("stars");

  return (
    <div className="screen no-tabs">
      <motion.div className="center mt" initial={{ scale: 0.6, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200 }}>
        <div style={{ fontSize: 72 }}>👑</div>
      </motion.div>
      <div className="h1 center">ОГЭ Квест PRO</div>
      <div className="center mt-s">
        <span style={{ fontSize: 40, fontWeight: 900 }}>{p.priceRub} ₽</span>
        <span className="muted"> / месяц</span>
      </div>

      <div className="card col mt">
        {PERKS.map(([e, title, text], i) => (
          <motion.div key={title} className="row" style={{ alignItems: "flex-start" }} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }}>
            <span style={{ fontSize: 26 }}>{e}</span>
            <div><div className="h3">{title}</div><div className="muted small">{text}</div></div>
          </motion.div>
        ))}
        <div className="row small muted"><Check size={16} color="var(--good)" /> Бесплатно навсегда: разминка, 5 тем, 1 вариант</div>
      </div>

      <div className="col mt">
        {hasCard && (
          <button className="btn gold" disabled={Boolean(busy)} onClick={() => pay("yookassa")}>
            <CreditCard size={20} /> {busy === "yookassa" ? "Открываем оплату…" : `Карта или СБП · ${p.priceRub} ₽`}
          </button>
        )}
        {hasStars && (
          <button className="btn" disabled={Boolean(busy)} onClick={() => pay("stars")}>
            <Star size={20} fill="currentColor" /> {busy === "stars" ? "Открываем…" : `Telegram Stars · ${p.priceStars} ⭐`}
          </button>
        )}
        {!hasCard && !hasStars && (
          <div className="card small muted">{p.loading ? "Загружаем способы оплаты…" : p.error ? `Не удалось связаться с сервером: ${p.error}` : "Оплата ещё не настроена владельцем приложения."}</div>
        )}
        <button className="btn ghost" onClick={async () => { setMsg("Проверяем…"); const d = await p.refresh(); setMsg(d?.premium ? "Подписка активна 🎉" : "Оплата пока не найдена. Если ты только что оплатил — подожди минуту."); if (d?.premium) celebrate(2); }}>
          <RefreshCw size={18} /> Проверить оплату
        </button>
      </div>
      {msg && <div className="card mt small">{msg}</div>}
      <div className="muted small mt center">Подписка на 30 дней. Оплата картой или по СБП не продлевается автоматически — продлишь, когда захочешь. Оплата звёздами продлевается каждые 30 дней, отменить можно в настройках Telegram.</div>
    </div>
  );
}
