import { AttemptRepository, LocalReplayRepository, SimDatabase } from "@sim/storage";

/** Single database connection for the app. IndexedDB may be unavailable (private browsing). */
export const db = new SimDatabase();

export const repositories = {
  replays: new LocalReplayRepository(db),
  attempts: new AttemptRepository(db),
};
