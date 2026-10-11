import type { Stats } from './stats';

/**
 * Connection groups. Owning an item makes other items in the same group a
 * little more likely to show up in the shop, so builds can snowball.
 */
export type Connect =
  | 'melee'
  | 'ranged'
  | 'explosive'
  | 'firepower'
  | 'precision'
  | 'survival'
  | 'agility'
  | 'economy';

export const CONNECT_LABELS: Record<Connect, string> = {
  melee: '近战',
  ranged: '射击',
  explosive: '爆破',
  firepower: '火力',
  precision: '精准',
  survival: '生存',
  agility: '身法',
  economy: '经济',
};

/** Shop weight bonus per owned item that shares a connection, and its cap. */
export const CONNECT_BONUS = 0.2;
export const CONNECT_BONUS_MAX = 0.8;

/** Passive items: permanent stat modifiers bought in the shop. */
export interface ItemDef {
  id: string;
  name: string;
  price: number;
  color: number;
  mods: Partial<Stats>;
  connects: readonly Connect[];
}

export const ITEMS: ItemDef[] = [
  { id: 'lucky_sock', name: '幸运袜', price: 12, color: 0x7ec850, mods: { luck: 12 }, connects: ['economy'] },
  { id: 'pot_lid', name: '锅盖', price: 15, color: 0x8a8f99, mods: { armor: 2, speed: -3 }, connects: ['survival'] },
  { id: 'coffee_bean', name: '咖啡豆', price: 18, color: 0x6b4226, mods: { attackSpeed: 10 }, connects: ['firepower'] },
  { id: 'sharp_rock', name: '尖石头', price: 18, color: 0x9c9c9c, mods: { damage: 10, attackSpeed: -3 }, connects: ['firepower'] },
  { id: 'spare_heart', name: '备用心脏', price: 16, color: 0xd94a5a, mods: { maxHp: 5 }, connects: ['survival'] },
  { id: 'bandage_roll', name: '绷带卷', price: 14, color: 0xf0e6d2, mods: { hpRegen: 3 }, connects: ['survival'] },
  { id: 'feather', name: '羽毛', price: 16, color: 0xe8e8ff, mods: { dodge: 5 }, connects: ['agility', 'survival'] },
  { id: 'running_shoes', name: '跑鞋', price: 14, color: 0x4a7bd9, mods: { speed: 8 }, connects: ['agility'] },
  { id: 'fridge_magnet', name: '冰箱贴', price: 10, color: 0xd9534f, mods: { pickupRange: 50 }, connects: ['economy'] },
  { id: 'garden_hoe', name: '园艺锄', price: 15, color: 0xa0784a, mods: { harvesting: 10 }, connects: ['economy'] },
  { id: 'spyglass', name: '望远镜', price: 16, color: 0xc9a227, mods: { range: 60 }, connects: ['precision'] },
  { id: 'powder_keg', name: '火药桶', price: 18, color: 0x8b4a2b, mods: { explosionSize: 25 }, connects: ['explosive'] },
  { id: 'detonator', name: '雷管', price: 20, color: 0xd9a227, mods: { explosionDamage: 20 }, connects: ['explosive'] },
  {
    id: 'blast_core',
    name: '冲击波核心',
    price: 26,
    color: 0xff7a3d,
    mods: { explosionSize: 40, damage: -5 },
    connects: ['explosive'],
  },
  {
    id: 'scorched_badge',
    name: '焦土徽章',
    price: 24,
    color: 0x6b2b2b,
    mods: { explosionDamage: 30, attackSpeed: -5 },
    connects: ['explosive', 'firepower'],
  },
  {
    id: 'glass_eye',
    name: '玻璃眼',
    price: 20,
    color: 0x9ad0ec,
    mods: { critChance: 8, maxHp: -2 },
    connects: ['precision', 'firepower'],
  },
  // Melee build
  { id: 'hand_wraps', name: '拳击绷带', price: 13, color: 0xe8d8b0, mods: { meleeDamage: 2 }, connects: ['melee'] },
  {
    id: 'brass_knuckles',
    name: '铁指虎',
    price: 18,
    color: 0xc9a227,
    mods: { meleeDamage: 2, attackSpeed: 4 },
    connects: ['melee', 'firepower'],
  },
  {
    id: 'whetstone',
    name: '磨刀石',
    price: 20,
    color: 0x7a8088,
    mods: { meleeDamage: 3, critChance: 3 },
    connects: ['melee', 'precision'],
  },
  {
    id: 'berserker_band',
    name: '狂战士头带',
    price: 26,
    color: 0xb02a2a,
    mods: { meleeDamage: 5, armor: -1 },
    connects: ['melee', 'firepower'],
  },
  // Ranged build
  { id: 'hollow_points', name: '空尖弹', price: 13, color: 0xb87333, mods: { rangedDamage: 2 }, connects: ['ranged'] },
  {
    id: 'ammo_belt',
    name: '弹药带',
    price: 18,
    color: 0x6b5a2a,
    mods: { rangedDamage: 2, attackSpeed: 4 },
    connects: ['ranged', 'firepower'],
  },
  {
    id: 'ap_rounds',
    name: '穿甲弹',
    price: 20,
    color: 0x5a6a8a,
    mods: { rangedDamage: 3, range: 20 },
    connects: ['ranged', 'precision'],
  },
  {
    id: 'heavy_barrel',
    name: '重型枪管',
    price: 26,
    color: 0x3a3f4a,
    mods: { rangedDamage: 5, speed: -4 },
    connects: ['ranged', 'firepower'],
  },
  // Either build
  {
    id: 'tactical_gloves',
    name: '战术手套',
    price: 15,
    color: 0x4a5a3a,
    mods: { meleeDamage: 1, rangedDamage: 1 },
    connects: ['melee', 'ranged'],
  },
];

const ITEM_BY_ID = new Map(ITEMS.map((it) => [it.id, it]));

/** Connections of `item` that at least one owned item also has. */
export function linkedConnects(item: ItemDef, owned: readonly string[]): Connect[] {
  return item.connects.filter((c) => owned.some((id) => ITEM_BY_ID.get(id)?.connects.includes(c)));
}

/**
 * Shop weight multiplier from owned items: +CONNECT_BONUS for each owned item
 * sharing any connection (duplicates count), capped at +CONNECT_BONUS_MAX.
 */
export function connectMultiplier(item: ItemDef, owned: readonly string[]): number {
  let n = 0;
  for (const id of owned) {
    const other = ITEM_BY_ID.get(id);
    if (other && other.connects.some((c) => item.connects.includes(c))) n++;
  }
  return 1 + Math.min(CONNECT_BONUS_MAX, n * CONNECT_BONUS);
}
