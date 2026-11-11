// Выгружает статичные SVG героя и собаки в channel/hero и channel/dog: npx tsx scripts/export-rigs.tsx
import React from "react";
// @ts-ignore — типы react-dom/server не нужны для утилиты
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "fs";
import { Hero, NEUTRAL } from "../src/rig/Hero";
import { HeroFrontal } from "../src/rig/HeroViews";
import { Dog, DOG_STAND, dogSit } from "../src/rig/Dog";
import { RimDefs } from "../src/rig/shared";
const out = new URL("../../channel/", "file://" + __filename).pathname;
const svg = (vb: string, el: React.ReactElement) =>
  '<?xml version="1.0" encoding="UTF-8"?>\n' + renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" viewBox={vb}><RimDefs id="rim" side={-1} />{el}</svg>);
writeFileSync(out + "hero/hero_profile.svg", svg("-110 -360 240 380", <Hero pose={NEUTRAL} rimFilter="rim" />));
writeFileSync(out + "hero/hero_profile_sport.svg", svg("-110 -360 240 380", <Hero pose={NEUTRAL} outfit="sport" rimFilter="rim" />));
writeFileSync(out + "hero/hero_front.svg", svg("-110 -360 220 380", <HeroFrontal rimFilter="rim" />));
writeFileSync(out + "hero/hero_three_quarter.svg", svg("-110 -360 240 380", <HeroFrontal turn={1} rimFilter="rim" />));
writeFileSync(out + "dog/luna_profile.svg", svg("-100 -170 260 190", <Dog pose={DOG_STAND} rimFilter="rim" />));
writeFileSync(out + "dog/luna_sit_leash.svg", svg("-120 -200 260 220", <Dog pose={dogSit(0)} rimFilter="rim" />));
console.log("svg ok");
