import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Karaoke, Word } from "../../captions/Karaoke";
import data from "../../captions/svet3.words.json";
import { Grain } from "../../ui/Grain";
import { useFonts } from "../../useFonts";
import { SRYV } from "../../style/palette";
import { DoorClose, PhoneUI } from "../../scenes/Svet";
import { Attic, ButtonPhone, CeilingGlow, DogLookUp, HatchAbove, HatchBelow, LandingFloor, RoomDark, SmashFloor } from "../../scenes/SvetPov";
import { idxIn, merge, PHONE_SCALE, PhoneInHands, ramp, sm, Stamp, SvetHud, wordAt } from "./shared";

/*
 * «Оно идёт на свет». Серия 3 «Чердак» — ответ зрителей: разбить телефон. Вид от первого лица.
 */
export const FPS = 30;
const WORDS = (data as { words: Word[] }).words;
const VOICE_END = WORDS[WORDS.length - 1].end, TAIL = 1.6;
export const SVET3_FRAMES = Math.round((VOICE_END + TAIL) * FPS);
const W = wordAt(WORDS);
const CW = (() => {
  const out = WORDS.map((w) => ({ ...w }));
  merge(out, "три", 3, "03:44.");
  return out;
})();
const ACC: [string, number, "yellow" | "red"][] = [
  ["телефон.", 1, "yellow"], ["тишина.", 1, "red"], ["экран.", 2, "red"], ["своих.", 1, "yellow"], ["вниз.", 1, "red"],
  ["керосином.", 1, "yellow"], ["уехал.", 1, "yellow"], ["пламя.", 1, "yellow"], ["переписке».", 1, "red"], ["телефона.", 1, "red"],
  ["здесь.", 1, "red"], ["переноску.", 1, "red"],
];
const ACCENTS = Object.fromEntries(ACC.map(([w, n, c]) => [idxIn(CW, w, n), c]).filter(([i]) => (i as number) >= 0)) as Record<number, "yellow" | "red">;

/* ---------- Ключевые моменты ---------- */
const tHandle0 = W("ручка"), tChose = W("вы"), tHit = W("удар"), tFloor = W("пол."), tDark = W("темнота."), tHandle = W("ручка", 2),
  tSilence = W("за"), tShards = W("осколки"), tAbove = W("сверху"), tKnock = W("три", 2), tJack = W("джек"), tTake = W("берёшь"),
  tTorch = W("фонарик"), tWet = W("мокрые"), tHatch = W("чердачный"), tSmell = W("сверху", 2), tKolya = W("дядя"), tFire = W("огонь"),
  tAsk = W("спроси"), tPhone = W("его"), tBuzz = W("вздрагивает."), tFrom = W("от"), tBroken = W("разбитого"), tPlay = W("дядь"),
  tBelow = W("снизу"), tBang = W("стучат"), tYou = W("это", 2), tHere = W("только", 3), tJack2 = W("джек", 2), tChoice = W("что"),
  tA = W("спросишь"), tB = W("или"), tWrite = W("пиши."), tNext = W("следующая");

type Scene = "recapB" | "recapH" | "recapC" | "smash" | "handle" | "shards" | "knock" | "jack" | "landing" | "hatch" | "attic" | "phone" | "hatchUp" | "hide" | "choice";
const SCENES: [number, Scene][] = [
  [0, "recapB"], [tHandle0 - 0.1, "recapH"], [tChose - 0.1, "recapC"], [tHit - 0.1, "smash"], [tHandle - 0.1, "handle"], [tShards - 0.6, "shards"],
  [tAbove - 0.05, "knock"], [tJack - 0.1, "jack"], [tTake - 0.05, "landing"], [tHatch - 0.1, "hatch"], [tKolya - 0.1, "attic"], [tPhone - 0.05, "phone"],
  [tBelow - 0.1, "hatchUp"], [tJack2 - 0.1, "hide"], [tChoice - 0.1, "choice"],
];
const sceneAt = (t: number) => { let cur: Scene = "recapB", start = 0; for (const [a, s] of SCENES) if (t >= a) { cur = s; start = a; } return { s: cur, f: t - start }; };
const RECAP = new Set<Scene>(["recapB", "recapH", "recapC"]);
const minAt = (t: number) => Math.round(interpolate(t, [0, tTake, tKolya, tBelow, VOICE_END + TAIL], [44, 45, 46, 47, 48], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

export const Svet3: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  useFonts();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { s, f } = sceneAt(t);
  const m = minAt(t), dawnMin = 7 * 60 + 3 - (3 * 60 + m);
  const time = `03:${String(m).padStart(2, "0")}`, dawn = `${Math.floor(dawnMin / 60)}:${String(dawnMin % 60).padStart(2, "0")}`;
  const recap = RECAP.has(s);
  const impact = t >= tFloor ? Math.max(0, 1 - (t - tFloor) / 0.35) : 0;
  const knockShake = s === "knock" ? [0, 0.3, 0.6].reduce((a, d) => a + (t >= tKnock + d && t < tKnock + d + 0.15 ? 1 : 0), 0) : 0;
  const hatchShake = s === "hatchUp" && ((t >= tBang && t < tBang + 0.9) || (t >= W("дядь", 2) && t < W("дядь", 2) + 0.9)) ? 1 : 0;
  const shake = 14 * impact * Math.sin(frame * 3) + 9 * knockShake * Math.sin(frame * 3.3);
  const calm = ["handle", "hatchUp", "hide"].includes(s) ? 0.3 : 1;
  const sx = calm * 6 * Math.sin(t * 0.9) + shake, sy = calm * 5 * Math.sin(t * 1.3 + 1), rot = calm * 0.35 * Math.sin(t * 0.7);
  const dip = Math.max(0, 1 - f / 0.15) * (s === "recapB" || s === "smash" ? 0 : 0.85);
  const showHud = !recap && !["choice", "phone", "smash"].includes(s);
  const cell1 = 0.75 - 0.25 * ramp(t, tTorch, tHatch - tTorch);
  const talk = t >= tFire && t < tPhone ? 1 : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#03040A", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) rotate(${rot}deg) scale(1.04)`, filter: recap ? "grayscale(0.85) contrast(1.1) brightness(0.85)" : undefined }}>
        {/* ---- РАНЕЕ ---- */}
        {s === "recapB" && (<>
          <RoomDark horizon={1500} glow={{ x: 540, y: 700, r: 700, k: 0.9 }} />
          <PhoneInHands light={0.7} frame={frame} shake={1}>
            <PhoneUI mode="brightness" k={1} battery={50} time="03:44" bright={interpolate(t, [0, 3], [0.31, 0.4])} scale={PHONE_SCALE} />
          </PhoneInHands>
        </>)}
        {s === "recapH" && <DoorClose frame={frame} chain={1} handle={1} zoom={1.1} />}
        {s === "recapC" && (<>
          <RoomDark horizon={1500} glow={{ x: 540, y: 500, r: 700, k: 0.9 }} />
          <PhoneInHands light={0.7} frame={frame} dy={-260 * sm(ramp(t, tChose + 0.3, 0.8))} shake={1}>
            <PhoneUI mode="brightness" k={1} battery={50} time="03:44" bright={0.4} scale={PHONE_SCALE} />
          </PhoneInHands>
        </>)}
        {/* ---- 1. Удар об пол, трещины, темнота ---- */}
        {s === "smash" && (t < tFloor
          ? (<>
            <RoomDark horizon={900} glow={{ x: 540, y: 1100, r: 700, k: 0.8 }} />
            <div style={{ position: "absolute", inset: 0, transform: `translateY(${interpolate(t, [tHit, tFloor], [-400, 700])}px) rotate(${interpolate(t, [tHit, tFloor], [0, 40])}deg) scale(${interpolate(t, [tHit, tFloor], [1, 0.6])})` }}>
              <PhoneUI mode="brightness" k={1} battery={50} time="03:44" bright={0.45} scale={0.7} />
            </div>
          </>)
          : <SmashFloor frame={frame} crack={sm(ramp(t, tFloor, 0.35))} glow={interpolate(t, [tFloor, tDark - 0.2, tDark + 0.3], [0.8, 0.5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} shards={0} />)}
        {/* ---- 2. Ручка поднимается, тишина ---- */}
        {s === "handle" && (<>
          <DoorClose frame={frame} chain={0.15} handle={1 - sm(ramp(t, tHandle + 0.3, 2.0))} zoom={1.12} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 62% 42%, rgba(0,0,0,0) 15%, rgba(0,0,0,.85) 60%)" }} />
        </>)}
        {/* ---- 3. Осколки светятся сами ---- */}
        {s === "shards" && <SmashFloor frame={frame} crack={1} glow={0.25 * ramp(t, tShards, 1)} shards={ramp(t, tShards, 2.4)} />}
        {/* ---- 4. Три стука сверху, Джек виляет хвостом ---- */}
        {s === "knock" && <CeilingGlow frame={frame} glow={0.15} steps={knockShake > 0 ? 1 : 0.2} />}
        {s === "jack" && <DogLookUp frame={frame} out={1} up={1} wag={1} />}
        {/* ---- 5. Площадка, мокрые следы вниз ---- */}
        {s === "landing" && <LandingFloor frame={frame} on={ramp(t, tTorch, 0.15)} follow={interpolate(t, [tWet, tHatch], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />}
        {/* ---- 6. Лаз открыт, тёплый свет ---- */}
        {s === "hatch" && <HatchBelow frame={frame} open={1} glow={sm(ramp(t, tSmell - 0.3, 0.8))} />}
        {/* ---- 7. Дядя Коля ---- */}
        {s === "attic" && <Attic frame={frame} talk={talk} zoom={1 + 0.15 * sm(ramp(t, tFire, 6))} />}
        {/* ---- 8. Кнопочная трубка: сообщение от тебя ---- */}
        {s === "phone" && (<>
          <Attic frame={frame} talk={0} zoom={1.25} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)" }} />
          <ButtonPhone frame={frame} k={ramp(t, tPhone, 0.3)} buzz={t >= tBuzz && t < tBuzz + 0.9 ? 1 : 0} play={t >= tPlay && t < tBelow ? 1 : 0}
            lines={[...(t >= tFrom ? ["ОТ: ТЫ (5 эт.)"] : []), ...(t >= tPlay ? ["«Дядь Коль, открой, это я»"] : [])]} />
        </>)}
        {/* ---- 9. Стук в крышку снизу ---- */}
        {(s === "hatchUp" || s === "choice") && <HatchAbove frame={frame} knock={hatchShake} />}
        {/* ---- 10. Джек прячется за переноску ---- */}
        {s === "hide" && <Attic frame={frame} talk={0} zoom={1.05} jack={sm(ramp(t, W("забивается") - 0.3, 1.0))} />}
        {s === "choice" && <div style={{ position: "absolute", inset: 0, background: "rgba(3,4,8,0.7)" }} />}
        <div style={{ position: "absolute", inset: 0, background: "#000", opacity: dip }} />
        <div style={{ position: "absolute", inset: 0, background: "#EAF2FF", opacity: 0.85 * impact }} />
      </AbsoluteFill>

      {recap && (<>
        <div style={{ position: "absolute", left: 60, top: 80, padding: "8px 20px", borderRadius: 10, background: "rgba(10,12,18,.85)", border: "4px solid #9AA6BA",
          fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 34, color: "#FFFFFF", letterSpacing: 4 }}>РАНЕЕ</div>
        {s === "recapC" && <Stamp k={ramp(t, tChose + 0.2, 0.25)} color={SRYV.fail} size={46}>ВЫ ВЫБРАЛИ:<br />РАЗБИТЬ ТЕЛЕФОН</Stamp>}
      </>)}
      {s === "handle" && <Stamp k={ramp(t, tSilence + 0.3, 0.25)} color="#9AA6BA" top={330} size={48}>ТИШИНА</Stamp>}
      {s === "jack" && <Stamp k={ramp(t, W("так"), 0.25)} color="#3DDC84" top={330} size={42}>ХВОСТ = СВОЙ</Stamp>}
      {s === "attic" && t < tFire && <Stamp k={ramp(t, tKolya + 0.2, 0.25)} color="#FFB45A" top={330} size={44}>ДЯДЯ КОЛЯ · 5 ЭТ.</Stamp>}
      {s === "attic" && t >= tFire && <Stamp k={ramp(t, t >= tAsk ? tAsk : tFire, 0.25)} color="#E8C547" top={300} size={40}>
        {t < tAsk ? <>ПРАВИЛО №5<br />ОГОНЬ МОЖНО</> : <>ПРАВИЛО №6<br />СПРОСИ ТО, ЧЕГО НЕТ В ПЕРЕПИСКЕ</>}
      </Stamp>}
      {s === "phone" && t >= tBroken && <Stamp k={ramp(t, tBroken, 0.25)} top={110} size={44}>ТВОЙ ТЕЛЕФОН РАЗБИТ</Stamp>}
      {s === "hatchUp" && t >= tYou && <Stamp k={ramp(t, tYou, 0.25)} size={64}>{t < tHere ? "ЭТО ТЫ?" : "ТЫ — ЗДЕСЬ"}</Stamp>}
      {s === "choice" && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 260, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          {([["СПРОСИТЬ ЧЕРЕЗ КРЫШКУ", "то, чего нет в переписке", "#E8C547", tA], ["ПОГАСИТЬ ЛАМПУ", "и замереть в темноте", "#9AA6BA", tB]] as const).map(([txt, sub, c, at], i) => {
            const k = ramp(t, at - 0.3, 0.3);
            return (
              <React.Fragment key={txt}>
                {i === 1 && <div style={{ opacity: k, fontFamily: "Inter Display", fontWeight: 900, fontSize: 46, color: "#C9D2E0" }}>ИЛИ</div>}
                <div style={{ transform: `scale(${0.88 + 0.12 * k})`, opacity: 0.25 + 0.75 * k, width: 900, textAlign: "center", padding: "24px 20px",
                  borderRadius: 24, border: `6px solid ${c}`, background: "rgba(10,12,18,.92)", boxShadow: `0 0 34px ${c}55` }}>
                  <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: 60, color: "#FFFFFF", lineHeight: 1 }}>{txt}</div>
                  <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 30, color: "#9AA6BA", marginTop: 8 }}>{sub}</div>
                </div>
              </React.Fragment>
            );
          })}
          <div style={{ opacity: ramp(t, tWrite, 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 40, color: "#E8C547", marginTop: 6 }}>ПИШИ В КОММЕНТАРИЯХ ↓</div>
          <div style={{ opacity: ramp(t, tNext, 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 32, color: "#C9D2E0" }}>СЕРИЯ 4 — С ТВОЕГО ОТВЕТА</div>
        </div>
      )}
      {showHud && <SvetHud time={time} dawn={dawn} cells={[Math.max(0, cell1), 1, 1]} battery={t < tFloor ? 50 : "✕"} />}
      <Karaoke words={CW} accents={ACCENTS} pendingColor="#C3C8D2" />
      <Grain />
      {withAudio && <Audio src={staticFile("audio/svet3_mix.wav")} />}
    </AbsoluteFill>
  );
};
