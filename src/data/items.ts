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
  { id: 'lucky_sock', name: 'Lucky Sock', price: 12, color: 0x7ec850, mods: { luck: 12 } },
  { id: 'pot_lid', name: 'Pot Lid', price: 15, color: 0x8a8f99, mods: { armor: 2, speed: -3 } },
  { id: 'coffee_bean', name: 'Coffee Bean', price: 18, color: 0x6b4226, mods: { attackSpeed: 10 } },
  { id: 'sharp_rock', name: 'Sharp Rock', price: 18, color: 0x9c9c9c, mods: { damage: 10, attackSpeed: -3 } },
  { id: 'spare_heart', name: 'Spare Heart', price: 16, color: 0xd94a5a, mods: { maxHp: 5 } },
  { id: 'bandage_roll', name: 'Bandage Roll', price: 14, color: 0xf0e6d2, mods: { hpRegen: 3 } },
  { id: 'feather', name: 'Feather', price: 16, color: 0xe8e8ff, mods: { dodge: 5 } },
  { id: 'running_shoes', name: 'Running Shoes', price: 14, color: 0x4a7bd9, mods: { speed: 8 } },
  { id: 'fridge_magnet', name: 'Fridge Magnet', price: 10, color: 0xd9534f, mods: { pickupRange: 50 } },
  { id: 'garden_hoe', name: 'Garden Hoe', price: 15, color: 0xa0784a, mods: { harvesting: 10 } },
  { id: 'spyglass', name: 'Spyglass', price: 16, color: 0xc9a227, mods: { range: 60 } },
  { id: 'glass_eye', name: 'Glass Eye', price: 20, color: 0x9ad0ec, mods: { critChance: 8, maxHp: -2 } },
];
