/* Reference data for Minecraft villager trading.
 * Both Java and Bedrock mechanics. Prices/formulas are implemented in prices.js.
 */
"use strict";

const VERSION_LABELS = {
  java: "Java Edition",
  bedrock: "Bedrock Edition",
};

const LEVELS = [
  { id: 1, name: "Novice", badge: "stone" },
  { id: 2, name: "Apprentice", badge: "iron" },
  { id: 3, name: "Journeyman", badge: "gold" },
  { id: 4, name: "Expert", badge: "emerald" },
  { id: 5, name: "Master", badge: "diamond" },
];

const PROFESSIONS = [
  { id: "armorer", name: "Armorer", jobSite: "Blast Furnace" },
  { id: "butcher", name: "Butcher", jobSite: "Smoker" },
  { id: "cartographer", name: "Cartographer", jobSite: "Cartography Table" },
  { id: "cleric", name: "Cleric", jobSite: "Brewing Stand" },
  { id: "farmer", name: "Farmer", jobSite: "Composter" },
  { id: "fisherman", name: "Fisherman", jobSite: "Barrel" },
  { id: "fletcher", name: "Fletcher", jobSite: "Fletching Table" },
  { id: "leatherworker", name: "Leatherworker", jobSite: "Cauldron" },
  { id: "librarian", name: "Librarian", jobSite: "Lectern" },
  { id: "mason", name: "Mason", jobSite: "Stonecutter" },
  { id: "shepherd", name: "Shepherd", jobSite: "Loom" },
  { id: "toolsmith", name: "Toolsmith", jobSite: "Smithing Table" },
  { id: "weaponsmith", name: "Weaponsmith", jobSite: "Grindstone" },
  { id: "unemployed", name: "Unemployed", jobSite: "—" },
  { id: "nitwit", name: "Nitwit", jobSite: "—" },
];

function professionById(id) {
  return PROFESSIONS.find((p) => p.id === id) || { id: id, name: id, jobSite: "?" };
}

/* Price multipliers used by trades. 0.05 for the villager's "wants" (buy)
 * trades, 0.2 for most "sells", 0.3 for enchanted books. */
const PRICE_MULTIPLIERS = [
  { value: 0.05, label: "0.05 (villager buying items)" },
  { value: 0.2, label: "0.2 (most sells)" },
  { value: 0.3, label: "0.3 (enchanted books)" },
];

/* Enchantment reference. treasure: cannot be obtained from the enchanting
 * table. maxLevel: max enchant level that can appear on an enchanted book. */
const ENCHANTMENTS = [
  { name: "Aqua Affinity", maxLevel: 1, appliesTo: "Helmet", treasure: false },
  { name: "Bane of Arthropods", maxLevel: 5, appliesTo: "Sword, Axe", treasure: false },
  { name: "Blast Protection", maxLevel: 4, appliesTo: "Armor", treasure: false },
  { name: "Breach", maxLevel: 4, appliesTo: "Mace", treasure: false },
  { name: "Channeling", maxLevel: 1, appliesTo: "Trident", treasure: true },
  { name: "Curse of Binding", maxLevel: 1, appliesTo: "Armor", treasure: true },
  { name: "Curse of Vanishing", maxLevel: 1, appliesTo: "Any item", treasure: true },
  { name: "Density", maxLevel: 5, appliesTo: "Mace", treasure: false },
  { name: "Depth Strider", maxLevel: 3, appliesTo: "Boots", treasure: false },
  { name: "Efficiency", maxLevel: 5, appliesTo: "Pickaxe, Axe, Shovel, Hoe", treasure: false },
  { name: "Feather Falling", maxLevel: 4, appliesTo: "Boots", treasure: false },
  { name: "Fire Aspect", maxLevel: 2, appliesTo: "Sword", treasure: false },
  { name: "Fire Protection", maxLevel: 4, appliesTo: "Armor", treasure: false },
  { name: "Flame", maxLevel: 1, appliesTo: "Bow", treasure: false },
  { name: "Fortune", maxLevel: 3, appliesTo: "Pickaxe, Axe, Shovel, Hoe", treasure: false },
  { name: "Frost Walker", maxLevel: 2, appliesTo: "Boots", treasure: true },
  { name: "Impaling", maxLevel: 5, appliesTo: "Trident, Spear", treasure: false },
  { name: "Infinity", maxLevel: 1, appliesTo: "Bow", treasure: false },
  { name: "Knockback", maxLevel: 2, appliesTo: "Sword, Mace", treasure: false },
  { name: "Looting", maxLevel: 3, appliesTo: "Sword", treasure: false },
  { name: "Loyalty", maxLevel: 3, appliesTo: "Trident", treasure: false },
  { name: "Luck of the Sea", maxLevel: 3, appliesTo: "Fishing Rod", treasure: false },
  { name: "Lure", maxLevel: 3, appliesTo: "Fishing Rod", treasure: false },
  { name: "Mending", maxLevel: 1, appliesTo: "Any tool/armor/weapon", treasure: true },
  { name: "Multishot", maxLevel: 1, appliesTo: "Crossbow", treasure: false },
  { name: "Piercing", maxLevel: 4, appliesTo: "Crossbow", treasure: false },
  { name: "Power", maxLevel: 5, appliesTo: "Bow", treasure: false },
  { name: "Projectile Protection", maxLevel: 4, appliesTo: "Armor", treasure: false },
  { name: "Protection", maxLevel: 4, appliesTo: "Armor", treasure: false },
  { name: "Punch", maxLevel: 2, appliesTo: "Bow", treasure: false },
  { name: "Quick Charge", maxLevel: 3, appliesTo: "Crossbow", treasure: false },
  { name: "Respiration", maxLevel: 3, appliesTo: "Helmet", treasure: false },
  { name: "Riptide", maxLevel: 3, appliesTo: "Trident", treasure: false },
  { name: "Sharpness", maxLevel: 5, appliesTo: "Sword, Axe", treasure: false },
  { name: "Silk Touch", maxLevel: 1, appliesTo: "Pickaxe, Axe, Shovel, Hoe", treasure: false },
  { name: "Smite", maxLevel: 5, appliesTo: "Sword, Axe", treasure: false },
  { name: "Soul Speed", maxLevel: 3, appliesTo: "Boots", treasure: true },
  { name: "Swift Sneak", maxLevel: 3, appliesTo: "Leggings", treasure: true },
  { name: "Sweeping Edge", maxLevel: 3, appliesTo: "Sword (Java only)", treasure: false },
  { name: "Thorns", maxLevel: 3, appliesTo: "Armor", treasure: false },
  { name: "Unbreaking", maxLevel: 3, appliesTo: "Any tool/armor/weapon", treasure: false },
  { name: "Wind Burst", maxLevel: 3, appliesTo: "Mace", treasure: true },
];

/* How much the "first cure" discount is, expressed as reputation.
 * A cure adds +20 to the villager's permanent major-positive reputation for
 * that player. Discount in emeralds = floor(priceMultiplier x reputation). */
const CURE_REPUTATION = 20;

const HERO_DISCOUNTS = [0, 0.3, 0.3625, 0.425, 0.4875, 0.55];

function enchantByName(name) {
  return ENCHANTMENTS.find((e) => e.name.toLowerCase() === (name || "").toLowerCase());
}

function uid(prefix) {
  return (
    (prefix || "id") +
    "-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}
