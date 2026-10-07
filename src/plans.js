// Цены и бесплатные лимиты — общие для приложения (src/App.jsx) и лендинга (src/Landing.jsx),
// чтобы цифры на сайте никогда не разъехались с тем, что реально ограничено в приложении.
// Цена, которая реально списывается, задаётся на сервере: PLANS в netlify/lib/platega.mjs —
// если меняешь RUB_PRICE здесь, поменяй и там.
export const RUB_PRICE = { month: 150, year: 1200 }; // ₽ за месяц и за год
// Сколько дешевле годовой план в пересчёте на месяц — показываем бейджем на кнопке плана.
export const YEAR_SAVINGS_PCT = Math.round((1 - RUB_PRICE.year / 12 / RUB_PRICE.month) * 100);

export const FREE_SCANS = 2; // фото еды по ИИ в день
export const FREE_HABITS = 2; // сколько привычек в трекере можно вести без Pro
export const FREE_WORKOUTS = 1; // сколько своих тренировок можно создать без Pro
export const FREE_HISTORY = 2; // сколько последних записей истории упражнения видно без Pro
export const FREE_ASSISTANT = 6; // сколько вопросов голосовому помощнику можно задать в день без Pro

// Сравнение Free/Pro — на экране оплаты в приложении и в разделе цен на сайте
export const PRO_COMPARISON_ROWS = [
  ["Фото еды по ИИ", `${FREE_SCANS}/день`, "Без лимита"],
  ["Рецепты от ИИ", "—", "Под остаток дня"],
  ["Голосовой помощник", `${FREE_ASSISTANT}/день`, "Без лимита"],
  ["Статистика", "Сегодня", "7 дней + ИИ-разбор"],
  ["Привычки в трекере", `${FREE_HABITS}`, "Без лимита"],
  ["Свои тренировки", `${FREE_WORKOUTS}`, "Без лимита"],
  ["История упражнения", `${FREE_HISTORY} записи`, "Полная"],
  ["Беговой план", "1-я неделя", "Все недели"],
];

// Документы — страницы самого сайта (public/legal), короткие адреса настроены в public/_redirects
export const LEGAL_LINKS = {
  support: "@doltiii",
  supportUrl: "https://t.me/doltiii",
  email: "dimatdt2011@gmail.com",
  offerUrl: "/offer",
  termsUrl: "/terms",
  privacyUrl: "/privacy",
  consentUrl: "/consent",
  // Реквизиты исполнителя — обязательны для оферты, показываются в подвале сайта
  owner: "Тюнин Дмитрий Павлович",
  status: "самозанятый",
  inn: "770474740103",
};
