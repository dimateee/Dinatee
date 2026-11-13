import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Karaoke, Word } from "../../captions/Karaoke";
import data from "../../captions/svet1.words.json";
import { Grain } from "../../ui/Grain";
import { useFonts } from "../../useFonts";
import { SRYV } from "../../style/palette";
import { CityBlackout, DoorClose, PhoneUI, WindowView } from "../../scenes/Svet";
import { BedHide, ChainHand, DoorBottom, FloorListen, Peephole, PovArm, RoomDark, Supplies, TorchFloor } from "../../scenes/SvetPov";

/*
 * «Оно идёт на свет». Серия 1 «03:07» — текст v2 (без повторов), вид от первого лица (LESSONS Б19–20).
 * Время — по словам голоса (n-е вхождение), чтобы перезапись не ломала монтаж.
 */
export const FPS = 30;
const WORDS = (data as { words: Word[] }).words;
const VOICE_END = WORDS[WORDS.length - 1].end, TAIL = 1.6;
export const SVET1_FRAMES = Math.round((VOICE_END + TAIL) * FPS);
const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9-]/g, "");
const idxIn = (arr: Word[], w: string, n = 1) => {
  let k = 0;
  for (let i = 0; i < arr.length; i++) if (norm(arr[i].word) === norm(w) && ++k === n) return i;
  return -1;
};
const W = (w: string, n = 1) => {
  const i = idxIn(WORDS, w, n);
  if (i < 0) throw new Error(`Слово «${w}» #${n} не найдено`);
  return WORDS[i].start;
};
const CW = (() => {
  const out = WORDS.map((w) => ({ ...w }));
  const i = idxIn(out, "три"); out[i] = { ...out[i], word: "03:07 —", end: out[i + 2].end }; out.splice(i + 1, 2);
  const j = idxIn(out, "пятьдесят"); out[j] = { ...out[j], word: "54%,", end: out[j + 2].end }; out.splice(j + 1, 2);
  return out;
})();
const ACC: [string, number, "yellow" | "red"][] = [
  ["свет».", 2, "red"], ["свеча.", 1, "yellow"], ["само.", 1, "red"], ["груди.", 1, "yellow"], ["полотенцем.", 1, "yellow"],
  ["минуты.", 1, "yellow"], ["площадке.", 1, "red"], ["заперлись».", 1, "yellow"], ["ребёнок.", 1, "red"], ["пожалуйста».", 1, "red"],
  ["кровать.", 1, "yellow"], ["врёт.", 1, "red"], ["светится.", 1, "red"],
];
const ACCENTS = Object.fromEntries(ACC.map(([w, n, c]) => [idxIn(CW, w, n), c]).filter(([i]) => (i as number) >= 0)) as Record<number, "yellow" | "red">;
const ramp = (t: number, a: number, len = 0.35) => Math.min(1, Math.max(0, (t - a) / len));
const sm = (x: number) => x * x * (3 - 2 * x);

/* ---------- Ключевые моменты ---------- */
const tOff = W("гаснет"), t5 = W("пятый"), tJack = W("джек"), tTorchItem = W("фонарик"), tPhoneItem = W("телефон,"), tCandle = W("свеча."),
  tOpp = W("в", 2), tLit = W("загорается"), tDark = W("гаснет.", 2), tRules = W("значит,"), tBright = W("яркость"), tZero = W("ноль,", 2),
  tChest = W("прижать"), tR2 = W("второе:"), tCurt = W("шторы"), tGap = W("щель"), tTowel = W("заткнуть"), tR3 = W("третье:"),
  tTorch = W("фонарик", 2), tPalm = W("стекло"), tDown = W("внизу"), tBang = W("хлопает"), t3 = W("третий."), t4 = W("четвёртый."),
  tQuiet = W("тишина"), tLanding = W("площадке."), tBuzz = W("вибрация."), tThey = W("они"), tDont = W("не", 3), tWe = W("мы"),
  tBelow = W("а"), tCry = W("плачет"), tKnock = W("три", 2), tWhisper = W("шёпот:"), tOpen = W("открой,"), tJack2 = W("джек", 2),
  tBack = W("пятится"), tMsg = W("сообщение", 2), tChoice = W("что", 2), tGlow = W("экран", 2), tWrite = W("пиши."), tNext = W("следующая");

/* ---------- Сцены ---------- */
type Scene = "hook" | "supplies" | "window" | "bright" | "curtains" | "towel" | "torch" | "stairs" | "peep" | "chat" | "floor" | "door" | "bed" | "split" | "choice";
const SCENES: [number, Scene][] = [
  [0, "hook"], [t5 - 0.1, "supplies"], [tOpp - 0.1, "window"], [tRules - 0.1, "bright"], [tR2 - 0.05, "curtains"], [tGap - 0.1, "towel"],
  [tR3 - 0.05, "torch"], [tDown - 0.1, "stairs"], [tQuiet - 0.05, "peep"], [tBuzz - 0.05, "chat"], [tBelow - 0.05, "floor"], [tKnock - 0.05, "door"],
  [tJack2 - 0.05, "bed"], [tMsg - 0.05, "split"], [tChoice - 0.05, "choice"],
];
const sceneAt = (t: number) => { let cur: Scene = "hook", start = 0; for (const [a, s] of SCENES) if (t >= a) { cur = s; start = a; } return { s: cur, f: t - start }; };

const clockAt = (t: number) => `03:${String(Math.round(interpolate(t, [t5, tRules, tDown, tBuzz, tKnock, VOICE_END + TAIL], [8, 12, 37, 38, 40, 41], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))).padStart(2, "0")}`;
const phoneAt = (t: number) => (t < tChest + 0.5 ? 54 : t < tBuzz ? 53 : 52);

/* Телефон в двух руках: руки сзади, большие пальцы — поверх корпуса. */
const PHONE_SCALE = 0.78;
const PhoneInHands: React.FC<{ children: React.ReactNode; light: number; dy?: number; shake?: number; frame: number; leftOnly?: boolean }> = ({ children, light, dy = 0, shake = 0, frame, leftOnly }) => {
  const sx = shake * 7 * Math.sin(frame * 2.9);
  return (
    <div style={{ position: "absolute", inset: 0, transform: `translate(${sx}px, ${dy}px)` }}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <PovArm x={360} y={1150} angle={14} side="L" pose="grip" light={light} part="back" />
        {!leftOnly && <PovArm x={720} y={1150} angle={-14} side="R" pose="grip" light={light} part="back" />}
      </svg>
      {children}
      <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <PovArm x={360} y={1150} angle={14} side="L" pose="grip" light={light} part="thumb" />
        {!leftOnly && <PovArm x={720} y={1150} angle={-14} side="R" pose="grip" light={light} part="thumb" />}
      </svg>
    </div>
  );
};
/* Кончик указательного пальца правой руки (поза point) → где должно быть запястье. */
const pointWrist = (tipX: number, tipY: number, angle: number, s = 1) => {
  const a = (angle * Math.PI) / 180, lx = -50 * s, ly = -300 * s;
  return { x: tipX - (lx * Math.cos(a) - ly * Math.sin(a)), y: tipY - (lx * Math.sin(a) + ly * Math.cos(a)) };
};

const Item: React.FC<{ label: string; hi: number; children: React.ReactNode }> = ({ label, hi, children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 14, background: "rgba(10,12,18,0.85)",
    border: `3px solid ${hi > 0 ? "#E8C547" : "#2B3241"}`, boxShadow: hi > 0 ? "0 0 24px #E8C54788" : "none", transform: `scale(${1 + 0.12 * hi})` }}>
    {children}{label && <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 34, color: "#FFFFFF" }}>{label}</div>}
  </div>
);
const Layer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>{children}</svg>
);

export const Svet1: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  useFonts();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { s, f } = sceneAt(t);
  const win = (a: number, b: number, len = 0.3) => Math.min(ramp(t, a, len), 1 - ramp(t, b - len, len));
  const hudTime = clockAt(t);
  const cell1 = 1 - 0.25 * ramp(t, tTorch, tDown - tTorch);
  /* ручная камера: лёгкое покачивание, замирает на шагах; хлопок двери подъезда — толчок */
  const calm = s === "stairs" || s === "peep" ? 0.25 : 1;
  const bang = s === "stairs" && t >= tBang ? Math.max(0, 1 - (t - tBang) / 0.5) : 0;
  const sx = calm * 6 * Math.sin(t * 0.9) + bang * 10 * Math.sin(frame * 3.1), sy = calm * 5 * Math.sin(t * 1.3 + 1), rot = calm * 0.35 * Math.sin(t * 0.7);
  const dip = Math.max(0, 1 - f / 0.18) * (s === "hook" ? 0 : 0.85);
  const showHud = !["hook", "peep", "split", "choice"].includes(s);

  return (
    <AbsoluteFill style={{ backgroundColor: "#03040A", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) rotate(${rot}deg) scale(1.04)` }}>
        {/* 1. Хук: оповещение в руках, за окном гаснет город */}
        {s === "hook" && (<>
          <div style={{ position: "absolute", inset: 0, filter: "blur(5px) brightness(0.8)" }}>
            <CityBlackout frame={frame} off={interpolate(t, [tOff, tOff + 1.4], [0, 1.1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} zoom={1.15 + 0.02 * t} />
          </div>
          <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 0 60px #0A0C11, inset 0 0 220px 120px rgba(0,0,0,.85)" }} />
          <div style={{ position: "absolute", left: 120, top: 300, width: 840, height: 900, borderRadius: 420, background: "radial-gradient(closest-side, rgba(229,57,53,.28), rgba(0,0,0,0))" }} />
          <PhoneInHands light={0.45} shake={t < 1.4 ? 1 : 0} frame={frame}>
            <PhoneUI mode="alert" k={ramp(t, 0, 0.2)} battery={54} time="03:07" scale={PHONE_SCALE} />
          </PhoneInHands>
        </>)}
        {/* 2. Запасы на полу, Джек ложится рядом */}
        {s === "supplies" && (<>
          <RoomDark horizon={900} glow={{ x: 860, y: 1500, r: 520, k: 0.7 }} />
          <Supplies frame={frame} jack={sm(ramp(t, tJack - 0.3, 0.8))} hi={[win(tTorchItem, tPhoneItem), win(tPhoneItem, tCandle), win(tCandle, tOpp + 0.2)]} />
        </>)}
        {/* 3. Окно напротив: загорается и гаснет само; рука держит штору */}
        {s === "window" && (<>
          <WindowView frame={frame} hero={false} flash={t >= tLit && t < tDark + 0.15 ? Math.min(1, (t - tLit) / 0.25) : 0} lunaGrowl={t >= tLit ? 1 : 0} zoom={1.02 + 0.02 * f} />
          <Layer><PovArm x={250} y={1240} angle={10} side="L" pose="grip" light={t >= tLit && t < tDark ? 0.7 : 0.35} /></Layer>
        </>)}
        {/* 4. Правило 1: яркость в ноль пальцем, телефон к груди */}
        {s === "bright" && (() => {
          const b = interpolate(t, [tBright + 0.2, tZero + 0.4], [1, 0.02], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const press = sm(ramp(t, tChest, 0.6));
          const reach = sm(ramp(t, tBright - 0.4, 0.5)) * (1 - sm(ramp(t, tChest - 0.2, 0.3)));
          const wr = pointWrist(353 + 374 * b, 567, -10);
          return (<>
            <RoomDark horizon={1500} glow={{ x: 540, y: 700, r: 600, k: (0.25 + 0.75 * b) * (1 - press) }} />
            <PhoneInHands light={0.3 + 0.4 * b} dy={press * 1100} frame={frame} leftOnly>
              <PhoneUI mode="brightness" k={1} battery={phoneAt(t)} time={hudTime} bright={b} scale={PHONE_SCALE} />
            </PhoneInHands>
            {reach > 0 && <Layer><PovArm x={wr.x + (1 - reach) * 300} y={wr.y + (1 - reach) * 900} angle={-10} side="R" pose="point" light={0.3 + 0.4 * b} /></Layer>}
            <div style={{ position: "absolute", inset: 0, background: "#000", opacity: 0.75 * press }} />
          </>);
        })()}
        {/* 5. Правило 2: руки задёргивают шторы */}
        {s === "curtains" && (() => {
          const c = sm(ramp(t, tCurt - 0.2, 0.8));
          const fr = 0.18 + 0.82 * c, eL = 120 + 420 * fr, eR = 960 - 420 * fr;
          return (<>
            <WindowView frame={frame} hero={false} curtains={c} />
            <Layer>
              <PovArm x={eL - 40} y={1250} angle={12} side="L" pose="grip" light={0.32} />
              <PovArm x={eR + 40} y={1250} angle={-12} side="R" pose="grip" light={0.32} />
            </Layer>
          </>);
        })()}
        {/* 6. Полотенце в щель под дверью */}
        {s === "towel" && <DoorBottom frame={frame} push={sm(ramp(t, tTowel - 0.5, 1.0))} />}
        {/* 7. Правило 3: фонарик в пол, стекло под ладонью */}
        {s === "torch" && <TorchFloor frame={frame} on={ramp(t, tTorch, 0.15)} cover={sm(ramp(t, tPalm, 0.7))} />}
        {/* 8. Шаги: дверь в темноте */}
        {s === "stairs" && (<>
          <DoorClose frame={frame} zoom={1 + 0.12 * sm(ramp(t, tDown, tQuiet - tDown))} />
          <div style={{ position: "absolute", inset: 0, background: "#000", opacity: 0.4 }} />
        </>)}
        {/* 9. Глазок: тишина на площадке */}
        {s === "peep" && <Peephole frame={frame} k={ramp(t, tQuiet, 0.4)} figure={sm(ramp(t, tLanding - 0.2, 0.8))} />}
        {/* 10. Сообщение от Лены */}
        {s === "chat" && (<>
          <RoomDark horizon={1500} glow={{ x: 540, y: 700, r: 560, k: 0.4 }} />
          <PhoneInHands light={0.35} shake={t < tBuzz + 0.9 ? 1 : 0} frame={frame}>
            <PhoneUI mode="neighbor" k={ramp(t, tBuzz - 0.05, 0.25)} battery={52} time={hudTime} bright={0.45} scale={PHONE_SCALE}
              lines={([["Они прошли мимо меня и стоят у тебя.", tThey], ["Не открывай никому, что бы ни говорили.", tDont], ["Мы с малым заперлись.", tWe]] as [string, number][])
                .filter(([, a]) => t >= a - 0.1).map(([l]) => l)} />
          </PhoneInHands>
        </>)}
        {/* 11. Ладонь на полу, снизу плач */}
        {s === "floor" && <FloorListen frame={frame} cry={ramp(t, tCry - 0.3, 0.5)} />}
        {/* 12. Стук, цепочка; рука тянется к цепочке */}
        {s === "door" && (<>
          <DoorClose frame={frame} knock={t >= tKnock && t < tKnock + 1.2 ? 1 : 0} chain={t >= tKnock && t < tKnock + 2 ? 1 : 0.25} zoom={1.05 + 0.025 * f} />
          <div style={{ position: "absolute", inset: 0, background: "#000", opacity: 0.25 }} />
          <ChainHand frame={frame} reach={sm(ramp(t, tOpen - 0.2, 1.0))} tremble={1} />
        </>)}
        {/* 13. Джек пятится под кровать */}
        {s === "bed" && <BedHide frame={frame} hide={sm(ramp(t, tBack, 1.4))} />}
        {/* 14. Кто-то врёт: слева чат, справа дверь */}
        {s === "split" && (<>
          <div style={{ position: "absolute", left: 0, top: 0, width: 540, height: 1920, overflow: "hidden", background: "#050608" }}>
            <div style={{ position: "absolute", left: -270, top: 0, width: 1080, height: 1920 }}>
              <PhoneUI mode="neighbor" k={1} battery={52} time={hudTime} bright={0.45} scale={0.85} lines={["Они стоят у тебя.", "Не открывай никому."]} />
            </div>
          </div>
          <div style={{ position: "absolute", left: 540, top: 0, width: 540, height: 1920, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: -270, top: 0, width: 1080, height: 1920 }}><DoorClose frame={frame} chain={0.4} /></div>
          </div>
          <div style={{ position: "absolute", left: 536, top: 0, width: 8, height: 1920, background: SRYV.fail, opacity: 0.8 }} />
        </>)}
        {/* 15. Выбор: рука у цепочки, телефон в другой руке */}
        {s === "choice" && (<>
          <DoorClose frame={frame} chain={0.3} zoom={1.08} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(3,4,8,0.62)" }} />
          <Layer>
            <PovArm x={300} y={1720} angle={18} side="L" pose="point" light={0.3} />
            <g transform="translate(800 1560) rotate(-10)">
              <rect x={-110} y={-200} width={220} height={380} rx={30} fill="#0B0D12" stroke="#1E222B" strokeWidth={10} />
              <rect x={-96} y={-186} width={192} height={352} rx={22} fill="#141A26" />
              {t >= tGlow && <rect x={-96} y={-186} width={192} height={352} rx={22} fill="none" stroke={SRYV.fail} strokeWidth={8} opacity={0.5 + 0.5 * Math.sin(frame / 4)} />}
            </g>
            <PovArm x={800} y={1840} angle={-6} side="R" pose="grip" light={0.3} />
          </Layer>
        </>)}
        <div style={{ position: "absolute", inset: 0, background: "#000", opacity: dip }} />
      </AbsoluteFill>

      {/* Шёпот за дверью — одна строка за раз */}
      {s === "door" && t >= tWhisper && (() => {
        const L: [string, number][] = [["«Это Лена.", W("это")], ["Телефон сел ещё вечером, писала не я.", W("телефон", 2)], ["Ключи остались внутри, малой там один.", W("ключи")], ["Слышишь? Открой, пожалуйста»", W("слышишь?")]];
        const cur = L.filter(([, a]) => t >= a - 0.1).pop();
        return cur && (
          <div style={{ position: "absolute", left: 90, right: 90, top: 330, textAlign: "center", opacity: 0.9 * ramp(t, cur[1] - 0.1, 0.4),
            fontFamily: "Caveat", fontWeight: 700, fontSize: 70, lineHeight: 1.05, color: "#C9D2E0", textShadow: "0 0 18px rgba(0,0,0,.95)" }}>{cur[0]}</div>
        );
      })()}
      {/* Номера этажей на шагах */}
      {s === "stairs" && t >= t3 - 0.2 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 300, display: "flex", justifyContent: "center", gap: 30 }}>
          {[3, 4, 5].map((n, i) => {
            const k = ramp(t, [t3, t4, tQuiet - 0.1][i], 0.2);
            return <div key={n} style={{ width: 130, height: 130, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.25 + 0.75 * k,
              background: n === 5 && k > 0 ? "rgba(229,57,53,.25)" : "rgba(10,12,18,.85)", border: `5px solid ${n === 5 && k > 0 ? SRYV.fail : "#E8C547"}`,
              fontFamily: "Inter Display", fontWeight: 900, fontSize: 86, color: "#FFFFFF" }}>{n}</div>;
          })}
        </div>
      )}
      {/* Таймер фонарика */}
      {s === "torch" && t >= tTorch && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 270, display: "flex", justifyContent: "center" }}>
          <div style={{ padding: "10px 34px", borderRadius: 18, background: "rgba(10,12,18,0.9)", border: "5px solid #E8C547", fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 90, color: "#FFFFFF" }}>
            {(() => { const left = 60 - Math.floor(t - tTorch); return left >= 60 ? "1:00" : `0:${String(left).padStart(2, "0")}`; })()}
          </div>
        </div>
      )}
      {s === "split" && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 230, display: "flex", justifyContent: "center", opacity: ramp(t, W("врёт.") - 0.2, 0.3) }}>
          <div style={{ padding: "12px 30px", borderRadius: 14, background: "rgba(10,12,18,.9)", border: `5px solid ${SRYV.fail}`, fontFamily: "Inter Display", fontWeight: 900, fontSize: 54, color: "#FFFFFF" }}>КТО-ТО ВРЁТ</div>
        </div>
      )}
      {s === "choice" && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 260, display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
          {([["ОТКРЫТЬ ДВЕРЬ", SRYV.lamp, W("открываешь")], ["ПРОВЕРИТЬ ТЕЛЕФОН", SRYV.screen, W("проверяешь")]] as const).map(([txt, c, at]) => {
            const k = ramp(t, at - 0.2, 0.3);
            return <div key={txt} style={{ transform: `scale(${0.85 + 0.15 * k})`, opacity: 0.3 + 0.7 * k, width: 760, textAlign: "center", padding: "26px 20px", borderRadius: 22,
              border: `6px solid ${c}`, background: `${c}22`, boxShadow: `0 0 30px ${c}66`, fontFamily: "Inter Display", fontWeight: 900, fontSize: 60, color: "#FFFFFF" }}>{txt}</div>;
          })}
          <div style={{ opacity: ramp(t, tGlow, 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 36, color: "#FF6B5E" }}>⚠ ЭКРАН — ЭТО ТОЖЕ СВЕТ</div>
          <div style={{ opacity: ramp(t, tWrite, 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 40, color: "#E8C547", marginTop: 10 }}>ПИШИ В КОММЕНТАРИЯХ ↓</div>
          <div style={{ opacity: ramp(t, tNext, 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 32, color: "#C9D2E0" }}>СЕРИЯ 2 — С ТВОЕГО ОТВЕТА</div>
        </div>
      )}
      {/* HUD: время и запасы */}
      {showHud && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 70, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 72, lineHeight: 1, color: "#FF6B5E", textShadow: "0 0 20px rgba(229,57,53,.6)" }}>{hudTime}</div>
          <div style={{ display: "flex", gap: 12 }}>
            <Item label="" hi={win(tTorchItem, tPhoneItem)}>
              <div style={{ display: "flex", gap: 6 }}>{[cell1, 1, 1].map((c, i) => (
                <div key={i} style={{ width: 22, height: 40, borderRadius: 5, border: "3px solid #E8C547", display: "flex", alignItems: "flex-end" }}>
                  <div style={{ width: "100%", height: `${Math.round(100 * c)}%`, background: "#E8C547" }} /></div>))}</div>
            </Item>
            <Item label={`${phoneAt(t)}%`} hi={win(tPhoneItem, tCandle)}><div style={{ width: 24, height: 40, borderRadius: 6, border: "3px solid #C9D2E0" }} /></Item>
            <Item label="×1" hi={win(tCandle, tOpp + 0.2)}><div style={{ width: 12, height: 34, borderRadius: 3, background: "#EDE6D6" }} /></Item>
          </div>
        </div>
      )}
      <Karaoke words={CW} accents={ACCENTS} pendingColor="#C3C8D2" />
      <Grain />
      {withAudio && <Audio src={staticFile("audio/svet1_mix.wav")} />}
    </AbsoluteFill>
  );
};
