import type { z } from "zod";
import type { MechanicRef } from "../defs/common";
import type { MechanicInstance } from "./hooks";

export interface MechanicDefinition<S extends z.ZodType = z.ZodType> {
  id: string;
  description: string;
  params: S;
  create(params: z.infer<S>): MechanicInstance;
}

export function defineMechanic<S extends z.ZodType>(def: MechanicDefinition<S>): MechanicDefinition<S> {
  return def;
}

export class MechanicError extends Error {
  override name = "MechanicError";
}

export interface ActiveMechanic {
  id: string;
  instance: MechanicInstance;
}

/** All mechanic modules known to the engine, looked up by the IDs used in data. */
export class MechanicRegistry {
  private readonly defs = new Map<string, MechanicDefinition>();

  register(def: MechanicDefinition): this {
    if (this.defs.has(def.id)) throw new MechanicError(`Mechanic "${def.id}" is already registered`);
    this.defs.set(def.id, def);
    return this;
  }

  has(id: string): boolean {
    return this.defs.has(id);
  }

  list(): MechanicDefinition[] {
    return [...this.defs.values()];
  }

  /** Throws MechanicError if the ID is unknown or the params are invalid. */
  validate(ref: MechanicRef): unknown {
    const def = this.defs.get(ref.id);
    if (!def) throw new MechanicError(`Unknown mechanic "${ref.id}"`);
    const parsed = def.params.safeParse(ref.params);
    if (!parsed.success) {
      throw new MechanicError(`Invalid params for mechanic "${ref.id}": ${parsed.error.message}`);
    }
    return parsed.data;
  }

  instantiate(ref: MechanicRef): ActiveMechanic {
    const params = this.validate(ref);
    return { id: ref.id, instance: this.defs.get(ref.id)!.create(params) };
  }
}
