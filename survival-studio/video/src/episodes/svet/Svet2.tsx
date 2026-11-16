import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Karaoke, Word } from "../../captions/Karaoke";
import data from "../../captions/svet2.words.json";
import { Grain } from "../../ui/Grain";
import { useFonts } from "../../useFonts";
import { SRYV } from "../../style/palette";
import { DoorClose, PhoneUI } from "../../scenes/Svet";
import { CeilingGlow, ChainHand, ChestGlow, DogLookUp, LightSpread, PovArm, RoomDark } from "../../scenes/SvetPov";
import { idxIn, Layer, merge, PHONE_SCALE, PhoneInHands, pointWrist, ramp, sm, Stamp, SvetHud, wordAt } from "./shared";

/*
 * «Оно идёт на свет». Серия 2 «Проверил» — начинается с ответа зрителей (проверить телефон).
 * Вид от первого лица. Время — по словам голоса.
 */
export const FPS = 30;
const WORDS = (data as { words: Word[] }).words;
const VOICE_END = WORDS[WORDS.length - 1].end, TAIL = 1.6;
export const SVET2_FRAMES = Math.round((VOICE_END + TAIL) * FPS);
const W = wordAt(WORDS);
const CW = (() => {
  const out = WORDS.map((w) => ({ ...w }));
  merge(out, "двадцать", 3, "21:17».");
  merge(out, "тридцать", 3, "31%.");
  merge(out, "три", 2, "3%.");
  merge(out, "восемь.", 1, "8%.");
  merge(out, "пятнадцать.", 1, "15%.");
  return out;
})();
const ACC: [string, number, "yellow" | "red"][] = [
  ["она.", 1, "red"], ["знает».", 1, "red"], ["15%.", 1, "yellow"], ["пальцы.", 1, "yellow"], ["твоему.", 1, "red"],
  ["вверх.", 1, "yellow"], ["чердак.", 1, "red"], ["страшное».", 1, "red"], ["растёт.", 1, "red"],
];
const ACCENTS = Object.fromEntries(ACC.map(([w, n, c]) => [idxIn(CW, w, n), c]).filter(([i]) => (i as number) >= 0)) as Record<number, "yellow" | "red">;

/* ---------- Ключевые моменты ---------- */
const tCheck = W("проверяешь"), tStatus = W("статус"), tNotHer = W("пишет"), tNew = W("новые"), tG1 = W("ты", 3), tG2 = W("теперь"),
  tKnows = W("знает»."), tBright = W("яркость"), t3 = W("три"), t8 = W("восемь."), t15 = W("пятнадцать."), tBtn = W("кнопка"),
  tChest = W("прижимаешь"), tOpp = W("в", 3), tThree = W("три", 2), tFive = W("пять."), tFloor = W("целый"), tFlow = W("перетекает"),
  tYours = W("твоему."), tJack = W("джек"), tUp = W("вверх."), tCeil = W("на", 2), tSpot = W("проступает"), tWalk = W("ходит"),
  tFive2 = W("пять", 2), tAttic = W("чердак."), tVoice = W("голос"), tV1 = W("зря"), tV2 = W("теперь", 2), tV3 = W("а", 2),
  tB31 = W("яркость", 2), tChoice = W("что"), tA = W("разбить"), tB = W("выйти"), tC = W("зажечь"), tWrite = W("пиши"), tNext = W("следующая");

type Scene = "intro" | "status" | "bright" | "chest" | "spread" | "dog" | "ceiling" | "voice" | "triple" | "choice";
const SCENES: [number, Scene][] = [
  [0, "intro"], [tCheck - 0.15, "status"], [tBright - 0.1, "bright"], [tChest - 0.1, "chest"], [tOpp - 0.1, "spread"],
  [tJack - 0.1, "dog"], [tCeil - 0.1, "ceiling"], [tVoice - 0.1, "voice"], [tB31 - 0.1, "triple"], [tChoice - 0.1, "choice"],
];
const sceneAt = (t: number) => { let cur: Scene = "intro", start = 0; for (const [a, s] of SCENES) if (t >= a) { cur = s; start = a; } return { s: cur, f: t - start }; };

const minAt = (t: number) => Math.round(interpolate(t, [0, tBright, tVoice, VOICE_END + TAIL], [41, 42, 43, 44], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
const brightAt = (t: number) => interpolate(t, [tBright, t3, t8, t15, tChest, tB31, tChoice, VOICE_END + TAIL], [0.02, 0.03, 0.08, 0.15, 0.2, 0.31, 0.36, 0.4],
  { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const batteryAt = (t: number) => (t < tBright ? 52 : t < tB31 ? 51 : 50);

/* Шёпот двумя голосами: из-за двери и из телефона (красная копия со сдвигом). */
const Echo: React.FC<{ text: string; k: number; top?: number }> = ({ text, k, top = 330 }) => (
  <div style={{ position: "absolute", left: 60, right: 60, top, textAlign: "center", opacity: k }}>
    <div style={{ position: "absolute", left: 0, right: 0, top: 6, transform: "translateX(10px)", fontFamily: "Caveat", fontWeight: 700, fontSize: 74, lineHeight: 1.05, color: "#FF6B5E", opacity: 0.55 }}>{text}</div>
    <div style={{ position: "relative", fontFamily: "Caveat", fontWeight: 700, fontSize: 74, lineHeight: 1.05, color: "#E6ECF5", textShadow: "0 0 18px rgba(0,0,0,.95)" }}>{text}</div>
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
  const calm = s === "ceiling" ? 0.3 : 1;
  const sx = calm * 6 * Math.sin(t * 0.9), sy = calm * 5 * Math.sin(t * 1.3 + 1), rot = calm * 0.35 * Math.sin(t * 0.7);
  const dip = Math.max(0, 1 - f / 0.18) * (s === "intro" ? 0 : 0.85);
  const showHud = !["triple", "choice", "voice"].includes(s);
  const voiceWave = [tV1, tV2, tV3].some((a) => t >= a && t < a + 1.4) ? 1 : 0.15;

  return (
    <AbsoluteFill style={{ backgroundColor: "#03040A", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) rotate(${rot}deg) scale(1.04)` }}>
        {/* 0. Ответ зрителей: рука отпускает цепочку */}
        {s === "intro" && (<>
          <DoorClose frame={frame} chain={0.6} zoom={1.08} />
          <div style={{ position: "absolute", inset: 0, background: "#000", opacity: 0.3 }} />
          <ChainHand frame={frame} reach={0.65 * (1 - sm(ramp(t, 0.3, 0.9)))} tremble={1} />
        </>)}
        {/* 1. Статус Лены и строки, которые пишутся сами */}
        {s === "status" && (<>
          <RoomDark horizon={1500} glow={{ x: 540, y: 700, r: 560, k: 0.45 }} />
          <PhoneInHands light={0.38} frame={frame}>
            <PhoneUI mode="neighbor" k={1} battery={batteryAt(t)} time={time} bright={0.45} scale={PHONE_SCALE} frame={frame}
              status="была в сети вчера в 21:17" statusHi={sm(ramp(t, tStatus + 0.5, 0.4))}
              lines={["Они прошли мимо меня и стоят у тебя.", "Не открывай никому."]}
              ghost={[...(t >= tG1 - 0.1 ? ["Ты уже проверил."] : []), ...(t >= tG2 - 0.1 ? ["Теперь оно знает."] : [])]}
              typing={t >= tNew && t < tG2 ? 1 : 0} />
          </PhoneInHands>
        </>)}
        {/* 2. Яркость растёт сама; палец жмёт блокировку — не работает */}
        {s === "bright" && (() => {
          const press = t >= tBtn + 0.1 && t < tBtn + 1.2 ? 1 : 0;
          const reach = sm(ramp(t, tBtn - 0.5, 0.45));
          const wr = pointWrist(780 - 8 * press * (Math.sin(frame) > 0 ? 1 : 0), 560, -25);
          return (<>
            <RoomDark horizon={1500} glow={{ x: 540, y: 700, r: 520 + 500 * b, k: 0.3 + 2.2 * b }} />
            <PhoneInHands light={0.32 + 1.2 * b} frame={frame} leftOnly shake={press}>
              <PhoneUI mode="brightness" k={1} battery={batteryAt(t)} time={time} bright={b} scale={PHONE_SCALE} />
            </PhoneInHands>
            {reach > 0 && <Layer><PovArm x={wr.x + (1 - reach) * 300} y={wr.y + (1 - reach) * 900} angle={-25} side="R" pose="point" light={0.32 + 1.2 * b} /></Layer>}
          </>);
        })()}
        {/* 3. К груди — свет сквозь пальцы */}
        {s === "chest" && <ChestGlow frame={frame} k={b} />}
        {/* 4. Окна напротив загораются, свет ползёт к твоему дому */}
        {s === "spread" && (
          <LightSpread frame={frame} lit={t < tThree ? 0 : t < tFive ? 3 : 5} floor={sm(ramp(t, tFloor, 0.5))}
            near={interpolate(t, [tFlow, tYours], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} edge={sm(ramp(t, tYours, 0.5))} />
        )}
        {/* 5. Джек вылезает и смотрит вверх */}
        {s === "dog" && <DogLookUp frame={frame} out={ramp(t, tJack + 0.2, 1.0)} up={sm(ramp(t, tUp - 0.3, 0.6))} />}
        {/* 6. Потолок: жёлтое пятно, шаги сверху */}
        {s === "ceiling" && <CeilingGlow frame={frame} glow={sm(ramp(t, tSpot, 1.0))} steps={ramp(t, tWalk, 0.3)} />}
        {/* 7. Голос из двух мест: слева дверь, справа телефон */}
        {s === "voice" && (<>
          <div style={{ position: "absolute", left: 0, top: 0, width: 540, height: 1920, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: -270, top: 0, width: 1080, height: 1920 }}><DoorClose frame={frame} chain={voiceWave > 0.5 ? 1 : 0.3} /></div>
          </div>
          <div style={{ position: "absolute", left: 540, top: 0, width: 540, height: 1920, overflow: "hidden", background: "#050608" }}>
            <div style={{ position: "absolute", left: -270, top: 0, width: 1080, height: 1920 }}>
              <PhoneUI mode="voice" k={1} battery={batteryAt(t)} time={time} bright={0.6} scale={0.85} wave={voiceWave} frame={frame} />
            </div>
          </div>
          <div style={{ position: "absolute", left: 536, top: 0, width: 8, height: 1920, background: SRYV.fail, opacity: 0.8 }} />
        </>)}
        {/* 8. Три экрана: дверь / потолок / телефон */}
        {(s === "triple" || s === "choice") && (<>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ position: "absolute", left: i * 360, top: 0, width: 360, height: 1920, overflow: "hidden", background: "#050608" }}>
              <div style={{ position: "absolute", left: -360, top: 0, width: 1080, height: 1920 }}>
                {i === 0 && <DoorClose frame={frame} chain={1} />}
                {i === 1 && <CeilingGlow frame={frame} glow={0.8 + 0.2 * Math.sin(frame / 6)} steps={1} />}
                {i === 2 && <PhoneUI mode="brightness" k={1} battery={batteryAt(t)} time={time} bright={b} scale={0.62} />}
              </div>
            </div>
          ))}
          {[358, 718].map((x) => <div key={x} style={{ position: "absolute", left: x, top: 0, width: 6, height: 1920, background: SRYV.fail, opacity: 0.7 }} />)}
          {s === "choice" && <div style={{ position: "absolute", inset: 0, background: "rgba(3,4,8,0.7)" }} />}
        </>)}
        <div style={{ position: "absolute", inset: 0, background: "#000", opacity: dip }} />
      </AbsoluteFill>

      {/* Ответ зрителей */}
      {s === "intro" && <Stamp k={ramp(t, 0.1, 0.3)} color={SRYV.screen} size={46}>ВЫ ВЫБРАЛИ:<br />ПРОВЕРИТЬ ТЕЛЕФОН</Stamp>}
      {s === "status" && <Stamp k={ramp(t, tNotHer, 0.25) * (1 - ramp(t, tNew - 0.2, 0.2))}>ПИШЕТ НЕ ОНА</Stamp>}
      {s === "status" && <Stamp k={ramp(t, tKnows + 0.3, 0.25)} color="#E8C547" top={290} size={40}>ПРАВИЛО №4<br />НЕ ПРОВЕРЯЙ, КТО ПИШЕТ</Stamp>}
      {s === "bright" && t >= tBtn + 0.3 && <Stamp k={ramp(t, tBtn + 0.3, 0.2)} size={40} top={1390}>🔒 НЕ РАБОТАЕТ</Stamp>}
      {s === "spread" && (
        <div style={{ position: "absolute", left: 90, right: 90, top: 300, display: "flex", alignItems: "center", gap: 14, fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 30, color: "#FFD27A" }}>
          <span>НАПРОТИВ</span>
          <div style={{ flex: 1, height: 14, borderRadius: 7, background: "#2B3241", overflow: "hidden" }}>
            <div style={{ width: `${Math.round(100 * interpolate(t, [tThree, tYours], [0.05, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))}%`, height: "100%", background: "#FFD27A" }} />
          </div>
          <span style={{ color: t >= tYours ? "#FF6B5E" : "#FFD27A" }}>ТВОЙ ДОМ</span>
        </div>
      )}
      {s === "ceiling" && <Stamp k={ramp(t, tFive2, 0.25)} color="#E8C547" top={330} size={50}>{t < tAttic - 0.1 ? "В ДОМЕ 5 ЭТАЖЕЙ" : "ВЫШЕ — ЧЕРДАК"}</Stamp>}
      {s === "voice" && (() => {
        const L: [string, number][] = [["«Зря проверил.", tV1], ["Теперь оно в сети.", tV2], ["А дверь — уже не самое страшное»", tV3]];
        const cur = L.filter(([, a]) => t >= a - 0.1).pop();
        return cur ? <Echo text={cur[0]} k={0.95 * ramp(t, cur[1] - 0.1, 0.4)} /> : null;
      })()}
      {s === "triple" && (
        <div style={{ position: "absolute", left: 720, width: 360, top: 1440, textAlign: "center", fontFamily: "Inter Display", fontWeight: 900, fontSize: 96, color: "#FF6B5E", textShadow: "0 0 24px rgba(229,57,53,.7)" }}>
          {Math.round(100 * b)}%↑
        </div>
      )}
      {s === "choice" && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 230, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
          {([["А", "РАЗБИТЬ ТЕЛЕФОН", "без связи, зато без света", SRYV.fail, tA], ["Б", "ВЫЙТИ С ФОНАРИКОМ", "проверить чердак", SRYV.lamp, tB],
            ["В", "СВЕЧА В УГЛУ", "ждать по правилам", "#C9D2E0", tC]] as const).map(([l, txt, sub, c, at]) => {
            const k = ramp(t, at - 0.3, 0.3);
            return (
              <div key={l} style={{ transform: `scale(${0.88 + 0.12 * k})`, opacity: 0.3 + 0.7 * k, width: 860, display: "flex", alignItems: "center", gap: 22, padding: "18px 24px",
                borderRadius: 22, border: `6px solid ${c}`, background: "rgba(10,12,18,.9)", boxShadow: `0 0 30px ${c}55` }}>
                <div style={{ width: 92, height: 92, borderRadius: 46, background: c, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter Display", fontWeight: 900, fontSize: 62, color: "#0A0C11" }}>{l}</div>
                <div>
                  <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: 54, color: "#FFFFFF", lineHeight: 1 }}>{txt}</div>
                  <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 28, color: "#9AA6BA", marginTop: 6 }}>{sub}</div>
                </div>
              </div>
            );
          })}
          <div style={{ opacity: ramp(t, tWrite, 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 40, color: "#E8C547", marginTop: 10 }}>ПИШИ БУКВУ ↓</div>
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
