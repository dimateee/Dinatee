/* Реестр предметов ОГЭ. Математика — с официальной шкалой и второй частью,
   остальные — с мини-тестом и ориентировочной оценкой */
import { TOPICS as MATH_TOPICS, makeVariant as makeMathVariant, gradeOf as mathGrade } from "../oge.js";
import { shuffle } from "../../lib/math.js";
import { PHYSICS } from "./physics.js";
import { INFORMATICS } from "./informatics.js";
import { RUSSIAN } from "./russian.js";
import { CHEMISTRY } from "./chemistry.js";
import { BIOLOGY } from "./biology.js";
import { HISTORY } from "./history.js";
import { SOCIAL } from "./social.js";

const TEST_SIZE = 12;

// Мини-тест: задания из всех тем по кругу
function makeTest(subject) {
  const order = shuffle(subject.topics);
  return Array.from({ length: TEST_SIZE }, (_, i) => {
    const t = order[i % order.length];
    return { ...t.gen(), num: i + 1, topic: t.id, geometry: false };
  });
}

// Ориентировочная оценка по доле верных ответов (у каждого предмета своя официальная шкала с частью 2)
function percentGrade(marks) {
  const score = marks.filter(Boolean).length;
  const p = score / marks.length;
  return { score, grade: p >= 0.85 ? 5 : p >= 0.65 ? 4 : p >= 0.45 ? 3 : 2 };
}

const MATH = {
  id: "math", title: "Математика", short: "Математика", emoji: "📐", color: "#3D6BFF", reshu: "https://math-oge.sdamgia.ru/",
  topics: MATH_TOPICS,
  hasPart2: true,
  makeTest: makeMathVariant,
  grade(marks, tasks) {
    const score = marks.filter(Boolean).length;
    const geometry = tasks.filter((t, i) => t.geometry && marks[i]).length;
    return { score, geometry, grade: mathGrade(score, geometry) };
  },
  testTitle: "Пробный вариант, часть 1",
  testInfo: "Задания 1–19 · оценка по шкале ФИПИ",
  testSeconds: 90 * 60,
};

const withTest = (s) => ({
  ...s,
  hasPart2: false,
  makeTest: () => makeTest(s),
  grade: (marks) => percentGrade(marks),
  testTitle: "Мини-тест",
  testInfo: `${TEST_SIZE} заданий по всем темам · ориентировочная оценка`,
  testSeconds: 20 * 60,
});

export const SUBJECTS = [MATH, ...[RUSSIAN, PHYSICS, INFORMATICS, CHEMISTRY, BIOLOGY, HISTORY, SOCIAL].map(withTest)];
export const REQUIRED = ["math", "rus"];

export const subjectById = (id) => SUBJECTS.find((s) => s.id === id) || MATH;
const ALL_TOPICS = SUBJECTS.flatMap((s) => s.topics.map((t) => ({ ...t, subject: s.id })));
export const topicById = (id) => ALL_TOPICS.find((t) => t.id === id);
export const subjectOfTopic = (id) => topicById(id)?.subject || "math";
export const topicLabel = (t) => (t.num ? `№${t.num}` : t.tag);
export const allTopics = () => ALL_TOPICS;
