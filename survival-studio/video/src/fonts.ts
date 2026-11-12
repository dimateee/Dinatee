import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Все шрифты канала (из survival-studio/fonts, кириллица проверена).
const FONTS = [
  { family: "Inter Display", file: "InterDisplay-Black.ttf", weight: "900" },
  { family: "Inter Display", file: "InterDisplay-ExtraBold.ttf", weight: "800" },
  { family: "Montserrat", file: "Montserrat-ExtraBold.ttf", weight: "800" },
  { family: "Montserrat", file: "Montserrat-Black.ttf", weight: "900" },
  { family: "Oswald", file: "Oswald-Bold.ttf", weight: "700" },
  { family: "Oswald", file: "Oswald-SemiBold.ttf", weight: "600" },
  { family: "JetBrains Mono", file: "JetBrainsMono-Regular.ttf", weight: "400" },
  { family: "JetBrains Mono", file: "JetBrainsMono-Bold.ttf", weight: "700" },
  { family: "Caveat", file: "Caveat-Bold.ttf", weight: "700" },
] as const;

export const fontsReady = Promise.all(
  FONTS.map((f) =>
    loadFont({ family: f.family, url: staticFile(`fonts/${f.file}`), weight: f.weight }),
  ),
);
