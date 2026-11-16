import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Karaoke, Word } from "../../captions/Karaoke";
import data from "../../captions/svet2.words.json";
import { Grain } from "../../ui/Grain";
import { useFonts } from "../../useFonts";
import { SRYV } from "../../style/palette";
import { CityBlackout, DoorClose, PhoneUI } from "../../scenes/Svet";
import { CeilingGlow, ChestGlow, DogLookUp, LightSpread, PovArm, RoomDark } from "../../scenes/SvetPov";
import { idxIn, Layer, merge, PHONE_SCALE, PhoneInHands, pointWrist, ramp, sm, Stamp, SvetHud, wordAt } from "./shared";

/*
 * «Оно идёт на свет». Серия 2 «Проверил» — текст v2: краткое введение, больше действия, выбор из двух словами (LESSONS Б21–22).
 * Вид от первого лица. Время — по словам голоса.
 */
export const FPS = 30;
const WORDS = (data as { words: Word[] }).words;
const VOICE_END = WORDS[WORDS.length - 1].end, TAIL = 1.6;
export const SVET2_FRAMES = Math.round((VOICE_END + TAIL) * FPS);
const W = wordAt(WORDS);
const CW = (() => {
  const out = WORDS.map((w) => ({ ...w }));
  merge(out, "три", 3, "03:07.");
  merge(out, "двадцать", 3, "21:17.");
  merge(out, "восемь", 2, "8%,");
  merge(out, "пятнадцать.", 1, "15%.");
  merge(out, "тридцать", 3, "31%.");
  return out;
})();
const ACC: [string, number, "yellow" | "red"][] = [
  ["проверить.", 1, "yellow"], ["она.", 1, "red"], ["ты».", 2, "red"], ["15%.", 1, "yellow"], ["пальцы.", 1, "yellow"], ["тебе.", 1, "red"],
  ["сама.", 1, "red"], ["вверх.", 2, "yellow"], ["чердак.", 1, "red"], ["сети».", 2, "red"], ["упора.", 1, "red"],
];
const ACCENTS = Object.fromEntries(ACC.map(([w, n, c]) => [idxIn(CW, w, n), c]).filter(([i]) => (i as number) >= 0)) as Record<number, "yellow" | "red">;

/* ---------- Ключевые моменты ---------- */
const tGone = W("погас."), tVoice0 = W("голос"), tMsgs = W("а"), tChose = W("ты"), tStatus = W("статус"), tWas = W("была"), tNotHer = W("пишет"),
  tLines = W("строки"), tG1 = W("я"), tG2 = W("теперь"), tKnows = W("знает,"), tFlash = W("вспыхивает."), tBright = W("яркость"),
  t8 = W("восемь"), t15 = W("пятнадцать."), tBtn = W("кнопка"), tChest = W("прижимаешь"), tShade = W("за"), tWin = W("загорается"),
  tFloor = W("целый"), tJump = W("перескакивает"), tYou = W("тебе."), tChain = W("цепочка"), tRing = W("звенит."), tHandle = W("ручка"),
  tJack = W("джек"), tUp = W("вверх.", 2), tAbove = W("над"), tCreak = W("скрипят"), tLast = W("последний."), tAttic = W("выше"),
  tCall = W("входящий"), tSame = W("тот"), tV1 = W("зря"), tV2 = W("теперь", 2), tB31 = W("яркость", 2), tHandle2 = W("ручка", 2),
  tChoice = W("что"), tA = W("разбиваешь"), tB = W("или"), tWrite = W("пиши."), tNext = W("следующая");

type Scene = "recapCity" | "recapDoor" | "recapChat" | "recapTap" | "status" | "flash" | "chest" | "spread" | "door" | "dog" | "ceiling" | "call" | "voice" | "triple" | "choice";
const SCENES: [number, Scene][] = [
  [0, "recapCity"], [tVoice0 - 0.1, "recapDoor"], [tMsgs - 0.1, "recapChat"], [tChose - 0.1, "recapTap"], [tStatus - 0.1, "status"],
  [tFlash - 0.3, "flash"], [tChest - 0.1, "chest"], [tShade - 0.1, "spread"], [tChain - 0.1, "door"], [tJack - 0.1, "dog"],
  [tAbove - 0.1, "ceiling"], [tCall - 0.1, "call"], [tSame - 0.1, "voice"], [tB31 - 0.1, "triple"], [tChoice - 0.1, "choice"],
];
const sceneAt = (t: number) => { let cur: Scene = "recapCity", start = 0; for (const [a, s] of SCENES) if (t >= a) { cur = s; start = a; } return { s: cur, f: t - start }; };
const RECAP = new Set<Scene>(["recapCity", "recapDoor", "recapChat", "recapTap"]);

const minAt = (t: number) => Math.round(interpolate(t, [tStatus, tBright, tCall, VOICE_END + TAIL], [41, 42, 43, 44], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
const brightAt = (t: number) => interpolate(t, [tFlash, tFlash + 0.25, tBright, t8, t15, tChest, tB31, tChoice, VOICE_END + TAIL], [0.02, 1, 0.04, 0.08, 0.15, 0.2, 0.31, 0.36, 0.4],
  { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const batteryAt = (t: number) => (t < tBright ? 52 : t < tB31 ? 51 : 50);
const handleAt = (t: number) => interpolate(t, [tHandle, tHandle + 1.4, tSame, tHandle2, tHandle2 + 0.8], [0, 0.45, 0.5, 0.6, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/* Шёпот двумя голосами: из-за двери и из телефона (красная копия со сдвигом). */
const Echo: React.FC<{ text: string; k: number; top?: number }> = ({ text, k, top = 330 }) => (
  <div style={{ position: "absolute", left: 60, right: 60, top, textAlign: "center", opacity: k }}>
    <div style={{ position: "absolute", left: 0, right: 0, top: 6, transform: "translateX(10px)", fontFamily: "Caveat", fontWeight: 700, fontSize: 74, lineHeight: 1.05, color: "#FF6B5E", opacity: 0.55 }}>{text}</div>
    <div style={{ position: "relative", fontFamily: "Caveat", fontWeight: 700, fontSize: 74, lineHeight: 1.05, color: "#E6ECF5", textShadow: "0 0 18px rgba(0,0,0,.95)" }}>{text}</div>
  </div>
);
const Half: React.FC<{ x: number; w?: number; children: React.ReactNode; bg?: string }> = ({ x, w = 540, children, bg = "#050608" }) => (
  <div style={{ position: "absolute", left: x, top: 0, width: w, height: 1920, overflow: "hidden", background: bg }}>
    <div style={{ position: "absolute", left: -(1080 - w) / 2, top: 0, width: 1080, height: 1920 }}>{children}</div>
  </div>
);

export const Svet2: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  useFonts();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { s, f } = sceneAt(t);
  const m = minAt(t), dawnMin = 7 * 60 + 3 - (3 * 60 + m);
  const time = `03:${String(m).padStart(2, "0")}`, dawn = `${Math.floor(dawnMin / 60)}:${String(dawnMin % 60).padStart(2, "0")}`;
  const b = brightAt(t);
  const h = handleAt(t);
  const recap = RECAP.has(s);
  const calm = s === "ceiling" || s === "door" ? 0.3 : 1;
  const sx = calm * 6 * Math.sin(t * 0.9), sy = calm * 5 * Math.sin(t * 1.3 + 1), rot = calm * 0.35 * Math.sin(t * 0.7);
  const dip = Math.max(0, 1 - f / 0.15) * (s === "recapCity" ? 0 : 0.85);
  const showHud = !recap && !["triple", "choice", "voice", "call"].includes(s);
  const voiceWave = [tV1, tV2].some((a) => t >= a && t < a + 1.4) ? 1 : 0.15;
  const flashK = s === "flash" ? Math.max(0, 1 - Math.abs(t - (tFlash + 0.1)) / 0.35) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#03040A", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) rotate(${rot}deg) scale(1.04)`, filter: recap ? "grayscale(0.85) contrast(1.1) brightness(0.85)" : undefined }}>
        {/* ---- РАНЕЕ: быстрый пересказ ---- */}
        {s === "recapCity" && <CityBlackout frame={frame} off={interpolate(t, [tGone - 0.2, tGone + 0.8], [0, 1.1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} zoom={1.1 + 0.03 * t} />}
        {s === "recapDoor" && <DoorClose frame={frame} chain={1} knock={f < 0.9 ? 1 : 0} zoom={1.05 + 0.04 * f} />}
        {s === "recapChat" && (<>
          <RoomDark horizon={1500} glow={{ x: 540, y: 700, r: 560, k: 0.4 }} />
          <PhoneInHands light={0.38} frame={frame}>
            <PhoneUI mode="neighbor" k={1} battery={52} time="03:40" bright={0.45} scale={PHONE_SCALE} lines={["Не открывай никому.", "Что бы ни говорили."]} />
          </PhoneInHands>
        </>)}
        {s === "recapTap" && (<>
          <DoorClose frame={frame} chain={0.4} zoom={1.08} />
          <Layer><PovArm x={760} y={1900 - 500 * sm(ramp(t, tChose, 0.6))} angle={-14} side="R" pose="grip" light={0.4} /></Layer>
        </>)}
        {/* ---- 1. Статус, строки печатаются сами ---- */}
        {s === "status" && (<>
          <RoomDark horizon={1500} glow={{ x: 540, y: 700, r: 560, k: 0.45 }} />
          <PhoneInHands light={0.38} frame={frame}>
            <PhoneUI mode="neighbor" k={1} battery={batteryAt(t)} time={time} bright={0.45} scale={PHONE_SCALE} frame={frame}
              status="была в сети вчера в 21:17" statusHi={sm(ramp(t, tWas, 0.4))}
              lines={["Они прошли мимо меня и стоят у тебя.", "Не открывай никому."]}
              ghost={[...(t >= tG1 - 0.1 ? ["Я вижу экран."] : []), ...(t >= tG2 - 0.1 ? ["Теперь оно знает, где ты."] : [])]}
              typing={t >= tLines && t < tG2 ? 1 : 0} />
          </PhoneInHands>
        </>)}
        {/* ---- 2. Вспышка, яркость ползёт, кнопка не работает ---- */}
        {s === "flash" && (() => {
          const press = t >= tBtn + 0.1 && t < tBtn + 1.2 ? 1 : 0;
          const reach = sm(ramp(t, tBtn - 0.5, 0.45));
          const wr = pointWrist(780 - 8 * press * (Math.sin(frame) > 0 ? 1 : 0), 560, -25);
          return (<>
            <RoomDark horizon={1500} glow={{ x: 540, y: 700, r: 520 + 500 * b, k: 0.3 + 2.2 * b }} />
            <PhoneInHands light={0.32 + 1.2 * b} frame={frame} leftOnly shake={press || flashK > 0.3 ? 1 : 0}>
              <PhoneUI mode="brightness" k={1} battery={batteryAt(t)} time={time} bright={b} scale={PHONE_SCALE} />
            </PhoneInHands>
            {reach > 0 && <Layer><PovArm x={wr.x + (1 - reach) * 300} y={wr.y + (1 - reach) * 900} angle={-25} side="R" pose="point" light={0.32 + 1.2 * b} /></Layer>}
          </>);
        })()}
        {/* ---- 3. К груди — свет сквозь пальцы ---- */}
        {s === "chest" && <ChestGlow frame={frame} k={b} />}
        {/* ---- 4. Окно напротив, целый этаж, свет перескакивает к тебе ---- */}
        {s === "spread" && (
          <LightSpread frame={frame} lit={t < tWin ? 0 : (t < tFloor ? (Math.floor(frame / 4) % 5 === 0 ? 0 : 1) : 3)} floor={sm(ramp(t, tFloor, 0.5))}
            near={interpolate(t, [tJump, tYou], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} edge={sm(ramp(t, tYou, 0.4))} />
        )}
        {/* ---- 5. Цепочка звенит сама, ручка опускается ---- */}
        {s === "door" && (<>
          <DoorClose frame={frame} chain={t >= tRing - 0.4 ? 1 : 0.2} handle={h} zoom={1.05 + 0.1 * sm(ramp(t, tHandle - 0.3, 1.2))} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 60% 42%, rgba(0,0,0,0) 20%, rgba(0,0,0,.75) 70%)" }} />
        </>)}
        {/* ---- 6. Джек смотрит вверх ---- */}
        {s === "dog" && <DogLookUp frame={frame} out={ramp(t, tJack + 0.2, 0.9)} up={sm(ramp(t, tUp - 0.3, 0.6))} />}
        {/* ---- 7. Шаги над потолком, сыплется пыль ---- */}
        {s === "ceiling" && <CeilingGlow frame={frame} glow={sm(ramp(t, tAbove, 0.8))} steps={ramp(t, tCreak, 0.3)} />}
        {/* ---- 8. Входящий вызов «Лена» ---- */}
        {s === "call" && (<>
          <RoomDark horizon={1500} glow={{ x: 540, y: 700, r: 640, k: 0.7 }} />
          <PhoneInHands light={0.5} frame={frame} shake={Math.floor(t * 2) % 2 === 0 ? 1 : 0}>
            <PhoneUI mode="voice" call k={1} battery={batteryAt(t)} time={time} bright={0.8} scale={PHONE_SCALE} frame={frame} />
          </PhoneInHands>
        </>)}
        {/* ---- 9. Тот же голос — из двери и из телефона ---- */}
        {s === "voice" && (<>
          <Half x={0}><DoorClose frame={frame} chain={voiceWave > 0.5 ? 1 : 0.4} handle={h} /></Half>
          <Half x={540}><PhoneUI mode="voice" k={1} battery={batteryAt(t)} time={time} bright={0.6} scale={0.85} wave={voiceWave} frame={frame} /></Half>
          <div style={{ position: "absolute", left: 536, top: 0, width: 8, height: 1920, background: SRYV.fail, opacity: 0.8 }} />
        </>)}
        {/* ---- 10. Три экрана: дверь / потолок / яркость ---- */}
        {(s === "triple" || s === "choice") && (<>
          <Half x={0} w={360}><DoorClose frame={frame} chain={1} handle={h} /></Half>
          <Half x={360} w={360}><CeilingGlow frame={frame} glow={0.8 + 0.2 * Math.sin(frame / 6)} steps={1} /></Half>
          <Half x={720} w={360}><PhoneUI mode="brightness" k={1} battery={batteryAt(t)} time={time} bright={b} scale={0.62} /></Half>
          {[358, 718].map((x) => <div key={x} style={{ position: "absolute", left: x, top: 0, width: 6, height: 1920, background: SRYV.fail, opacity: 0.7 }} />)}
          {s === "choice" && <div style={{ position: "absolute", inset: 0, background: "rgba(3,4,8,0.72)" }} />}
        </>)}
        <div style={{ position: "absolute", inset: 0, background: "#000", opacity: dip }} />
        <div style={{ position: "absolute", inset: 0, background: "#EAF2FF", opacity: 0.85 * flashK }} />
      </AbsoluteFill>

      {/* Пометка пересказа */}
      {recap && (<>
        <div style={{ position: "absolute", left: 60, top: 80, padding: "8px 20px", borderRadius: 10, background: "rgba(10,12,18,.85)", border: "4px solid #9AA6BA",
          fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 34, color: "#FFFFFF", letterSpacing: 4 }}>РАНЕЕ</div>
        {s === "recapDoor" && <div style={{ position: "absolute", left: 90, right: 90, top: 330, textAlign: "center", fontFamily: "Caveat", fontWeight: 700, fontSize: 74, color: "#E6ECF5", textShadow: "0 0 18px #000" }}>«Открой, пожалуйста»</div>}
        {s === "recapTap" && <Stamp k={ramp(t, tChose + 0.2, 0.25)} color={SRYV.screen} size={46}>ВЫ ВЫБРАЛИ:<br />ПРОВЕРИТЬ ТЕЛЕФОН</Stamp>}
      </>)}
      {s === "status" && <Stamp k={ramp(t, tNotHer, 0.25) * (1 - ramp(t, tLines - 0.2, 0.2))}>ПИШЕТ НЕ ОНА</Stamp>}
      {s === "status" && <Stamp k={ramp(t, tKnows + 0.2, 0.25)} color="#E8C547" top={290} size={40}>ПРАВИЛО №4<br />НЕ ПРОВЕРЯЙ, КТО ПИШЕТ</Stamp>}
      {s === "flash" && t >= tBtn + 0.3 && <Stamp k={ramp(t, tBtn + 0.3, 0.2)} size={40} top={1390}>🔒 НЕ РАБОТАЕТ</Stamp>}
      {s === "spread" && (
        <div style={{ position: "absolute", left: 90, right: 90, top: 300, display: "flex", alignItems: "center", gap: 14, fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 30, color: "#FFD27A" }}>
          <span>НАПРОТИВ</span>
          <div style={{ flex: 1, height: 14, borderRadius: 7, background: "#2B3241", overflow: "hidden" }}>
            <div style={{ width: `${Math.round(100 * interpolate(t, [tWin, tYou], [0.05, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))}%`, height: "100%", background: "#FFD27A" }} />
          </div>
          <span style={{ color: t >= tYou ? "#FF6B5E" : "#FFD27A" }}>ТВОЙ ДОМ</span>
        </div>
      )}
      {s === "door" && t >= tRing && <Stamp k={ramp(t, tRing, 0.2) * (1 - ramp(t, tHandle - 0.2, 0.2))} size={44}>САМА</Stamp>}
      {s === "ceiling" && <Stamp k={ramp(t, tLast - 0.3, 0.25)} color="#E8C547" top={330} size={50}>{t < tAttic - 0.1 ? "ЭТАЖ ПОСЛЕДНИЙ" : "ВЫШЕ — ЧЕРДАК"}</Stamp>}
      {s === "voice" && (() => {
        const L: [string, number][] = [["«Зря проверил.", tV1], ["Теперь оно в сети»", tV2]];
        const cur = L.filter(([, a]) => t >= a - 0.1).pop();
        return cur ? <Echo text={cur[0]} k={0.95 * ramp(t, cur[1] - 0.1, 0.4)} /> : null;
      })()}
      {s === "triple" && (
        <div style={{ position: "absolute", left: 720, width: 360, top: 1440, textAlign: "center", fontFamily: "Inter Display", fontWeight: 900, fontSize: 96, color: "#FF6B5E", textShadow: "0 0 24px rgba(229,57,53,.7)" }}>
          {Math.round(100 * b)}%↑
        </div>
      )}
      {s === "choice" && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 250, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          {([["РАЗБИТЬ ТЕЛЕФОН", "темнота, но без связи", SRYV.fail, tA], ["ФОНАРИК — И НА ЧЕРДАК", "узнать, кто ходит сверху", SRYV.lamp, tB]] as const).map(([txt, sub, c, at], i) => {
            const k = ramp(t, at - 0.3, 0.3);
            return (
              <React.Fragment key={txt}>
                {i === 1 && <div style={{ opacity: k, fontFamily: "Inter Display", fontWeight: 900, fontSize: 46, color: "#C9D2E0" }}>ИЛИ</div>}
                <div style={{ transform: `scale(${0.88 + 0.12 * k})`, opacity: 0.25 + 0.75 * k, width: 880, textAlign: "center", padding: "24px 20px",
                  borderRadius: 24, border: `6px solid ${c}`, background: "rgba(10,12,18,.9)", boxShadow: `0 0 34px ${c}55` }}>
                  <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: 62, color: "#FFFFFF", lineHeight: 1 }}>{txt}</div>
                  <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 30, color: "#9AA6BA", marginTop: 8 }}>{sub}</div>
                </div>
              </React.Fragment>
            );
          })}
          <div style={{ opacity: ramp(t, tWrite, 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 40, color: "#E8C547", marginTop: 6 }}>ПИШИ В КОММЕНТАРИЯХ ↓</div>
          <div style={{ opacity: ramp(t, tNext, 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 32, color: "#C9D2E0" }}>СЕРИЯ 3 — С ТВОЕГО ОТВЕТА</div>
        </div>
      )}
      {showHud && <SvetHud time={time} dawn={dawn} cells={[0.75, 1, 1]} battery={batteryAt(t)} />}
      <Karaoke words={CW} accents={ACCENTS} pendingColor="#C3C8D2" />
      <Grain />
      {withAudio && <Audio src={staticFile("audio/svet2_mix.wav")} />}
    </AbsoluteFill>
  );
};
