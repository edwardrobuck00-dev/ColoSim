import { ENGINE_VERSION } from "@sim/engine";
import { content } from "../services/content";

/** Why a replay cannot be rebuilt here, or null if it can. */
export function replayProblem(engineVersion: string, contentHash: string): string | null {
  if (engineVersion !== ENGINE_VERSION) return `This replay was recorded with a different version of the combat engine (${engineVersion}; this is ${ENGINE_VERSION}), so it cannot be rebuilt exactly.`;
  if (contentHash !== content.contentHash) return "This replay was recorded with different game content, so it cannot be rebuilt exactly.";
  return null;
}
