// Все игровые определения и баланс в одном месте.
// Время: 1 игровой час = TPH тиков, при скорости ×1 идёт BASE_TPS тиков в секунду.

export const MAP_SIZE = 80;
export const TPH = 100;
export const TPD = TPH * 24;
export const DAYS_PER_SEASON = 10;
export const DAYS_PER_YEAR = 40;
export const BASE_TPS = 20;
export const SPEEDS = [0, 1, 2, 4];
export const SEASONS = ["Весна", "Лето", "Осень", "Зима"];
export const CARRY_CAP = 75;
export const START_HOUR = 7;

// ---------- Местность ----------
export const TR = { GRASS: 0, SOIL: 1, RICH: 2, SAND: 3, GRAVEL: 4, MUD: 5, SHALLOW: 6, DEEP: 7, ROCKFLOOR: 8 };
export const TERRAIN = [
  { id: "grass", name: "Трава", fert: 1.0, cost: 1 },
  { id: "soil", name: "Почва", fert: 1.0, cost: 1 },
  { id: "rich", name: "Плодородная почва", fert: 1.4, cost: 1 },
  { id: "sand", name: "Песок", fert: 0.1, cost: 1.3 },
  { id: "gravel", name: "Гравий", fert: 0.7, cost: 1.1 },
  { id: "mud", name: "Грязь", fert: 0, cost: 2 },
  { id: "shallow", name: "Мелководье", fert: 0, cost: 3, water: true },
  { id: "deep", name: "Глубокая вода", fert: 0, cost: 0, water: true },
  { id: "rockfloor", name: "Грубый камень", fert: 0, cost: 1 },
];

export const FLOORS = [
  null,
  { id: "wood", name: "Деревянный пол", cost: 0.85, beauty: 1 },
  { id: "stone", name: "Каменная плитка", cost: 0.8, beauty: 2 },
];

// Скальные породы (непроходимые клетки гор)
export const ROCKS = [
  null,
  { id: "granite", name: "Гранит", work: 130, drop: "stone", amount: 12 },
  { id: "steel", name: "Залежь стали", work: 170, drop: "steel", amount: 30 },
  { id: "silver", name: "Залежь серебра", work: 170, drop: "silver", amount: 45 },
  { id: "machinery", name: "Старые механизмы", work: 190, drop: "components", amount: 3 },
];

// ---------- Растения ----------
export const PLANTS = [
  null,
  { id: "grass", name: "Дикая трава", wild: true, small: true, grow: 2, cut: 8 },
  { id: "tree", name: "Дуб", wild: true, tree: true, grow: 24, cut: 90, yield: { wood: 25 }, minTemp: -2 },
  { id: "pine", name: "Сосна", wild: true, tree: true, grow: 20, cut: 80, yield: { wood: 20 }, minTemp: -20 },
  { id: "bush", name: "Ягодный куст", wild: true, grow: 7, cut: 25, harvest: { berries: 10 }, regrow: 0.35 },
  { id: "rice", name: "Рис", crop: true, grow: 3, sow: 22, cut: 22, harvest: { rice: 8 } },
  { id: "potato", name: "Картофель", crop: true, grow: 5, sow: 26, cut: 26, harvest: { potato: 12 }, minFert: 0.7 },
  { id: "corn", name: "Кукуруза", crop: true, grow: 9, sow: 30, cut: 30, harvest: { corn: 24 }, research: "agriculture" },
  { id: "healroot", name: "Целебный корень", crop: true, grow: 7, sow: 32, cut: 32, harvest: { medicine: 2 }, research: "herbalism" },
];
export const PLANT = {};
PLANTS.forEach((p, i) => { if (p) PLANT[p.id] = i; });
export const CROPS = ["rice", "potato", "corn", "healroot"];

// ---------- Предметы ----------
export const ITEM_CATS = {
  mat: "Материалы",
  raw: "Сырая еда",
  meal: "Готовая еда",
  med: "Лекарства",
  weapon: "Оружие",
  misc: "Ценности",
};
export const ITEMS = {
  wood: { name: "Дерево", stack: 75, cat: "mat", value: 1.2 },
  stone: { name: "Камень", stack: 75, cat: "mat", value: 0.6 },
  steel: { name: "Сталь", stack: 75, cat: "mat", value: 1.9 },
  components: { name: "Компоненты", stack: 25, cat: "mat", value: 32 },
  silver: { name: "Серебро", stack: 500, cat: "misc", value: 1 },
  berries: { name: "Ягоды", stack: 75, cat: "raw", nut: 0.05, value: 1.5 },
  meat: { name: "Мясо", stack: 75, cat: "raw", nut: 0.05, value: 1.8 },
  rice: { name: "Рис", stack: 75, cat: "raw", nut: 0.05, value: 1.1 },
  potato: { name: "Картофель", stack: 75, cat: "raw", nut: 0.05, value: 1.1 },
  corn: { name: "Кукуруза", stack: 75, cat: "raw", nut: 0.05, value: 1.1 },
  ration: { name: "Сухпаёк", stack: 10, cat: "meal", nut: 0.9, value: 18 },
  meal: { name: "Простая еда", stack: 10, cat: "meal", nut: 0.9, value: 15 },
  finemeal: { name: "Хорошая еда", stack: 10, cat: "meal", nut: 1.0, value: 24, fine: true },
  medicine: { name: "Лекарство", stack: 25, cat: "med", value: 18 },
};

// ---------- Оружие ----------
export const WEAPONS = {
  fists: { name: "Кулаки", melee: true, dmg: 5, cd: 30, value: 0 },
  knife: { name: "Нож", melee: true, dmg: 8, cd: 28, value: 40 },
  club: { name: "Дубина", melee: true, dmg: 9, cd: 36, value: 25 },
  spear: { name: "Копьё", melee: true, dmg: 12, cd: 42, value: 70 },
  bow: { name: "Лук", range: 11, dmg: 10, cd: 42, acc: 0.7, value: 60 },
  pistol: { name: "Револьвер", range: 10, dmg: 11, cd: 28, acc: 0.75, value: 120 },
  rifle: { name: "Винтовка", range: 15, dmg: 16, cd: 44, acc: 0.85, value: 200 },
  smg: { name: "Автомат", range: 9, dmg: 7, cd: 13, acc: 0.6, value: 260 },
};
// Оружие как предмет на карте
for (const [id, w] of Object.entries(WEAPONS)) {
  if (id === "fists") continue;
  ITEMS["w_" + id] = { name: w.name, stack: 1, cat: "weapon", value: w.value, weapon: id };
}

// ---------- Постройки ----------
// drag: outline — контур прямоугольника, fill — заливка, line — линия, single — по одной
export const BUILD_CATS = [
  { id: "struct", name: "Стены" },
  { id: "furn", name: "Мебель" },
  { id: "prod", name: "Производство" },
  { id: "temp", name: "Тепло и свет" },
  { id: "sec", name: "Оборона" },
  { id: "floor", name: "Полы" },
];
export const BUILDINGS = {
  wall_wood: { name: "Деревянная стена", cat: "struct", cost: { wood: 5 }, work: 55, hp: 160, solid: true, wall: true, drag: "outline", desc: "Дешёвая стена. Горит, но строится быстро." },
  wall_stone: { name: "Каменная стена", cat: "struct", cost: { stone: 5 }, work: 110, hp: 360, solid: true, wall: true, drag: "outline", research: "masonry", desc: "Прочная стена из камня." },
  door: { name: "Дверь", cat: "struct", cost: { wood: 6 }, work: 60, hp: 140, door: true, drag: "single", desc: "Колонисты проходят, животные и враги — нет." },
  bed: { name: "Кровать", cat: "furn", cost: { wood: 25 }, work: 80, hp: 100, bed: true, drag: "single", passCost: 1.6, desc: "Хорошо выспаться — залог хорошего настроения." },
  table: { name: "Стол", cat: "furn", cost: { wood: 20 }, work: 65, hp: 100, table: true, drag: "single", passCost: 2, desc: "Есть за столом приятнее, чем на полу." },
  campfire: { name: "Костёр", cat: "prod", cost: { wood: 15 }, work: 40, hp: 80, bench: "cook", recipes: ["meal"], heat: 22, light: 6, fuel: { max: 40, perHour: 0.9 }, drag: "single", passCost: 2, desc: "Готовка простой еды, свет и тепло. Нужны дрова." },
  stove: { name: "Кухонная плита", cat: "prod", cost: { steel: 40, stone: 20 }, work: 130, hp: 160, bench: "cook", recipes: ["meal", "finemeal"], heat: 6, light: 2, fuel: { max: 50, perHour: 0.5 }, solid: true, drag: "single", research: "cooking", speed: 1.5, desc: "Готовит быстрее и умеет хорошую еду." },
  research: { name: "Стол учёного", cat: "prod", cost: { wood: 40, steel: 15 }, work: 120, hp: 120, bench: "research", solid: true, drag: "single", desc: "Здесь колонисты изучают новые технологии." },
  torch: { name: "Факел", cat: "temp", cost: { wood: 4 }, work: 15, hp: 40, light: 6, heat: 2, drag: "single", desc: "Освещает территорию ночью." },
  heater: { name: "Дровяная печь", cat: "temp", cost: { stone: 30, steel: 15 }, work: 110, hp: 200, heat: 60, light: 3, fuel: { max: 60, perHour: 1.4 }, solid: true, drag: "single", research: "heating", desc: "Сильно греет комнату. Можно выключать летом." },
  sandbags: { name: "Мешки с песком", cat: "sec", cost: { stone: 4 }, work: 30, hp: 200, cover: 0.55, passCost: 3, drag: "line", desc: "Укрытие: в стоящих за ними сложнее попасть." },
  turret: { name: "Турель", cat: "sec", cost: { steel: 70, components: 3 }, work: 220, hp: 220, solid: true, turret: { range: 15, dmg: 11, cd: 38, acc: 0.8 }, drag: "single", research: "defense", desc: "Сама стреляет по врагам. Сломанную нужно чинить." },
  floor_wood: { name: "Деревянный пол", cat: "floor", cost: { wood: 2 }, work: 18, floor: 1, drag: "fill", desc: "Красиво, и ходить чуть быстрее." },
  floor_stone: { name: "Каменная плитка", cat: "floor", cost: { stone: 3 }, work: 32, floor: 2, drag: "fill", research: "masonry", desc: "Самый красивый пол." },
};

export const RECIPES = {
  meal: { name: "Простая еда", raw: 10, out: "meal", work: 70 },
  finemeal: { name: "Хорошая еда", raw: 16, out: "finemeal", work: 110 },
};

// ---------- Исследования ----------
export const RESEARCH = {
  masonry: { name: "Каменная кладка", cost: 260, desc: "Каменные стены и каменная плитка." },
  agriculture: { name: "Агрономия", cost: 300, desc: "Кукуруза — медленная, но очень урожайная культура." },
  herbalism: { name: "Травничество", cost: 320, desc: "Целебный корень для лекарств и лучшее лечение." },
  cooking: { name: "Кулинария", cost: 420, desc: "Кухонная плита и хорошая еда (+настроение)." },
  heating: { name: "Отопление", cost: 380, desc: "Дровяная печь, чтобы пережить зиму." },
  defense: { name: "Оборона", cost: 650, desc: "Автоматическая турель.", req: ["masonry"] },
};

// ---------- Животные ----------
export const ANIMALS = {
  hare: { name: "Заяц", hp: 22, speed: 0.2, meat: 10, size: 0.42, retaliate: 0, dmg: 3, color: "#a99a84" },
  deer: { name: "Олень", hp: 60, speed: 0.22, meat: 35, size: 0.78, retaliate: 0.08, dmg: 8, color: "#8d5b30" },
  boar: { name: "Кабан", hp: 75, speed: 0.17, meat: 30, size: 0.66, retaliate: 0.55, dmg: 10, color: "#4b3a2b" },
  wolf: { name: "Волк", hp: 55, speed: 0.24, meat: 20, size: 0.62, retaliate: 0.85, dmg: 11, color: "#7a7670" },
  bear: { name: "Медведь", hp: 150, speed: 0.19, meat: 60, size: 0.98, retaliate: 0.9, dmg: 20, color: "#3e2c20" },
};

// ---------- Навыки и работа ----------
export const SKILLS = {
  construction: "Строительство",
  mining: "Горное дело",
  plants: "Растения",
  cooking: "Кулинария",
  medicine: "Медицина",
  shooting: "Стрельба",
  melee: "Ближний бой",
  intellect: "Наука",
  social: "Общение",
};

// Порядок = приоритет при равных значениях (как в RimWorld)
export const WORK = [
  { id: "doctor", name: "Врач", icon: "✚", skill: "medicine" },
  { id: "warden", name: "Надзор", icon: "⛓", skill: "social" },
  { id: "cook", name: "Готовка", icon: "🍲", skill: "cooking" },
  { id: "hunt", name: "Охота", icon: "🏹", skill: "shooting" },
  { id: "construct", name: "Стройка", icon: "🔨", skill: "construction" },
  { id: "grow", name: "Растения", icon: "🌱", skill: "plants" },
  { id: "cut", name: "Рубка", icon: "🪓", skill: "plants" },
  { id: "mine", name: "Шахта", icon: "⛏", skill: "mining" },
  { id: "haul", name: "Переноска", icon: "📦", skill: null },
  { id: "research", name: "Наука", icon: "🔬", skill: "intellect" },
];

// ---------- Черты характера ----------
export const TRAITS = {
  industrious: { name: "Трудолюбие", desc: "Работает на 25% быстрее", work: 1.25, conflict: "lazy" },
  lazy: { name: "Лень", desc: "Работает на 20% медленнее", work: 0.8, conflict: "industrious" },
  optimist: { name: "Оптимизм", desc: "+8 к настроению", mood: 8, conflict: "pessimist" },
  pessimist: { name: "Пессимизм", desc: "−8 к настроению", mood: -8, conflict: "optimist" },
  fast: { name: "Быстрые ноги", desc: "Ходит на 20% быстрее", move: 1.2, conflict: "slow" },
  slow: { name: "Неуклюжесть", desc: "Ходит на 15% медленнее", move: 0.85, conflict: "fast" },
  glutton: { name: "Обжорство", desc: "Голодает в полтора раза быстрее", hunger: 1.5 },
  tough: { name: "Крепкое здоровье", desc: "+30% к здоровью", hp: 1.3 },
  ascetic: { name: "Аскетизм", desc: "Не расстраивается из-за бытовых неудобств", ascetic: true },
  steady: { name: "Стальные нервы", desc: "Срывается вдвое реже", breaks: 0.5, conflict: "nervous" },
  nervous: { name: "Нервозность", desc: "Срывается чаще", breaks: 1.8, conflict: "steady" },
  sharp: { name: "Меткость", desc: "+15% к точности стрельбы", aim: 1.15 },
};

// ---------- Мысли (влияют на настроение) ----------
export const THOUGHTS = {
  noTable: { label: "Еда без стола", mood: -3, days: 1, ascetic: true },
  rawFood: { label: "Сырая пища", mood: -7, days: 1, ascetic: true },
  fineMeal: { label: "Вкусная трапеза", mood: 6, days: 1 },
  groundSleep: { label: "Сон на земле", mood: -4, days: 1, ascetic: true },
  coldSleep: { label: "Сон в холоде", mood: -5, days: 1 },
  cozyBedroom: { label: "Уютная спальня", mood: 4, days: 1 },
  barracks: { label: "Сон в общей комнате", mood: -2, days: 1, ascetic: true },
  friendDied: { label: "Смерть товарища", mood: -12, days: 5 },
  victory: { label: "Победа над врагом", mood: 6, days: 2 },
  catharsis: { label: "Катарсис", mood: 15, days: 2 },
  newColonist: { label: "Новый товарищ", mood: 3, days: 2 },
  prisonerJoined: { label: "Пленник перевоспитан", mood: 3, days: 2 },
  ateTogether: { label: "Ужин в столовой", mood: 2, days: 1 },
};

export const DIFFICULTY = {
  calm: { name: "Спокойный", desc: "Редкие слабые угрозы. Чтобы строить и не волноваться.", threatMin: 6, threatMax: 9, points: 0.55, grace: 8, mood: 8 },
  classic: { name: "Классический", desc: "Угрозы нарастают постепенно. Как задумано.", threatMin: 4, threatMax: 6.5, points: 1, grace: 5, mood: 0 },
  brutal: { name: "Жестокий", desc: "Частые сильные налёты. Для ветеранов.", threatMin: 2.5, threatMax: 4.5, points: 1.6, grace: 3, mood: -5 },
};

// ---------- Колонисты ----------
export const NAMES_M = ["Алексей", "Борис", "Виктор", "Глеб", "Денис", "Егор", "Иван", "Кирилл", "Лев", "Максим", "Никита", "Олег", "Павел", "Роман", "Семён", "Тимур", "Фёдор", "Юрий", "Ярослав", "Артём", "Михаил", "Захар", "Арсений", "Мирон", "Степан", "Гордей", "Савва", "Тихон"];
export const NAMES_F = ["Анна", "Вера", "Дарья", "Елена", "Зоя", "Ирина", "Ксения", "Лидия", "Мария", "Нина", "Ольга", "Полина", "Светлана", "Таисия", "Ульяна", "Юлия", "Яна", "Алиса", "Ева", "Варвара", "Злата", "Мирослава", "Есения", "Агата", "Серафима", "Василиса"];
export const SURNAMES = ["Котов", "Волков", "Лисицын", "Медведев", "Соколов", "Орлов", "Зайцев", "Морозов", "Ветров", "Громов", "Белов", "Тихонов", "Ершов", "Рябинин", "Сорокин", "Щукин", "Гусев", "Дроздов", "Князев", "Полозов"];
export const RAIDER_NAMES = ["Шрам", "Клык", "Гвоздь", "Ржавый", "Пепел", "Хрящ", "Бурый", "Косой", "Жаба", "Шило", "Сыч", "Крюк", "Дым", "Гарь", "Ворон", "Лом"];

export const BACKSTORIES = [
  { title: "Фермер", skills: { plants: 6, cooking: 2 } },
  { title: "Шахтёр", skills: { mining: 6, construction: 2 } },
  { title: "Инженер", skills: { construction: 5, intellect: 3 } },
  { title: "Повар", skills: { cooking: 6, plants: 1 } },
  { title: "Полевой медик", skills: { medicine: 6, social: 2 } },
  { title: "Солдат", skills: { shooting: 5, melee: 3 } },
  { title: "Учёный", skills: { intellect: 7 } },
  { title: "Охотник", skills: { shooting: 5, plants: 2 } },
  { title: "Плотник", skills: { construction: 6 } },
  { title: "Торговец", skills: { social: 6, intellect: 1 } },
  { title: "Бродяга", skills: { melee: 3, mining: 2, plants: 2 } },
  { title: "Гладиатор", skills: { melee: 7 } },
];

export const SKIN = ["#f1d0b5", "#e6b896", "#d29f7a", "#b07a55", "#8a5a3c", "#6b4630"];
export const HAIR = ["#2a1d15", "#4a3020", "#7a4a25", "#a8743a", "#d8b46a", "#e8dcc0", "#8a2a1a", "#555555"];
export const SHIRTS = ["#5d7a8c", "#7a5d8c", "#8c7a5d", "#5d8c6a", "#8c5d5d", "#4d6b9a", "#9a7d3d", "#3d8a8a", "#a05f3c", "#6c6c8c"];

export const COLONIST_CAP = 12;

// Смещения по спирали (от ближних к дальним) — для поиска свободных клеток
export const SPIRAL = (() => {
  const arr = [];
  for (let dy = -12; dy <= 12; dy++)
    for (let dx = -12; dx <= 12; dx++) {
      const d = dx * dx + dy * dy;
      if (d <= 144) arr.push([dx, dy, d]);
    }
  arr.sort((a, b) => a[2] - b[2]);
  return arr;
})();

// Флаги приказов на клетке
export const DESIG = { MINE: 1, CUT: 2, HARVEST: 4 };
