import type { World } from "../core/world";
import { mechanicContext } from "../mechanics/runtime";

/** Phase 3: encounter scripting. Runs every mechanic's onTick hook. */
export function runEncounter(world: World): void {
  for (const m of world.mechanics) m.instance.hooks?.onTick?.(mechanicContext(world, m.id));
}
