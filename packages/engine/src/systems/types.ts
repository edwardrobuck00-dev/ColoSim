import type { World } from "../core/world";

/** One phase of the tick pipeline. Systems mutate the world and push events. */
export type System = (world: World) => void;
