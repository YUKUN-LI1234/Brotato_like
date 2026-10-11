import type { Stats } from './stats';

/** Passive items: permanent stat modifiers bought in the shop. */
export interface ItemDef {
  id: string;
  name: string;
  price: number;
  color: number;
  mods: Partial<Stats>;
}

export const ITEMS: ItemDef[] = [
  { id: 'lucky_sock', name: '幸运袜', price: 12, color: 0x7ec850, mods: { luck: 12 } },
  { id: 'pot_lid', name: '锅盖', price: 15, color: 0x8a8f99, mods: { armor: 2, speed: -3 } },
  { id: 'coffee_bean', name: '咖啡豆', price: 18, color: 0x6b4226, mods: { attackSpeed: 10 } },
  { id: 'sharp_rock', name: '尖石头', price: 18, color: 0x9c9c9c, mods: { damage: 10, attackSpeed: -3 } },
  { id: 'spare_heart', name: '备用心脏', price: 16, color: 0xd94a5a, mods: { maxHp: 5 } },
  { id: 'bandage_roll', name: '绷带卷', price: 14, color: 0xf0e6d2, mods: { hpRegen: 3 } },
  { id: 'feather', name: '羽毛', price: 16, color: 0xe8e8ff, mods: { dodge: 5 } },
  { id: 'running_shoes', name: '跑鞋', price: 14, color: 0x4a7bd9, mods: { speed: 8 } },
  { id: 'fridge_magnet', name: '冰箱贴', price: 10, color: 0xd9534f, mods: { pickupRange: 50 } },
  { id: 'garden_hoe', name: '园艺锄', price: 15, color: 0xa0784a, mods: { harvesting: 10 } },
  { id: 'spyglass', name: '望远镜', price: 16, color: 0xc9a227, mods: { range: 60 } },
  { id: 'powder_keg', name: '火药桶', price: 18, color: 0x8b4a2b, mods: { explosionSize: 25 } },
  { id: 'detonator', name: '雷管', price: 20, color: 0xd9a227, mods: { explosionDamage: 20 } },
  { id: 'blast_core', name: '冲击波核心', price: 26, color: 0xff7a3d, mods: { explosionSize: 40, damage: -5 } },
  { id: 'scorched_badge', name: '焦土徽章', price: 24, color: 0x6b2b2b, mods: { explosionDamage: 30, attackSpeed: -5 } },
  { id: 'cluster_tip', name: '爆裂弹头', price: 28, color: 0xf25c3c, mods: { explodeChance: 10 } },
  { id: 'glass_eye', name: '玻璃眼', price: 20, color: 0x9ad0ec, mods: { critChance: 8, maxHp: -2 } },
];
