import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { PRESETS, findLoadout, validateSetup, type Loadout } from "../services/loadouts";
import { content } from "../services/content";
import { randomSeed } from "../utils/seed";
import { useSessionStore } from "../state/session-store";
import { ArenaView } from "../ui/arena/ArenaView";
import { GameInterface } from "../ui/game/GameInterface";
import styles from "./pages.module.css";

/** /fight/:encounterId?mods=a,b&loadout=id */
export function FightPage() {
  const { encounterId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const snapshot = useSessionStore((s) => s.snapshot);
  const seedParam = params.get("seed");
  // A ?seed= in the URL reproduces a specific fight; otherwise pick one at random.
  const [seed] = useState(() => (seedParam !== null && /^-?\d+$/.test(seedParam) ? Number(seedParam) | 0 : randomSeed()));

  const loadoutId = params.get("loadout") ?? PRESETS[0]!.id;
  const [loadout, setLoadout] = useState<Loadout | null | undefined>(() => PRESETS.find((l) => l.id === loadoutId));
  useEffect(() => {
    if (loadout?.id === loadoutId) return;
    let live = true;
    void findLoadout(loadoutId).then((l) => live && setLoadout(l ?? PRESETS[0]!));
    return () => {
      live = false;
    };
  }, [loadoutId, loadout?.id]);

  // Checked once per loadout (FightPage re-renders every tick).
  const setupProblem = useMemo(() => (loadout ? validateSetup(loadout.setup) : null), [loadout]);

  const encounter = content.encounters.get(encounterId);
  if (!encounter) {
    return (
      <div className={styles.page}>
        <h1>Unknown encounter</h1>
        <p>There is no encounter called “{encounterId}”. <Link to="/encounters">Pick one from the list.</Link></p>
      </div>
    );
  }

  if (!loadout) return <div className={styles.page}><p>Loading loadout…</p></div>;
  // A saved loadout can fall out of date (an item removed from the game, a level changed): explain instead of failing to start.
  if (setupProblem) {
    return (
      <div className={styles.page}>
        <h1>This loadout can't be used</h1>
        <p role="alert">“{loadout.name}”: {setupProblem}</p>
        <p><Link to="/loadouts">Edit it on the Setups page</Link> or <Link to={`/fight/${encounterId}`}>fight with the default loadout</Link>.</p>
      </div>
    );
  }

  const modifierIds = (params.get("mods") ?? "").split(",").filter((m) => m && encounter.modifiers.includes(m));

  return (
    <div className={styles.fight}>
      <ArenaView
        key={`${encounter.id}|${modifierIds.join(",")}|${loadout.id}|${seed}`}
        encounterId={encounter.id}
        modifierIds={modifierIds}
        setup={loadout.setup}
        quickPrayers={loadout.quickPrayers}
        seed={seed}
        speedOverride={params.get("speed") ? Number(params.get("speed")) : undefined}
        autoRetaliateOverride={params.get("retaliate") ? params.get("retaliate") === "1" : undefined}
        onChangeSetup={() => navigate("/encounters")}
      />
      {snapshot && <GameInterface snapshot={snapshot} content={content} />}
    </div>
  );
}
