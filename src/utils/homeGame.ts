// ─── Home Game Data & Helpers ────────────────────────────────────────────────

export interface PreparedMeal {
  id: string;
  recipeId: string;
  preparedBy: string;
  preparedAt: number;
}

export interface HomeGameData {
  supplies: Record<string, number>;
  roomTheme: string;
  ownedThemes: string[];
  preparedMeals: PreparedMeal[];
  cleanliness: number;
  coziness: number;
  lastClean: number;
  dailyTasks: Record<string, boolean>;
  lastTaskReset: number;
}

export const INITIAL_HOME: HomeGameData = {
  supplies: {},
  roomTheme: 'default',
  ownedThemes: ['default'],
  preparedMeals: [],
  cleanliness: 75,
  coziness: 50,
  lastClean: Date.now(),
  dailyTasks: {},
  lastTaskReset: Date.now(),
};

// ─── Recipes ─────────────────────────────────────────────────────────────────
export const RECIPES = [
  { id: 'warm_milk',    name: 'Warm Milk',      emoji: '🍼', ingredients: { milk: 1 },                    nutrition: 20, happiness: 5,  cookTime: 1 },
  { id: 'fruit_bowl',   name: 'Fruit Bowl',     emoji: '🍓', ingredients: { fruits: 2 },                  nutrition: 25, happiness: 10, cookTime: 2 },
  { id: 'baby_porridge', name: 'Baby Porridge',  emoji: '🥣', ingredients: { milk: 1, oats: 1 },          nutrition: 35, happiness: 10, cookTime: 3 },
  { id: 'mini_pancakes', name: 'Mini Pancakes',  emoji: '🥞', ingredients: { flour: 1, milk: 1, eggs: 1 },nutrition: 40, happiness: 15, cookTime: 4 },
  { id: 'veggie_soup',  name: 'Veggie Soup',     emoji: '🥕', ingredients: { veggies: 2 },                nutrition: 30, happiness: 10, cookTime: 3 },
  { id: 'rice_bowl',    name: 'Rice Bowl',       emoji: '🍚', ingredients: { rice: 2 },                   nutrition: 30, happiness: 8,  cookTime: 3 },
  { id: 'khichdi',      name: 'Khichdi',         emoji: '🍲', ingredients: { rice: 1, lentils: 1, veggies: 1 }, nutrition: 45, happiness: 15, cookTime: 5 },
  { id: 'sweet_pudding', name: 'Sweet Pudding',  emoji: '🍮', ingredients: { milk: 2, sugar: 1 },         nutrition: 25, happiness: 20, cookTime: 4 },
  { id: 'egg_toast',    name: 'Egg Toast',       emoji: '🍳', ingredients: { eggs: 1, flour: 1 },         nutrition: 35, happiness: 12, cookTime: 3 },
  { id: 'dal_rice',     name: 'Dal Rice',        emoji: '🫕', ingredients: { rice: 1, lentils: 2 },       nutrition: 40, happiness: 15, cookTime: 5 },
];

// ─── Supplies ────────────────────────────────────────────────────────────────
export const SUPPLIES = [
  { id: 'milk',    name: 'Milk',    emoji: '🥛', cost: 3, category: 'ingredient' as const },
  { id: 'oats',    name: 'Oats',    emoji: '🌾', cost: 2, category: 'ingredient' as const },
  { id: 'fruits',  name: 'Fruits',  emoji: '🍎', cost: 3, category: 'ingredient' as const },
  { id: 'flour',   name: 'Flour',   emoji: '🫓', cost: 2, category: 'ingredient' as const },
  { id: 'eggs',    name: 'Eggs',    emoji: '🥚', cost: 3, category: 'ingredient' as const },
  { id: 'veggies', name: 'Veggies', emoji: '🥬', cost: 3, category: 'ingredient' as const },
  { id: 'rice',    name: 'Rice',    emoji: '🍚', cost: 2, category: 'ingredient' as const },
  { id: 'lentils', name: 'Lentils', emoji: '🫘', cost: 2, category: 'ingredient' as const },
  { id: 'sugar',   name: 'Sugar',   emoji: '🍬', cost: 1, category: 'ingredient' as const },
];

// ─── Room Themes ─────────────────────────────────────────────────────────────
export const ROOM_THEMES = [
  { id: 'default', name: 'Cozy Home',   emoji: '🏠', cost: 0,
    image: '/game/home/bg_default.png',
    wall: ['#FFF5F0','#FFE8D6'], floor: '#E8D5C4', accent: '#FFB5A7',
    sky: { dawn:'#FFB5A7', day:'#87CEEB', dusk:'#FF7043', night:'#1a1a3e' } },
  { id: 'sakura',  name: 'Sakura Room', emoji: '🌸', cost: 50,
    image: '/game/home/bg_sakura.png',
    wall: ['#FFF0F5','#FFE0EE'], floor: '#F5D5E0', accent: '#FFB7C5',
    sky: { dawn:'#FFD1DC', day:'#FFB7C5', dusk:'#E8A0B5', night:'#2D1B2E' } },
  { id: 'ocean',   name: 'Ocean Breeze',emoji: '🌊', cost: 60,
    image: '/game/home/bg_ocean.png',
    wall: ['#F0F8FF','#E0F0FF'], floor: '#C5DDE8', accent: '#4FC3F7',
    sky: { dawn:'#80DEEA', day:'#4FC3F7', dusk:'#0288D1', night:'#0D1B2A' } },
  { id: 'forest',  name: 'Forest Nook', emoji: '🌿', cost: 60,
    image: '/game/home/bg_forest.png',
    wall: ['#F1F8E9','#E8F5E0'], floor: '#C8D8A0', accent: '#81C784',
    sky: { dawn:'#A5D6A7', day:'#81C784', dusk:'#558B2F', night:'#1B2E1B' } },
  { id: 'sunset',  name: 'Golden Hour', emoji: '🌅', cost: 70,
    image: '/game/home/bg_sunset.png',
    wall: ['#FFF8E1','#FFE8C0'], floor: '#E8D5B0', accent: '#FFB74D',
    sky: { dawn:'#FFCC80', day:'#FFB74D', dusk:'#FF7043', night:'#2E1B0D' } },
  { id: 'night',   name: 'Starry Night',emoji: '✨', cost: 80,
    image: '/game/home/bg_night.png',
    wall: ['#1A1A2E','#16213E'], floor: '#2D2D44', accent: '#7C4DFF',
    sky: { dawn:'#311B92', day:'#283593', dusk:'#1A237E', night:'#0D0D1A' } },
];

// ─── Daily Tasks ─────────────────────────────────────────────────────────────
export const DAILY_TASKS = [
  { id: 'feed_pukku',   name: 'Feed Pukku',        emoji: '🍼', reward: 3 },
  { id: 'feed_ukku',    name: 'Feed Ukku',          emoji: '🍼', reward: 3 },
  { id: 'cook_meal',    name: 'Cook a Meal',        emoji: '🍳', reward: 3 },
  { id: 'clean_room',   name: 'Tidy the Room',      emoji: '🧹', reward: 2 },
  { id: 'bath_babies',  name: 'Bath Time',          emoji: '🛁', reward: 3 },
  { id: 'water_plant',  name: 'Water the Plant',    emoji: '🪴', reward: 1 },
  { id: 'read_story',   name: 'Read a Story',       emoji: '📖', reward: 2 },
  { id: 'sleep_babies', name: 'Bedtime Routine',    emoji: '🌙', reward: 3 },
];

// ─── Time Helpers ────────────────────────────────────────────────────────────
export function getTimeOfDay(): 'dawn'|'day'|'dusk'|'night' {
  const h = new Date().getHours();
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}

export function getTimeGreeting(): string {
  const tod = getTimeOfDay();
  if (tod === 'dawn') return 'Morning Good ☀️';
  if (tod === 'day') return 'Afternoon Good 🌤️';
  if (tod === 'dusk') return 'Evening Good 🌅';
  return 'Night Good 🌙';
}

export function getRoomBrightness(): number {
  const tod = getTimeOfDay();
  if (tod === 'dawn') return 0.85;
  if (tod === 'day') return 1;
  if (tod === 'dusk') return 0.7;
  return 0.4;
}

export function canCookRecipe(recipe: typeof RECIPES[0], supplies: Record<string, number>): boolean {
  return Object.entries(recipe.ingredients).every(([id, qty]) => (supplies[id] || 0) >= qty);
}

export function calcAge(birthdayMs: number) {
  const birth = new Date(birthdayMs);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();
  if (days < 0) { months -= 1; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (months < 0) { years -= 1; months += 12; }
  return { years, months, days };
}

export function getAgeShort(ms: number): string {
  const { years, months, days } = calcAge(ms);
  if (years > 0 && months > 0) return `${years}y ${months}m`;
  if (years > 0) return `${years}y`;
  if (months > 0 && days > 0) return `${months}m ${days}d`;
  if (months > 0) return `${months}m`;
  return `${days}d`;
}

export function shouldResetTasks(lastReset: number): boolean {
  const last = new Date(lastReset).toDateString();
  const now = new Date().toDateString();
  return last !== now;
}
