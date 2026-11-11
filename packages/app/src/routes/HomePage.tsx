import { Link } from "react-router";
import { fightUrl } from "../utils/urls";
import styles from "./pages.module.css";

export function HomePage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1>Practise boss fights, one tick at a time.</h1>
        <p>
          A browser-based, tick-accurate combat simulator. Every fight runs on a 600 ms game tick, can be paused and
          stepped, and resets instantly.
        </p>
        <div className={styles.heroActions}>
          <Link className={styles.ctaPrimary} to={fightUrl("training-grounds", [], "melee-70")}>Start training</Link>
          <Link className={styles.cta} to="/encounters">Choose an encounter</Link>
        </div>
      </section>
      <section className={styles.status}>
        <h2>Early build</h2>
        <ul>
          <li>Ready: OSRS combat formulas, real item stats and the full prayer book, on a 600 ms tick.</li>
          <li>Ready: a classic-style interface with F-key tabs, orbs, inventory, equipment, prayers, skills and a chatbox.</li>
          <li>Ready: pause, step forward and back, review any earlier tick, rewind and continue, and replays that rebuild a fight tick for tick.</li>
          <li>Ready: a data-driven boss framework (phases, attack patterns, telegraphed specials, enrage) and the three-phase Ashen Warden.</li>
          <li>Ready: saved setups (loadouts, equipment, stats, inventory, prayers, encounter presets) with export and import, and 160 wiki-verified items.</li>
          <li>Coming next: a Colosseum-style wave gauntlet built on the framework.</li>
        </ul>
      </section>
    </div>
  );
}
