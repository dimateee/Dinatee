import { AbsoluteFill, useCurrentFrame } from "remotion";
import { RoomMorning, RoomNight } from "../scenes/Rooms";
import { Leader, Plate, ServiceLabel } from "../ui/Hud";
import { Grain } from "../ui/Grain";
import { useFonts } from "../useFonts";

// Пробные кадры серии 1080×1920: «Режим» (утро) и «Срыв» (ночь).
export const TestFrame: React.FC<{ variant: "regime" | "sryv" }> = ({ variant }) => {
  useFonts();
  const frame = useCurrentFrame();
  if (variant === "regime") {
    return (
      <AbsoluteFill>
        <RoomMorning frame={frame} />
        <ServiceLabel x={64} y={110} text="ДЕНЬ 5 — СНОВА" color="#3B3D24" bg="rgba(246,242,231,0.9)" />
        <Leader from={[840, 262]} to={[790, 800]} kind="good" />
        <Plate x={560} y={150} kind="good" icon="paw" title="Луна" sub="07:00 каждый день" dark={false} />
        <Grain />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <RoomNight frame={frame} />
      <ServiceLabel x={64} y={110} text="ДЕНЬ 4 — 01:47" color="#FFFFFF" />
      <Leader from={[200, 380]} to={[200, 860]} kind="bad" />
      <Plate x={64} y={240} kind="bad" icon="warn" title="Срыв" sub="день 4" />
      <Grain />
    </AbsoluteFill>
  );
};
