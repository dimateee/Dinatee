/* Проверенные источники для подготовки. Задания из них не копируются в приложение:
   у сайтов свои права на материалы, поэтому даём прямые ссылки — они открываются в браузере Telegram. */

export const SOURCES = [
  {
    id: "fipi-bank", title: "Открытый банк заданий ФИПИ", emoji: "🏛️",
    text: "Официальные задания ОГЭ от разработчиков экзамена. Именно из таких заданий собирают настоящие варианты.",
    url: "https://oge.fipi.ru/bank/index.php?proj=DE0E276E497AB3784C3FC4CC20248DC0",
  },
  {
    id: "fipi-demo", title: "Демоверсия, спецификация, кодификатор", emoji: "📄",
    text: "Как устроен экзамен в этом году: какие задания, сколько баллов, сколько времени.",
    url: "https://fipi.ru/oge/demoversii-specifikacii-kodifikatory",
  },
  {
    id: "fipi-navigator", title: "Навигатор подготовки ФИПИ", emoji: "🧭",
    text: "Методические рекомендации ФИПИ: типичные ошибки прошлых лет и на что обратить внимание.",
    url: "https://fipi.ru/navigator-podgotovki/navigator-oge",
  },
  {
    id: "reshu", title: "РешуОГЭ — каталог заданий", emoji: "📚",
    text: "Задания из банка ФИПИ, сгруппированные по номерам и темам, с решениями.",
    url: "https://math-oge.sdamgia.ru/prob_catalog",
  },
  {
    id: "reshu-variants", title: "РешуОГЭ — тренировочные варианты", emoji: "📝",
    text: "Полные варианты с автоматической проверкой первой части.",
    url: "https://math-oge.sdamgia.ru/",
  },
  {
    id: "resh", title: "Российская электронная школа", emoji: "🎓",
    text: "Бесплатные видеоуроки по всем школьным предметам — если тема совсем забылась.",
    url: "https://resh.edu.ru/",
  },
];

export const SCALE_NOTE = "Шкала по рекомендации ФИПИ: максимум 31 балл. «3» — от 8 баллов, «4» — от 15, «5» — от 22, причём не меньше 2 баллов должно быть за геометрию (задания 15–19 и 23–25). Регион может немного изменить шкалу.";

// Источники для конкретного предмета: банк ФИПИ и РешуОГЭ по этому предмету
export function subjectSources(subject) {
  if (subject.id === "math") return SOURCES.filter((s) => ["fipi-bank", "reshu", "reshu-variants"].includes(s.id));
  return [
    { id: "fipi-bank", title: "Открытый банк заданий ФИПИ", emoji: "🏛️", text: `Официальные задания ОГЭ. Выбери предмет «${subject.title}» в списке.`, url: "https://oge.fipi.ru/bank/" },
    { id: "reshu", title: `РешуОГЭ — ${subject.title.toLowerCase()}`, emoji: "📚", text: "Задания по темам с решениями и тренировочные варианты.", url: `${subject.reshu}prob_catalog` },
    { id: "reshu-variants", title: "РешуОГЭ — варианты", emoji: "📝", text: "Полные варианты с проверкой.", url: subject.reshu },
  ];
}
