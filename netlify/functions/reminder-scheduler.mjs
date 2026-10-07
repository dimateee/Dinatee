import { getStore } from "@netlify/blobs";

// Хук для тестов — позволяет подменить реальный Netlify Blobs на фейковый стор
// в памяти (тот же приём, что и в netlify/lib/promo-store.mjs).
const remStore = () => globalThis.__ritmReminderStore || getStore("ritm-reminders");

const env = (key) => globalThis.Netlify?.env?.get(key) ?? process.env[key];
const botToken = () => String(env("BOT_TOKEN") || "").trim().replace(/^["']+|["']+$/g, "").replace(/^bot(?=\d)/i, "");
const api = (method) => `https://api.telegram.org/bot${botToken()}/${method}`;

function partsInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", weekday:"short", hour12:false
  }).formatToParts(date);
  const out = Object.fromEntries(parts.filter(p => p.type !== "literal").map(p => [p.type, p.value]));
  return { year:Number(out.year), month:Number(out.month), day:Number(out.day), hour:Number(out.hour), minute:Number(out.minute), weekday:out.weekday };
}
const wd = { Mon:0, Tue:1, Wed:2, Thu:3, Fri:4, Sat:5, Sun:6 };
const keyOf = (p) => `${p.year}-${String(p.month).padStart(2,"0")}-${String(p.day).padStart(2,"0")}`;

function occurs(task, p) {
  const r = task?.repeat || { type:"daily" };
  if (r.type === "once") return r.date === keyOf(p);
  if (r.type === "daily") return true;
  if (r.type === "weekly") return Array.isArray(r.days) && r.days.includes(wd[p.weekday]);
  if (r.type === "monthly") return p.day === Number(r.day);
  if (r.type === "yearly") return p.month - 1 === Number(r.month) && p.day === Number(r.day);
  if (r.type === "interval") {
    const start = new Date(`${r.start || keyOf(p)}T00:00:00Z`);
    const cur = new Date(`${keyOf(p)}T00:00:00Z`);
    const diff = Math.floor((cur-start)/86400000);
    return diff >= 0 && diff % Math.max(1, Number(r.every)||1) === 0;
  }
  return false;
}

function due(task, p) { return !!task?.time && task.time === `${String(p.hour).padStart(2,"0")}:${String(p.minute).padStart(2,"0")}`; }

async function send(chatId, text) {
  if (!botToken()) return false;
  const r = await fetch(api("sendMessage"), { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ chat_id:chatId, text }) });
  return r.ok;
}

// Netlify иногда запускает scheduled-функцию на одну и ту же минуту больше одного раза
// (повторная попытка при медленном ответе, пересечение границы тика и т.п.) — именно
// это и приводило к двойным сообщениям: раньше отметка «уже отправлено» читалась и
// писалась одним куском в конце цикла по пользователю, и два параллельных запуска
// успевали оба пройти проверку «ещё не отправлено» до того, как кто-то из них это
// записал. Теперь вместо чтения/изменения/записи одного общего объекта используем
// отдельный ключ-замок на каждое письмо с условной записью `onlyIfNew` — это атомарная
// операция на стороне Netlify Blobs: кто первый создал ключ, тот и отправляет, второй
// увидит `modified:false` и тихо пропустит отправку, даже если оба процесса работают
// одновременно.
async function claim(store, key) {
  try {
    const r = await store.set(key, "1", { onlyIfNew: true });
    return !!r?.modified;
  } catch (e) {
    return false; // при сбое лучше пропустить отправку, чем рискнуть дублем
  }
}

// Раз в сутки подчищаем вчерашние и более старые замки, чтобы список ключей в сторе
// не рос бесконечно. Делаем это не в каждом тике, а один раз в день в фиксированную
// минуту — list+delete заметно дороже одной условной записи.
async function cleanupOldLocks(store, today) {
  const { blobs = [] } = await store.list({ prefix: "lock:" }).catch(() => ({ blobs: [] }));
  await Promise.all(
    blobs
      .filter((b) => {
        const date = b.key.slice("lock:".length, "lock:".length + 10);
        return date && date !== today && date < today;
      })
      .map((b) => store.delete(b.key).catch(() => {}))
  );
}

export default async () => {
  const store = remStore();
  const { blobs = [] } = await store.list();
  const now = new Date();
  const todayUtc = keyOf(partsInZone(now, "UTC"));
  let sent = 0;
  for (const item of blobs) {
    if (!item.key.startsWith("user:")) continue;
    const raw = await store.get(item.key, { type:"json" }).catch(() => null);
    if (!raw?.userId) continue;
    const p = partsInZone(now, raw.timezone || "Europe/Moscow");
    const cfg = { enabled:true, plan:true, training:true, tasks:true, planTime:"08:00", trainingTime:"18:00", ...(raw.reminders || {}) };
    if (!cfg.enabled) continue;
    const today = keyOf(p);
    const lockPrefix = `lock:${today}:${raw.userId}:${p.hour}:${p.minute}`;
    const sendOnce = async (kind, text) => {
      if (!(await claim(store, `${lockPrefix}:${kind}`))) return;
      if (await send(raw.chatId, text)) sent++;
    };

    if (cfg.plan && cfg.planTime === `${String(p.hour).padStart(2,"0")}:${String(p.minute).padStart(2,"0")}`) {
      const tasks = (raw.tasks || []).filter(t => occurs(t,p) && !t.done);
      const training = raw.trainingByDay?.[String(wd[p.weekday])] || "";
      await sendOnce("plan", `🌅 RITM · План на день\n\nЗадач сегодня: ${tasks.length}.\n${training ? `🏋️ Сегодня: ${training}` : "Сегодня тренировки по плану нет."}\n\nОткрой RITM и начни с главного.`);
    }

    if (cfg.training && cfg.trainingTime === `${String(p.hour).padStart(2,"0")}:${String(p.minute).padStart(2,"0")}`) {
      const training = raw.trainingByDay?.[String(wd[p.weekday])] || "";
      if (training) await sendOnce("training", `🏋️ RITM · Время тренировки\n\nСегодня по плану: ${training}.\n\nГотов начать?`);
    }

    if (cfg.tasks) {
      for (const t of (raw.tasks || [])) {
        if (!occurs(t,p) || !due(t,p)) continue;
        if (t.done && (t.repeat?.type === "once" || !t.repeat)) continue;
        await sendOnce(`task:${t.id}`, `⏰ RITM · Задача\n\n${t.text || "Пора выполнить задачу."}`);
      }
    }
  }

  // Фиксированное окно в начале суток по UTC — не зависит от часовых поясов пользователей.
  if (now.getUTCHours() === 3 && now.getUTCMinutes() === 0) await cleanupOldLocks(store, todayUtc);

  return new Response(`ok ${sent}`, { status:200 });
};

export const config = { schedule: "* * * * *" };
