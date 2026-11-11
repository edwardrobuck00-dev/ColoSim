import { z } from "zod";
import { IdSchema } from "./common";
import { SkillSchema } from "./item";

const FactorSchema = z.tuple([z.number().int(), z.number().int().positive()]);

/**
 * Exclusive groups. Activating a prayer switches off active prayers that
 * share any group. With these groups the rules match the OSRS Wiki
 * "Conflicting prayers" table exactly:
 *  - defence prayers: [defence]
 *  - strength prayers: [strength]; attack prayers: [attack] (they do not conflict)
 *  - ranged and magic prayers (incl. Deadeye, Mystic Vigour): [strength, attack, ranged-magic]
 *  - Chivalry, Piety, Zeal, Rigour, Augury: [defence, strength, attack, ranged-magic]
 *  - overheads: [overhead]
 *  - Rapid Restore, Rapid Heal, Preserve: no group (never conflict)
 */
export const PrayerGroupSchema = z.enum(["attack", "strength", "defence", "ranged-magic", "overhead"]);
export type PrayerGroup = z.infer<typeof PrayerGroupSchema>;

/** Prayers whose effect is not a combat multiplier. */
export const PrayerUtilitySchema = z.enum(["rapid-heal", "rapid-restore", "preserve", "redemption"]);
export type PrayerUtility = z.infer<typeof PrayerUtilitySchema>;

export const PrayerDefSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  /** Prayer level needed to activate. */
  level: z.number().int().min(1).max(99),
  /** Other base levels needed (e.g. Piety: 70 Defence). */
  requirements: z.partialRecord(SkillSchema, z.number().int().min(1).max(99)).default({}),
  /** Added to the drain counter every tick (OSRS "drain effect"). */
  drainEffect: z.number().int().min(0),
  groups: z.array(PrayerGroupSchema).default([]),
  effects: z
    .object({
      meleeAccuracy: FactorSchema.optional(),
      meleeStrength: FactorSchema.optional(),
      rangedAccuracy: FactorSchema.optional(),
      rangedStrength: FactorSchema.optional(),
      magicAccuracy: FactorSchema.optional(),
      magicDamageTenths: z.number().int().min(0).optional(),
      /** Defence multipliers from several prayers add together (OSRS Wiki: Deadeye, Mystic Vigour). */
      defence: FactorSchema.optional(),
      magicDefence: FactorSchema.optional(),
      minimumStrengthGain: z.number().int().min(0).optional(),
    })
    .default({}),
  /** Protection prayer: the combat class it protects from. */
  protects: z.enum(["melee", "ranged", "magic"]).optional(),
  utility: PrayerUtilitySchema.optional(),
});
export type PrayerDef = z.infer<typeof PrayerDefSchema>;
export type PrayerDefInput = z.input<typeof PrayerDefSchema>;

export const isOverhead = (p: PrayerDef): boolean => p.groups.includes("overhead");
