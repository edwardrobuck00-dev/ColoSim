import type { AttemptRecord, SimDatabase } from "../db";
import { variantKey } from "../db";

export class AttemptRepository {
  constructor(private readonly db: SimDatabase) {}

  async record(a: Omit<AttemptRecord, "id" | "variantKey" | "createdAt"> & { modifierIds: string[] }): Promise<void> {
    const { modifierIds, ...rest } = a;
    await this.db.attempts.add({ ...rest, variantKey: variantKey(modifierIds), createdAt: Date.now() });
  }

  /** Fastest win for an encounter variant, in ticks. */
  async personalBest(encounterId: string, modifierIds: string[]): Promise<number | null> {
    const rows = await this.db.attempts
      .where("[encounterId+variantKey]")
      .equals([encounterId, variantKey(modifierIds)])
      .filter((r) => r.result === "win")
      .toArray();
    return rows.length ? Math.min(...rows.map((r) => r.durationTicks)) : null;
  }
}
