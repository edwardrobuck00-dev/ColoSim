import { z } from "zod";
import { WEAPON_CATEGORY_IDS } from "../combat/weapon-categories";
import { IdSchema, StyleBonusesSchema } from "./common";
import { SpecialAttackDefSchema } from "./special-attack";

export const EQUIPMENT_SLOTS = [
  "head", "cape", "neck", "ammo", "weapon", "body", "shield", "legs", "hands", "feet", "ring",
] as const;
export const EquipmentSlotSchema = z.enum(EQUIPMENT_SLOTS);
export type EquipmentSlot = z.infer<typeof EquipmentSlotSchema>;

export const SKILLS = ["attack", "strength", "defence", "ranged", "magic", "prayer", "hitpoints"] as const;
export const SkillSchema = z.enum(SKILLS);
export type Skill = z.infer<typeof SkillSchema>;

const zeroStyles = { stab: 0, slash: 0, crush: 0, ranged: 0, magic: 0 };

export const ItemBonusesSchema = z.object({
  attack: StyleBonusesSchema.default(zeroStyles),
  defence: StyleBonusesSchema.default(zeroStyles),
  meleeStrength: z.number().int().default(0),
  rangedStrength: z.number().int().default(0),
  /** Magic damage in percent (may be fractional, e.g. 0.2). */
  magicDamagePercent: z.number().default(0),
  prayer: z.number().int().default(0),
});
export type ItemBonuses = z.infer<typeof ItemBonusesSchema>;

/**
 * An amount computed from a level: sum of floor(level * num / den) * mult, plus flat.
 * Expresses documented formulas as data, e.g. super combat: floor(level * 15/100) + 5;
 * anglerfish: floor(hp/10) + 2*floor(hp/25) + 5*floor(hp/93) + 2.
 */
export const LevelAmountSchema = z.object({
  terms: z.array(z.object({ num: z.number().int(), den: z.number().int().positive(), mult: z.number().int().default(1) })).default([]),
  flat: z.number().int().default(0),
});
export type LevelAmount = z.infer<typeof LevelAmountSchema>;

export const ConsumableEffectSchema = z.discriminatedUnion("type", [
  /** Heal by an amount based on base Hitpoints. Overheal allows going above max by up to that amount. */
  z.object({ type: z.literal("heal"), amount: LevelAmountSchema, overheal: z.boolean().default(false) }),
  /** Visible boost based on base level; never exceeds base + amount and does not stack. */
  z.object({ type: z.literal("boost"), skills: z.array(SkillSchema).min(1), amount: LevelAmountSchema }),
  /** Lower levels by an amount based on the current level (e.g. Saradomin brew). */
  z.object({ type: z.literal("drain"), skills: z.array(SkillSchema).min(1), amount: LevelAmountSchema }),
  /** Restore lowered levels (and prayer points) by an amount based on base level, up to base. */
  z.object({ type: z.literal("restore"), skills: z.array(SkillSchema).min(1), amount: LevelAmountSchema }),
]);
export type ConsumableEffect = z.infer<typeof ConsumableEffectSchema>;

export const ConsumableSchema = z.object({
  /**
   * food: 3-tick eat timer. combo-food: separate timer, can follow normal food
   * in the same tick (karambwan). potion: separate 3-tick potion timer.
   */
  kind: z.enum(["food", "combo-food", "potion"]),
  /** Uses per item (potion doses). The inventory stack quantity counts doses left. */
  doses: z.number().int().min(1).default(1),
  /** Ticks added to the attack timer (food 3, karambwan 2, potions 0). */
  attackDelayTicks: z.number().int().min(0),
  /** Ticks before another item of the same timer can be consumed. */
  consumeDelayTicks: z.number().int().min(0).default(3),
  effects: z.array(ConsumableEffectSchema).min(1),
});
export type Consumable = z.infer<typeof ConsumableSchema>;

export const AmmoKindSchema = z.enum(["arrow", "bolt"]);

export const ItemDefSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  slot: EquipmentSlotSchema.optional(),
  weightKg: z.number().default(0),
  stackable: z.boolean().default(false),
  bonuses: ItemBonusesSchema.default({
    attack: zeroStyles, defence: zeroStyles, meleeStrength: 0, rangedStrength: 0, magicDamagePercent: 0, prayer: 0,
  }),
  /** Base levels needed to equip (quest requirements are not modelled). */
  requirements: z.partialRecord(SkillSchema, z.number().int().min(1).max(99)).default({}),
  weapon: z
    .object({
      category: z.enum(WEAPON_CATEGORY_IDS),
      attackSpeedTicks: z.number().int().min(1),
      rangeTiles: z.number().int().min(1),
      twoHanded: z.boolean().default(false),
      /**
       * Powered staves: built-in spell max hit. Either fixed, or
       * max(1, floor(currentMagic / divisor) + offset) (e.g. trident: /3 - 5).
       */
      poweredStaff: z
        .object({ fixedMaxHit: z.number().int().min(0).optional(), magicDivisor: z.number().int().positive().optional(), offset: z.number().int().default(0) })
        .optional(),
      /** Ammunition this weapon fires: kind and the highest tier (ammo Ranged requirement) it accepts. */
      ammo: z.object({ kind: AmmoKindSchema, maxTier: z.number().int().min(1) }).optional(),
      projectile: z.object({ visualId: IdSchema }).optional(),
      animationCue: z.string().default("attack"),
      special: SpecialAttackDefSchema.optional(),
    })
    .optional(),
  /** For ammunition: its kind and tier (the Ranged level it requires). */
  ammo: z.object({ kind: AmmoKindSchema, tier: z.number().int().min(1) }).optional(),
  /** Chance (percent) that fired ammunition is recovered (Ava's devices). */
  ammoSavePercent: z.number().int().min(0).max(100).optional(),
  consumable: ConsumableSchema.optional(),
  /** Where the numbers come from. */
  source: z
    .object({ wikiPage: z.string(), wikiVersion: z.string().optional(), wikiRevision: z.number().int().nullable(), itemIds: z.array(z.string()).default([]) })
    .optional(),
  /** Search and filter tags, e.g. "melee", "tier:dragon", "set:torva". */
  tags: z.array(z.string()).default([]),
  /** Effects this simulator does not model (set bonuses, passives, charges), shown to players. */
  notes: z.array(z.string()).default([]),
  visualId: IdSchema.optional(),
});
export type ItemDef = z.infer<typeof ItemDefSchema>;
export type ItemDefInput = z.input<typeof ItemDefSchema>;
export type ConsumableInput = z.input<typeof ConsumableSchema>;
