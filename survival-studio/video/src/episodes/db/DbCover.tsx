import React from "react";
import { AbsoluteFill } from "remotion";
import { ANYA, Creature, DbDefs, Library, Person, Rings, sitPose, TapBucket } from "../../scenes/Db";
import { useFonts } from "../../useFonts";

/* Обложки «40 дБ»: 9:16 и 16:9, без субтитров. */
const Scene2: React.FC = () => {
  const frame = 40, GY = 1450;
  return (
    <g>
      <Library frame={frame}>
        <TapBucket x={600} y={GY} frame={frame} t={1} rate={2} stream={1} />
        <Person x={800} y={GY} s={2.0} look={ANYA} tremble={0} pose={sitPose(frame, { expr: { brow: 1, browTilt: 1, mouth: "o", blink: 0 } })} flip />
        <Rings x={640} y={GY - 30} db={41} age={0.5} scale={1.1} />
        <Rings x={640} y={GY - 30} db={41} age={1.2} label={false} scale={1.1} />
        <Creature x={70} y={GY + 160} s={1.2} frame={frame} turn={0.8} lean={1} flare={1} mouth={0.75} boil={false} />
      </Library>
    </g>
  );
};
export const Db2Cover: React.FC<{ wide?: boolean }> = ({ wide }) => {
  useFonts();
  const T: React.CSSProperties = { fontFamily: "Inter Display", fontWeight: 900, lineHeight: 1, textShadow: "0 0 30px #000, 0 6px 0 #000" };
  return (
    <AbsoluteFill style={{ background: "#05070B" }}>
      <svg viewBox="0 0 1080 1920" width={wide ? 640 : 1080} height={wide ? 1138 : 1920} style={{ position: "absolute", left: wide ? 0 : 0, top: wide ? -260 : 0, filter: "saturate(0.65)" }}>
        <DbDefs frame={40} />
        <g transform={wide ? "translate(-60 -40) scale(1.05)" : "translate(-20 40) scale(1.0)"}><Scene2 /></g>
        <rect x={0} y={0} width={1080} height={1920} fill="url(#dbVig)" />
      </svg>
      {!wide && (<>
        <div style={{ ...T, position: "absolute", left: 0, right: 0, top: 90, textAlign: "center", fontSize: 220, color: "#FF3B30" }}>40 дБ</div>
        <div style={{ ...T, position: "absolute", left: 0, right: 0, top: 330, textAlign: "center", fontSize: 46, color: "#F2C94C", fontFamily: "JetBrains Mono" }}>СЕРИЯ 2 · КАПЛЯ</div>
        <div style={{ ...T, position: "absolute", left: 60, right: 60, top: 1590, textAlign: "center", fontSize: 84, color: "#FFFFFF" }}>МОНСТР, КОТОРЫЙ</div>
        <div style={{ ...T, position: "absolute", left: 60, right: 60, top: 1690, textAlign: "center", fontSize: 92, color: "#FF3B30" }}>ИДЁТ НА ЗВУК</div>
      </>)}
      {wide && (<>
        <div style={{ ...T, position: "absolute", left: 660, top: 60, fontSize: 170, color: "#FF3B30" }}>40 дБ</div>
        <div style={{ ...T, position: "absolute", left: 670, top: 250, fontSize: 36, color: "#F2C94C", fontFamily: "JetBrains Mono" }}>СЕРИЯ 2 · КАПЛЯ</div>
        <div style={{ ...T, position: "absolute", left: 670, top: 340, fontSize: 64, color: "#FFFFFF" }}>Монстр, который</div>
        <div style={{ ...T, position: "absolute", left: 670, top: 420, fontSize: 64, color: "#FF3B30" }}>идёт на звук</div>
        <div style={{ ...T, position: "absolute", left: 670, top: 540, fontSize: 54, color: "#F2C94C" }}>41 дБ</div>
      </>)}
    </AbsoluteFill>
  );
};
