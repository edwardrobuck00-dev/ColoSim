import type { Replay } from "@sim/engine";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { content } from "../services/content";
import { replayProblem } from "../utils/replays";
import { repositories } from "../services/storage";
import { useSessionStore } from "../state/session-store";
import { ArenaView } from "../ui/arena/ArenaView";
import { GameInterface } from "../ui/game/GameInterface";
import styles from "./pages.module.css";

/** /replay/:id: watches a saved fight in the arena, with the full timeline and inspection tools. */
export function ReplayPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const snapshot = useSessionStore((s) => s.snapshot);
  const [replay, setReplay] = useState<Replay | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void repositories.replays.get(id).then((r) => live && setReplay(r)).catch(() => live && setReplay(null));
    return () => {
      live = false;
    };
  }, [id]);

  if (replay === undefined) return <div className={styles.page}><p>Loading replay...</p></div>;
  if (replay === null) {
    return <div className={styles.page}><h1>Replay not found</h1><p><Link to="/replays">Back to replays</Link></p></div>;
  }
  const problem = replayProblem(replay.engineVersion, replay.contentHash);
  if (problem) return <div className={styles.page}><h1>Cannot play this replay</h1><p role="alert">{problem}</p><p><Link to="/replays">Back to replays</Link></p></div>;

  const c = replay.config;
  return (
    <div className={styles.fight}>
      <ArenaView
        key={id}
        encounterId={c.encounterId}
        modifierIds={c.modifierIds}
        setup={c.player}
        seed={c.seed}
        replay={replay}
        onChangeSetup={() => navigate("/replays")}
      />
      {snapshot && <GameInterface snapshot={snapshot} content={content} />}
    </div>
  );
}
