import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Karaoke, Word } from "../../captions/Karaoke";
import data from "../../captions/svet4.words.json";
import { Grain } from "../../ui/Grain";
import { useFonts } from "../../useFonts";
import { SRYV } from "../../style/palette";
import { DoorClose, PhoneUI } from "../../scenes/Svet";
import { Attic, Basement, HatchAbove, JackSleeps, LandingFloor, PovArm, RoomDark, WallWires } from "../../scenes/SvetPov";
import { idxIn, Layer, merge, ramp, sm, Stamp, SvetHud, wordAt } from "./shared";

/*
 * «Оно идёт на свет». Серия 4 «Рассвет» — финал сезона, продолжения не будет. Ответ зрителей: спросить через крышку.
 */
export const FPS = 30;
const WORDS = (data as { words: Word[] }).words;
const VOICE_END = WORDS[WORDS.length - 1].end, TAIL = 2.2;
export const SVET4_FRAMES = Math.round((VOICE_END + TAIL) * FPS);
const W = wordAt(WORDS);
const CW = (() => { const out = WORDS.map((w) => ({ ...w })); merge(out, "семь", 3, "07:02."); merge(out, "семь", 3, "07:03."); return out; })();
const ACC: [string, number, "yellow" | "red"][] = [
  ["спросить.", 1, "yellow"], ["переписке.", 1, "yellow"], ["неправильно.", 1, "red"], ["ослепнет».", 1, "yellow"], ["вниз».", 1, "red"],
  ["городе.", 1, "red"], ["живые.", 1, "yellow"], ["гасит».", 1, "red"], ["изнутри.", 1, "red"], ["солнца.", 1, "yellow"], ["закончилась.", 1, "yellow"], ["конец.", 1, "red"],
];
const ACCENTS = Object.fromEntries(ACC.map(([w, n, c]) => [idxIn(CW, w, n), c]).filter(([i]) => (i as number) >= 0)) as Record<number, "yellow" | "red">;

const tChose = W("вы"), tAsk = W("ты"), tQ = W("как"), tNoChat = W("этого"), tJack = W("джек»."), tWrong = W("неправильно."), tSteps = W("шаги"),
  tKolya = W("коля"), tGen = W("подвале"), tFive = W("пять"), t4 = W("четвёртый."), tTypes = W("печатает"), tDontGo = W("не"), t3 = W("третий."),
  tMom = W("мама:"), tMom2 = W("мама", 2), tBase = W("подвал."), tAlive = W("живые."), tWag = W("джек", 2), tGen2 = W("генератор", 2), tMarker = W("маркером:"),
  tReach = W("коля", 2), tGrab = W("перехватить"), t702 = W("семь"), tLamp = W("лампа"), tScrape = W("скрежет,"), t703 = W("семь", 2), tRay = W("луч"),
  tLights = W("загорается"), tSleep = W("джек", 3), tLast = W("это"), tEnd = W("конец."), tQuestion = W("а", 2), tWrite = W("пиши");

type Scene = "recap" | "ask" | "kolya" | "descend" | "floor4" | "floor3" | "basement" | "sign" | "grab" | "scrape" | "dawn" | "sleep" | "end" | "question";
const SCENES: [number, Scene][] = [
  [0, "recap"], [tAsk - 0.1, "ask"], [tKolya - 0.1, "kolya"], [tFive - 0.1, "descend"], [t4 - 0.1, "floor4"], [t3 - 0.1, "floor3"], [tBase - 0.1, "basement"],
  [tGen2 - 0.1, "sign"], [tReach - 0.1, "grab"], [tLamp - 0.1, "scrape"], [t703 - 0.1, "dawn"], [tSleep - 0.1, "sleep"], [tLast - 0.1, "end"], [tQuestion - 0.1, "question"],
];
const sceneAt = (t: number) => { let cur: Scene = "recap", start = 0; for (const [a, s] of SCENES) if (t >= a) { cur = s; start = a; } return { s: cur, f: t - start }; };

/* Время: ночь проходит за серию, рассвет в 07:03 */
const minAt = (t: number) => Math.round(interpolate(t, [0, tKolya, tFive, t4, t3, tBase, tGen2, t702, t703], [228, 230, 250, 305, 340, 380, 410, 422, 423],
  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const Echo: React.FC<{ text: string; k: number; top?: number; color?: string }> = ({ text, k, top = 420, color = "#E6ECF5" }) => (
  <div style={{ position: "absolute", left: 60, right: 60, top, textAlign: "center", opacity: k, fontFamily: "Caveat", fontWeight: 700, fontSize: 80, lineHeight: 1.05, color, textShadow: "0 0 18px rgba(0,0,0,.95)" }}>{text}</div>
);
const FloorBadge: React.FC<{ n: number; k: number }> = ({ n, k }) => (
  <div style={{ position: "absolute", left: 60, top: 300, width: 130, height: 130, borderRadius: 18, opacity: k, display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(10,12,18,.85)", border: `5px solid ${SRYV.fail}`, fontFamily: "Inter Display", fontWeight: 900, fontSize: 86, color: "#FFFFFF" }}>{n}</div>
);

export const Svet4: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  useFonts();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { s, f } = sceneAt(t);
  const m = minAt(t), dawnMin = Math.max(0, 423 - m);
  const time = hhmm(m), dawn = `${Math.floor(dawnMin / 60)}:${String(dawnMin % 60).padStart(2, "0")}`;
  const recap = s === "recap";
  const warm = s === "dawn" || s === "sleep" || s === "end" || s === "question";
  const calm = ["ask", "sign", "grab"].includes(s) ? 0.3 : 1;
  const sx = calm * 5 * Math.sin(t * 0.9) + (s === "scrape" ? Math.sin(frame * 3) * 4 : 0), sy = calm * 4 * Math.sin(t * 1.3 + 1);
  const dip = Math.max(0, 1 - f / 0.15) * (s === "recap" ? 0 : 0.85);
  const cells = [Math.max(0, 0.75 - 0.75 * ramp(t, tFive, tBase - tFive)), Math.max(0, 1 - ramp(t, t4, tBase - t4)), 1 - 0.6 * ramp(t, t3, tBase - t3)];
  const showHud = !recap && !["question", "end", "sleep"].includes(s);
  const sun = s === "dawn" ? sm(ramp(t, tRay - 1.0, 2.0)) : warm ? 1 : 0;
  const lights = t >= tLights ? 1 : s === "dawn" && t >= W("лампочки") ? (Math.floor(frame / 3) % 2 ? 1 : 0.2) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#03040A", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) scale(1.04)`, filter: recap ? "grayscale(0.85) contrast(1.1) brightness(0.85)" : warm ? "saturate(1.05)" : undefined }}>
        {(s === "recap" || s === "ask") && <HatchAbove frame={frame} knock={s === "recap" && t < 2 ? 1 : t >= tSteps && t < tSteps + 1.5 ? 0.4 : 0} />}
        {s === "kolya" && <Attic frame={frame} talk={t >= W("оно") && t < tFive ? 1 : 0} zoom={1 + 0.08 * sm(ramp(t, tKolya, 5))} />}
        {s === "descend" && <LandingFloor frame={frame} on={1} follow={ramp(t, tFive, t4 - tFive)} />}
        {s === "floor4" && (<>
          <RoomDark horizon={900} glow={{ x: 540, y: 1300, r: 600, k: 0.8 }} />
          <div style={{ position: "absolute", inset: 0, transform: "translateY(240px) rotate(-8deg) scale(0.92)", transformOrigin: "50% 50%" }}>
            <PhoneUI mode="neighbor" k={1} battery={9} time={time} bright={0.7} scale={0.8} frame={frame}
              lines={["Слышу шаги.", "Не открывай никому."]} ghost={t >= tDontGo - 0.1 ? ["Не ходи вниз."] : []} typing={t >= tTypes - 0.3 && t < tDontGo ? 1 : 0} />
          </div>
          <Layer><rect x={760} y={1500} width={170} height={90} rx={14} fill="#2B3241" stroke="#0A0D13" strokeWidth={6} /><circle cx={900} cy={1545} r={8} fill="#3DDC84" />
            <path d="M 760 1545 Q 700 1560 640 1520" stroke="#1A1D22" strokeWidth={10} fill="none" /></Layer>
        </>)}
        {s === "floor3" && (<>
          <DoorClose frame={frame} chain={0.2} knock={t >= tMom - 0.6 && t < tMom + 0.4 ? 0.6 : 0} zoom={1.05 + 0.03 * f} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 45%, rgba(0,0,0,0) 20%, rgba(0,0,0,.8) 70%)" }} />
        </>)}
        {(s === "basement" || s === "sign" || s === "grab" || s === "dawn" || s === "end" || s === "question") && (
          <div style={{ position: "absolute", inset: 0, transformOrigin: "780px 770px",
            transform: s === "sign" ? `scale(${1 + 0.9 * sm(ramp(t, tGen2, 1.2))})` : s === "grab" ? "scale(1.9)" : s === "end" || s === "question" ? `scale(${1.25 - 0.03 * f})` : "none" }}>
            <Basement frame={frame} lena={1} jackWag={t >= tWag ? 1 : 0} marker={s === "sign" ? ramp(t, tMarker, tReach - tMarker - 0.6) : 1}
              lever={0} hum={t < tLights ? 1 : 0.5} sun={sun} lights={lights} />
          </div>
        )}
        {s === "grab" && (
          <Layer>
            <PovArm x={360 + 220 * sm(ramp(t, tReach, 1.6))} y={1700 - 380 * sm(ramp(t, tReach, 1.6))} angle={40} side="L" pose="point" light={0.35} />
            {t >= tGrab - 0.2 && <PovArm x={960 - 120 * sm(ramp(t, tGrab - 0.2, 0.4))} y={1650 - 200 * sm(ramp(t, tGrab - 0.2, 0.4))} angle={-50} side="R" pose="grip" light={0.45} />}
          </Layer>
        )}
        {s === "scrape" && <WallWires frame={frame} scrape={ramp(t, tScrape - 0.3, 0.3)} />}
        {s === "sleep" && <JackSleeps frame={frame} warm={1} />}
        <div style={{ position: "absolute", inset: 0, background: "#000", opacity: dip }} />
      </AbsoluteFill>

      {recap && (<>
        <div style={{ position: "absolute", left: 60, top: 80, padding: "8px 20px", borderRadius: 10, background: "rgba(10,12,18,.85)", border: "4px solid #9AA6BA",
          fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 34, color: "#FFFFFF", letterSpacing: 4 }}>РАНЕЕ</div>
        <Stamp k={ramp(t, tChose, 0.25)} color="#E8C547" size={46}>ВЫ ВЫБРАЛИ:<br />СПРОСИТЬ</Stamp>
      </>)}
      {s === "ask" && t >= tQ && t < tJack && <Echo text="«Как звали нашего первого пса?»" k={ramp(t, tQ, 0.4)} />}
      {s === "ask" && t >= tNoChat && t < tJack && <Stamp k={ramp(t, tNoChat, 0.25)} color="#E8C547" top={1420} size={40}>ЭТОГО НЕТ В ПЕРЕПИСКЕ</Stamp>}
      {s === "ask" && t >= tJack && <Echo text="«Джек»" k={ramp(t, tJack, 0.3)} color="#FF6B5E" />}
      {s === "ask" && t >= tWrong && <Stamp k={ramp(t, tWrong, 0.25)} top={620} size={60}>НЕПРАВИЛЬНО</Stamp>}
      {s === "kolya" && <Stamp k={ramp(t, tGen, 0.25)} color="#FFB45A" top={300} size={44}>ГЕНЕРАТОР — В ПОДВАЛЕ</Stamp>}
      {s === "descend" && <Stamp k={ramp(t, tFive, 0.25)} color="#E8C547" top={300} size={44}>5 ЭТАЖЕЙ · 3 БАТАРЕЙКИ</Stamp>}
      {s === "floor4" && <FloorBadge n={4} k={ramp(t, t4, 0.2)} />}
      {s === "floor3" && <FloorBadge n={3} k={ramp(t, t3, 0.2)} />}
      {s === "floor3" && t >= tMom && <Echo text="«Сынок, открой»" k={ramp(t, tMom, 0.3)} top={330} />}
      {s === "floor3" && t >= tMom2 && <Stamp k={ramp(t, tMom2, 0.25)} top={560} size={40}>МАМА ЖИВЁТ В ДРУГОМ ГОРОДЕ</Stamp>}
      {s === "basement" && <Stamp k={ramp(t, tAlive, 0.25)} color="#3DDC84" top={300} size={56}>ЖИВЫЕ</Stamp>}
      {(s === "grab" || (s === "dawn" && t < tRay)) && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 300, textAlign: "center", fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 150,
          color: s === "dawn" ? "#FFD27A" : "#FF6B5E", textShadow: "0 0 30px #000", opacity: ramp(t, s === "dawn" ? t703 : t702, 0.2) }}>{s === "dawn" ? "07:03" : "07:02"}</div>
      )}
      {s === "end" && t >= tEnd - 0.1 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 360, textAlign: "center", opacity: ramp(t, tEnd - 0.1, 0.6) }}>
          <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: 150, color: "#FFFFFF", textShadow: "0 0 30px #000" }}>КОНЕЦ</div>
          <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 36, color: "#FFD27A", marginTop: 10 }}>ОНО ИДЁТ НА СВЕТ</div>
        </div>
      )}
      {s === "question" && (
        <div style={{ position: "absolute", left: 90, right: 90, top: 360, textAlign: "center", padding: "26px 20px", borderRadius: 24, border: "6px solid #FFD27A", background: "rgba(10,12,18,.88)" }}>
          <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: 64, color: "#FFFFFF", lineHeight: 1.05 }}>А ТЫ БЫ ВЫКЛЮЧИЛ<br />РУБИЛЬНИК?</div>
          <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 38, color: "#FFD27A", marginTop: 16, opacity: ramp(t, tWrite, 0.3) }}>ПИШИ В КОММЕНТАРИЯХ ↓</div>
        </div>
      )}
      {showHud && <SvetHud time={time} dawn={dawn} cells={cells} battery="✕" />}
      <Karaoke words={CW} accents={ACCENTS} pendingColor="#C3C8D2" />
      <Grain />
      {withAudio && <Audio src={staticFile("audio/svet4_mix.wav")} />}
    </AbsoluteFill>
  );
};
