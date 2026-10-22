// Проверка расчёта по методике «Расчёт калорий и БЖУ». Запуск: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcNutrition, bmrMifflin, bmrKatch, bmrHarris, leanMass, goalPctOf, goalPctOptions,
  kcalFromMacros, forPortion, dishPer100,
} from "../src/nutrition.js";

const example = { sex: "m", age: 35, height: 180, weight: 85, activity: 1.55, goal: "fat", goalPct: 15, days: 3 };

test("пример из документа: 2380 ккал, Б 153 / Ж 76 / У 271", () => {
  const n = calcNutrition(example);
  assert.equal(n.bmr, 1805);
  assert.equal(Math.round(n.tdee / 10) * 10, 2800);
  assert.equal(n.kcal, 2380);
  assert.equal(n.protein, 153);
  assert.equal(n.fat, 76);
  assert.equal(n.carbs, 271);
  assert.equal(n.protein * 4 + n.fat * 9 + n.carbs * 4, 2380);
  assert.equal(n.formula, "mifflin");
  assert.equal(n.pct, -15);
});

test("формулы основного обмена", () => {
  assert.equal(bmrMifflin({ sex: "m", weight: 85, height: 180, age: 35 }), 1805);
  assert.equal(bmrMifflin({ sex: "f", weight: 60, height: 165, age: 30 }), 10 * 60 + 6.25 * 165 - 5 * 30 - 161);
  assert.equal(leanMass(85, 20), 68);
  assert.ok(Math.abs(bmrKatch(85, 20) - (370 + 21.6 * 68)) < 1e-9);
  assert.ok(Math.abs(bmrHarris({ sex: "m", weight: 85, height: 180, age: 35 }) - (88.36 + 13.4 * 85 + 4.8 * 180 - 5.68 * 35)) < 1e-9);
  assert.ok(Math.abs(bmrHarris({ sex: "f", weight: 60, height: 165, age: 30 }) - (447.59 + 9.25 * 60 + 3.1 * 165 - 4.33 * 30)) < 1e-9);
});

test("если известен процент жира — считаем по Кэтчу–Макардлу", () => {
  const n = calcNutrition({ ...example, bodyFat: 20 });
  assert.equal(n.formula, "katch");
  assert.equal(n.bmr, Math.round(370 + 21.6 * 68));
  assert.equal(n.mifflin, 1805);
});

test("поправка под цель", () => {
  const tdee = 1805 * 1.55;
  assert.equal(calcNutrition({ ...example, goal: "strength" }).kcal, Math.round(tdee / 10) * 10);
  assert.equal(calcNutrition({ ...example, goal: "endurance" }).pct, 0);
  assert.equal(calcNutrition({ ...example, goal: "mass", goalPct: 10 }).kcal, Math.round((tdee * 1.1) / 10) * 10);
  assert.equal(goalPctOf({ goal: "fat", age: 16, goalPct: 20 }), -10, "до 18 лет поправка не больше 10%");
  assert.equal(goalPctOf({ goal: "fat", age: 30, rate: 0.6 }), -15, "старый темп 0,6%/нед → дефицит 15%");
  assert.equal(goalPctOf({ goal: "mass", age: 30, rate: 0.25 }), 5);
  assert.deepEqual(goalPctOptions("fat", 16).map((o) => o[0]), [10]);
});

test("калорийность не опускается ниже основного обмена", () => {
  const p = { sex: "f", age: 25, height: 158, weight: 48, activity: 1.2, goal: "fat", goalPct: 20, days: 2 };
  const n = calcNutrition(p);
  assert.ok(n.kcal >= Math.max(n.bmr, 1200));
  assert.ok(n.floored);
});

test("жиры держатся в 20–35% калорийности, углеводы — остаток", () => {
  for (const w of [50, 70, 95, 120]) {
    const n = calcNutrition({ sex: "m", age: 30, height: 178, weight: w, activity: 1.375, goal: "mass", goalPct: 10, days: 3 });
    const share = (n.fat * 9) / n.kcal;
    assert.ok(share >= 0.195 && share <= 0.355, `вес ${w}: жиры ${Math.round(share * 100)}%`);
    assert.ok(Math.abs(n.protein * 4 + n.fat * 9 + n.carbs * 4 - n.kcal) <= 4);
  }
});

test("при ИМТ ≥ 30 белок и жиры считаются на целевой вес", () => {
  const n = calcNutrition({ sex: "m", age: 40, height: 175, weight: 120, activity: 1.375, goal: "fat", goalPct: 15, targetKg: 25, days: 3 });
  assert.equal(n.macroWeight, 95);
  assert.equal(n.protein, Math.round(95 * 1.8));
});

test("калорийность продукта и блюда по Атвотеру", () => {
  assert.equal(kcalFromMacros(10, 10, 10), 170);
  assert.equal(kcalFromMacros(0, 0, 0, 10), 70);
  assert.deepEqual(forPortion({ kcal: 200, p: 10, f: 5, c: 20 }, 150), { kcal: 300, p: 15, f: 7.5, c: 30 });
  const d = dishPer100([{ kcal: 313, p: 12.6, f: 3.3, c: 62.1, grams: 70 }, { kcal: 113, p: 23.6, f: 1.9, c: 0.4, grams: 150 }], 330);
  assert.ok(Math.abs(d.kcal - ((313 * 0.7 + 113 * 1.5) / 330) * 100) < 1e-9);
});
