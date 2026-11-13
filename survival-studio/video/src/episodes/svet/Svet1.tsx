import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Karaoke, Word } from "../../captions/Karaoke";
import data from "../../captions/svet1.words.json";
import { Grain } from "../../ui/Grain";
import { useFonts } from "../../useFonts";
import { SRYV } from "../../style/palette";
import { Cam, CityBlackout, DoorClose, lerpCam, PhoneUI, Tower, TowerState, WindowView } from "../../scenes/Svet";

/*
 * «Оно идёт на свет». Серия 1 «03:07» — по раскадровке владельца (episodes/svet-1/storyboard.md).
 * Время — по словам голоса (n-е вхождение), чтобы перезапись не ломала монтаж.
 */
export const FPS = 30;
const WORDS = (data as { words: Word[] }).words;
const VOICE_END = WORDS[WORDS.length - 1].end, TAIL = 1.6;
export const SVET1_FRAMES = Math.round((VOICE_END + TAIL) * FPS);
const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9-]/g, "");
const idxOf = (w: string, n = 1) => {
  let k = 0;
  for (let i = 0; i < WORDS.length; i++) if (norm(WORDS[i].word) === norm(w) && ++k === n) return i;
  throw new Error(`Слово «${w}» #${n} не найдено`);
};
const W = (w: string, n = 1) => WORDS[idxOf(w, n)].start;
const CW = (() => {
  const out = WORDS.map((w) => ({ ...w }));
  const i = idxOf("три", 2); out[i] = { ...out[i], word: "03:07.", end: out[i + 2].end }; out.splice(i + 1, 2);
  const j = out.findIndex((x) => norm(x.word) === "пятьдесят"); out[j] = { ...out[j], word: "54%", end: out[j + 2].end }; out.splice(j + 1, 2);
  return out;
})();
const accIdx = (w: string, n = 1) => { let k = 0; for (let i = 0; i < CW.length; i++) if (norm(CW[i].word) === norm(w) && ++k === n) return i; return -1; };
const ACC: [string, number, "yellow" | "red"][] = [
  ["включай.", 2, "red"], ["свет».", 4, "red"], ["свеча.", 1, "yellow"], ["само.", 1, "red"], ["издалека.", 1, "yellow"],
  ["свет.", 5, "yellow"], ["больше.", 1, "yellow"], ["дверью.", 2, "red"], ["закрылись».", 1, "yellow"], ["ребёнок.", 1, "red"],
  ["пожалуйста».", 1, "red"], ["врёт.", 1, "red"], ["её.", 3, "red"], ["впускать»?", 1, "red"],
];
const ACCENTS = Object.fromEntries(ACC.map(([w, n, c]) => [accIdx(w, n), c]).filter(([i]) => (i as number) >= 0)) as Record<number, "yellow" | "red">;
const ramp = (t: number, a: number, len = 0.35) => Math.min(1, Math.max(0, (t - a) / len));

/* ---------- Ключевые моменты ---------- */
const tCity = W("три", 2), tOff = W("гаснет", 1), tBuzz = W("вибрирует", 1), tYou = W("у"), tTorchItem = W("фонарик", 1), tPhoneItem = W("пятьдесят"),
  tCandle = W("свеча."), tOpp = W("доме"), tOn = W("включает"), tOffWin = W("гаснет", 2), tR1 = W("правило", 1), tZero = W("ноль", 2),
  tTurn = W("экран", 1), tR2 = W("правило", 2), tCurt = W("шторы"), tGap = W("щель"), tTowel = W("полотенцем."), tR3 = W("правило", 3),
  tTorch = W("фонарик", 3), tMin = W("минуту", 2), tStairs = W("лестнице"), tUp = W("поднимается."), t3 = W("третий"),
  t4 = W("четвёртый."), tStop = W("замирают"), tDoor = W("дверью.", 2), tBuzz2 = W("вибрирует", 2), tCry = W("сквозь"), tKnock = W("стук"),
  tThree = W("три", 3), tWhisper = W("шёпот,"), tJack = W("джек", 2), tHide = W("уходит"), tLie = W("кто-то", 3), tChoice = W("что", 3);

/* ---------- Сцены по времени ---------- */
type Scene = "hook" | "city" | "room" | "window" | "bright" | "curtains" | "towel" | "torch" | "stairs" | "chat" | "cry" | "door" | "hide" | "split" | "choice";
const SCENES: [number, Scene][] = [
  [0, "hook"], [tCity - 0.2, "city"], [tYou - 0.2, "room"], [tOpp - 0.2, "window"], [tR1 - 0.2, "bright"], [tR2 - 0.2, "curtains"], [tGap - 0.2, "towel"],
  [tR3 - 0.2, "torch"], [tStairs - 0.3, "stairs"], [tBuzz2 - 0.3, "chat"], [tCry - 0.2, "cry"], [tKnock - 0.2, "door"], [tJack - 0.2, "hide"],
  [tLie - 0.1, "split"], [tChoice - 0.2, "choice"],
];
const sceneAt = (t: number) => { let cur: Scene = "hook", start = 0; for (const [a, s] of SCENES) if (t >= a) { cur = s; start = a; } return { s: cur, f: t - start }; };

/* Часы, заряд, батарейки фонарика. */
const clockAt = (t: number) => {
  const m = Math.round(interpolate(t, [tYou, tR1, tStairs, tBuzz2, tKnock, VOICE_END + TAIL], [7, 12, 37, 38, 40, 41], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return `03:${String(m).padStart(2, "0")}`;
};
const phoneAt = (t: number) => (t < tZero + 0.5 ? 54 : t < tBuzz2 ? 53 : 52);
const cellAt = (t: number) => 1 - 0.25 * ramp(t, tTorch, tR3 + 6 - tTorch);

/* ---------- Камеры дома в разрезе ---------- */
const ROOM: Cam = { x: 420, y: 140, z: 1.45 }, DOOR5: Cam = { x: 740, y: 170, z: 1.5 }, WHOLE: Cam = { x: 660, y: 700, z: 0.66 };
const towerCam = (s: Scene, t: number): Cam => {
  if (s === "stairs") {
    const a = lerpCam(ROOM, WHOLE, (t - tStairs + 0.3) / 1.4);
    return lerpCam(a, { x: 860, y: 160, z: 1.45 }, (t - tStop) / 1.3);
  }
  if (s === "cry") return lerpCam(ROOM, { x: 420, y: 430, z: 1.45 }, (t - tCry) / 1.2);
  if (s === "towel") return DOOR5;
  if (s === "hide") return { x: 450, y: 150, z: 1.45 };
  return ROOM;
};
const towerState = (s: Scene, t: number): TowerState => ({
  curtains: t >= tCurt ? 1 : 0, towel: ramp(t, tTowel - 0.4, 0.6), torch: s === "torch" && t >= tTorch ? 1 : 0, dim: t >= tZero ? 0.1 : 1,
  lunaGrowl: s === "room" ? 1 : 0, steps: s === "stairs" ? (t < tUp ? 0 : t < t3 ? interpolate(t, [tUp, t3], [1, 3]) : t < t4 ? interpolate(t, [t3, t4], [3, 4]) : t < tStop ? interpolate(t, [t4, tStop], [4, 5]) : 5) : 0,
  feet: t >= tDoor - 0.3 ? 1 : 0, childCry: s === "cry" ? 1 : 0, dogHide: s === "hide" ? ramp(t, tHide, 1.0) : t >= tHide ? 1 : 0,
  heroPose: s === "towel" ? "kneel" : s === "torch" ? "torch" : s === "stairs" && t >= tStop ? "freeze" : s === "hide" ? "freeze" : "phone",
});

const Big: React.FC<{ c?: string; s?: number; children: React.ReactNode }> = ({ c = "#FFFFFF", s = 56, children }) => (
  <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: s, lineHeight: 1.05, color: c, textAlign: "center" }}>{children}</div>
);
const Item: React.FC<{ label: string; k: number; hi: number; children: React.ReactNode }> = ({ label, k, hi, children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 14, background: "rgba(10,12,18,0.85)",
    border: `3px solid ${hi > 0 ? "#E8C547" : "#2B3241"}`, boxShadow: hi > 0 ? "0 0 24px #E8C54788" : "none", opacity: 0.35 + 0.65 * k, transform: `scale(${1 + 0.12 * hi})` }}>
    {children}<div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 34, color: "#FFFFFF" }}>{label}</div>
  </div>
);

export const Svet1: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  useFonts();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { s } = sceneAt(t);
  const win = (a: number, b: number, len = 0.3) => Math.min(ramp(t, a, len), 1 - ramp(t, b - len, len));
  const cells = [cellAt(t), 1, 1];
  const showHud = s !== "hook" && s !== "choice" && s !== "split";
  const hudTime = clockAt(t);
  const tower = ["room", "towel", "torch", "stairs", "cry", "hide"].includes(s);
  return (
    <AbsoluteFill style={{ backgroundColor: "#03040A" }}>
      {/* 1. Хук: чёрный экран, светится только телефон */}
      {s === "hook" && (<>
        <div style={{ position: "absolute", left: 140, top: 230, width: 800, height: 1200, borderRadius: 400, background: "radial-gradient(closest-side, rgba(229,57,53,.22), rgba(0,0,0,0))" }} />
        <PhoneUI mode="alert" k={ramp(t, 0, 0.4)} battery={54} time="03:07" shake={t >= 2.2 && t < 3 ? 1 : 0} />
      </>)}
      {/* 2. Город гаснет */}
      {s === "city" && (<>
        <CityBlackout frame={frame} off={interpolate(t, [tOff, tOff + 2.4], [0, 1.1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} zoom={1 + 0.04 * (t - tCity)} />
        <PhoneUI mode="alert" k={ramp(t, tBuzz, 0.4)} battery={54} time="03:07" shake={t < tBuzz + 1 ? 1 : 0} />
      </>)}
      {tower && <Tower frame={frame} cam={towerCam(s, t)} st={towerState(s, t)} />}
      {/* 4. Окно напротив; 6. шторы */}
      {s === "window" && <WindowView frame={frame} flash={t >= tOn && t < tOffWin ? Math.min(1, (t - tOn) / 0.3) : 0} zoom={1 + 0.03 * (t - tOpp)} />}
      {s === "curtains" && <WindowView frame={frame} curtains={ramp(t, tCurt, 1.2)} />}
      {/* 5. Правило 1: яркость в ноль, экран к себе */}
      {s === "bright" && <PhoneUI mode="brightness" k={1} battery={phoneAt(t)} time={hudTime}
        bright={interpolate(t, [W("яркость"), tZero + 0.4], [1, 0.02], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} turn={ramp(t, tTurn, 0.6)} />}
      {/* 7. Таймер 1:00 */}
      {s === "torch" && t >= tMin && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 260, display: "flex", justifyContent: "center", opacity: ramp(t, tMin, 0.3) }}>
          <div style={{ padding: "12px 36px", borderRadius: 18, background: "rgba(10,12,18,0.9)", border: "5px solid #E8C547", fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 96, color: "#FFFFFF" }}>
            {`0:${String(Math.max(0, 60 - Math.floor((t - tMin) * 4))).padStart(2, "0")}`.replace("0:60", "1:00")}
          </div>
        </div>
      )}
      {/* 8. Шаги: номера этажей крупно */}
      {s === "stairs" && t >= t3 - 0.2 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 260, display: "flex", justifyContent: "center", gap: 30 }}>
          {[3, 4, 5].map((n, i) => {
            const at = [t3, t4, tStop][i];
            const k = ramp(t, at, 0.2);
            return <div key={n} style={{ width: 120, height: 120, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.25 + 0.75 * k,
              background: n === 5 && k > 0 ? "rgba(229,57,53,.25)" : "rgba(10,12,18,.85)", border: `5px solid ${n === 5 && k > 0 ? SRYV.fail : "#E8C547"}`,
              fontFamily: "Inter Display", fontWeight: 900, fontSize: 80, color: "#FFFFFF" }}>{n}</div>;
          })}
        </div>
      )}
      {/* 9. Чат Лены */}
      {s === "chat" && (<>
        <div style={{ position: "absolute", inset: 0, background: "#050608" }} />
        <PhoneUI mode="neighbor" k={ramp(t, tBuzz2 - 0.3, 0.4)} battery={52} time={hudTime} shake={t < tBuzz2 + 0.8 ? 1 : 0} bright={0.6}
          lines={[["Слышу шаги.", W("слышу")], ["Они прошли мимо меня и встали у твоей двери.", W("они")], ["Не открывай никому. Что бы ни говорили.", W("открывай")],
            ["Я с ребёнком, мы закрылись.", W("ребёнком,")]].filter(([, a]) => t >= (a as number) - 0.1).map(([l]) => l as string)} />
      </>)}
      {/* 11. Стук: дверь крупно, цепочка, шёпот */}
      {(s === "door" || s === "choice") && <DoorClose frame={frame} knock={t >= tKnock && t < tThree + 1.6 ? 1 : 0} chain={t >= tKnock && t < tWhisper + 6 ? 1 : 0.3} zoom={s === "choice" ? 1.05 : 1 + 0.03 * (t - tKnock)} />}
      {s === "door" && t >= tWhisper && (
        <div style={{ position: "absolute", left: 90, right: 90, top: 300, display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
          {[["«Это Лена.", W("это")], ["Не верь сообщению — мой телефон сел ещё вечером.", W("верь")], ["Дверь захлопнулась, ребёнок там один.", W("захлопнулась,")],
            ["Слышишь, как плачет? Впусти, пожалуйста»", W("слышишь,")]].map(([l, a], i) => (
            <div key={i} style={{ display: i < 3 && t >= ([W("верь"), W("захлопнулась,"), W("слышишь,")][i]) + 0.2 ? "none" : "block", opacity: 0.85 * ramp(t, a as number, 0.5), fontFamily: "Caveat", fontWeight: 700, fontSize: 64, lineHeight: 1.05, color: "#C9D2E0", fontStyle: "italic",
              textAlign: "center", textShadow: "0 0 18px rgba(0,0,0,.9)" }}>{l}</div>
          ))}
        </div>
      )}
      {/* 12. Кто-то врёт: экран делится — слева чат, справа дверь */}
      {s === "split" && (<>
        <div style={{ position: "absolute", left: 0, top: 0, width: 540, height: 1920, overflow: "hidden", background: "#050608" }}>
          <div style={{ position: "absolute", left: -260, top: 0, width: 1080, height: 1920, transform: "scale(0.9)", transformOrigin: "50% 40%" }}>
            <PhoneUI mode="neighbor" k={1} battery={52} time={hudTime} bright={0.6} lines={["Слышу шаги.", "Они встали у твоей двери.", "Не открывай никому."]} />
          </div>
        </div>
        <div style={{ position: "absolute", left: 540, top: 0, width: 540, height: 1920, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: -270, top: 0, width: 1080, height: 1920 }}><DoorClose frame={frame} chain={0.4} /></div>
        </div>
        <div style={{ position: "absolute", left: 536, top: 0, width: 8, height: 1920, background: SRYV.fail, opacity: 0.8 }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 230, display: "flex", justifyContent: "center", opacity: ramp(t, W("сообщение"), 0.3) }}>
          <div style={{ padding: "10px 26px", borderRadius: 14, background: "rgba(10,12,18,.9)", border: `4px solid ${SRYV.fail}`, fontFamily: "Inter Display", fontWeight: 900, fontSize: 46, color: "#FFFFFF" }}>КТО-ТО ВРЁТ</div>
        </div>
      </>)}
      {/* 13. Выбор */}
      {s === "choice" && (<>
        <div style={{ position: "absolute", inset: 0, background: "rgba(3,4,8,0.55)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 300, display: "flex", flexDirection: "column", alignItems: "center", gap: 34 }}>
          <Big s={58}>ДВЕРЬ</Big>
          <div style={{ display: "flex", gap: 26 }}>
            {([["ВПУСТИТЬ", SRYV.lamp], ["НЕ ВПУСКАТЬ", SRYV.fail]] as const).map(([txt, c], i) => {
              const k = ramp(t, W(i === 0 ? "«впустить»" : "впускать»?") - 0.3, 0.3);
              return <div key={txt} style={{ transform: `scale(${0.85 + 0.15 * k})`, opacity: 0.4 + 0.6 * k, padding: "24px 30px", borderRadius: 22,
                border: `6px solid ${c}`, background: `${c}22`, boxShadow: `0 0 30px ${c}66`, fontFamily: "Inter Display", fontWeight: 900, fontSize: 52, color: "#FFFFFF" }}>{txt}</div>;
            })}
          </div>
          <div style={{ opacity: ramp(t, W("пиши."), 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 38, color: "#E8C547" }}>ПИШИ В КОММЕНТАРИЯХ ↓</div>
          <div style={{ opacity: ramp(t, W("следующая"), 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 32, color: "#C9D2E0" }}>СЕРИЯ 2 — С ВАШЕГО ОТВЕТА</div>
        </div>
      </>)}
      {/* HUD: время и ресурсы */}
      {showHud && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 70, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 72, lineHeight: 1, color: "#FF6B5E", textShadow: "0 0 20px rgba(229,57,53,.6)" }}>{hudTime}</div>
          <div style={{ display: "flex", gap: 12, opacity: ramp(t, tYou, 0.4) }}>
            <Item label="" k={1} hi={win(tTorchItem, tPhoneItem)}>
              <div style={{ display: "flex", gap: 6 }}>{cells.map((c, i) => (
                <div key={i} style={{ width: 22, height: 40, borderRadius: 5, border: "3px solid #E8C547", display: "flex", alignItems: "flex-end" }}>
                  <div style={{ width: "100%", height: `${Math.round(100 * c)}%`, background: "#E8C547" }} /></div>))}</div>
            </Item>
            <Item label={`${phoneAt(t)}%`} k={1} hi={win(tPhoneItem, tCandle)}><div style={{ width: 24, height: 40, borderRadius: 6, border: "3px solid #C9D2E0" }} /></Item>
            <Item label="×1" k={1} hi={win(tCandle, tOpp)}><div style={{ width: 12, height: 34, borderRadius: 3, background: "#EDE6D6", position: "relative" }}>
              <div style={{ position: "absolute", left: 1, top: -14, width: 10, height: 14, borderRadius: "50% 50% 40% 40%", background: "#3A4560" }} /></div></Item>
          </div>
        </div>
      )}
      <Karaoke words={CW} accents={ACCENTS} pendingColor="#C3C8D2" />
      <Grain />
      {withAudio && <Audio src={staticFile("audio/svet1_mix.wav")} />}
    </AbsoluteFill>
  );
};
