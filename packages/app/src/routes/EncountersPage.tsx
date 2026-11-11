import type { EncounterDef } from "@sim/engine";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { content } from "../services/content";
import { PRESETS, listCustomLoadouts, type Loadout } from "../services/loadouts";
import { bossInfo } from "../utils/boss-info";
import { encounterPresetUrl } from "../utils/presets";
import { configs } from "../services/configs";
import { useSettingsStore } from "../state/settings-store";
import type { ConfigRecord, EncounterConfig } from "@sim/storage";
import styles from "./bosses.module.css";

/**
 * Boss selection: a list of encounters and, for the selected one, everything
 * the data says about the boss (stats, attacks, phases, specials, enrage,
 * rules), plus modifiers and a loadout. Built from definitions only.
 */
export function EncountersPage() {
  const encounters = useMemo(() => [...content.encounters.values()].sort((a, b) => Number(b.tags.includes("boss")) - Number(a.tags.includes("boss"))), []);
  const [params, setParams] = useSearchParams();
  const selected = encounters.find((e) => e.id === params.get("boss")) ?? encounters[0]!;
  return (
    <div className={styles.page}>
      <nav className={styles.list} aria-label="Bosses">
        <h1 className={styles.listTitle}>Choose a boss</h1>
        {encounters.map((e) => {
          const npc = content.npcs.get(e.npcs[0]?.npcId ?? "");
          const info = bossInfo(content, e);
          return (
            <button key={e.id} type="button" className={styles.entry} aria-pressed={e.id === selected.id} onClick={() => setParams({ boss: e.id })}>
              <span className={styles.entryName}>{e.name}</span>
              <span className={styles.entryMeta}>
                {info ? `Level ${info.combatLevel} · ${npc?.stats.hitpoints} HP` : ""}
                {info && info.phases.length > 1 ? ` · ${info.phases.length} phases` : ""}
              </span>
            </button>
          );
        })}
      </nav>
      <BossDetails key={selected.id} encounter={selected} />
    </div>
  );
}

const STYLE_LABEL = { magic: "Magic (blue-violet orb)", ranged: "Ranged (green projectile)", melee: "Melee (no projectile)" } as const;

function BossDetails({ encounter }: { encounter: EncounterDef }) {
  const navigate = useNavigate();
  const info = bossInfo(content, encounter);
  const [mods, setMods] = useState<string[]>([]);
  const [loadoutId, setLoadoutId] = useState(PRESETS[0]!.id);
  const [seedMode, setSeedMode] = useState<"random" | "fixed">("random");
  const [seedValue, setSeedValue] = useState(1);
  const [retaliate, setRetaliate] = useState(() => useSettingsStore.getState().settings.autoRetaliate);
  const [presetName, setPresetName] = useState<string | null>(null);
  const [presets, setPresets] = useState<Array<ConfigRecord<EncounterConfig>>>([]);
  const [presetMsg, setPresetMsg] = useState<string | null>(null);
  const loadPresets = () => void configs.list("encounter").then((rows) => setPresets(rows.filter((r) => r.data.encounterId === encounter.id))).catch(() => setPresets([]));
  useEffect(loadPresets, [encounter.id]);
  const current = (): EncounterConfig => ({
    encounterId: encounter.id, modifierIds: mods, loadoutId,
    seed: seedMode === "fixed" ? { mode: "fixed", value: seedValue } : { mode: "random" },
    speed: useSettingsStore.getState().settings.speed, autoRetaliate: retaliate,
  });
  const savePreset = async () => {
    try {
      const rec = await configs.create("encounter", presetName || encounter.name, current());
      setPresetMsg(`Saved preset "${rec.name}".`);
      setPresetName(null);
      loadPresets();
    } catch (e) {
      setPresetMsg((e as Error).message);
    }
  };
  const [custom, setCustom] = useState<Loadout[]>([]);
  useEffect(() => void listCustomLoadouts().then(setCustom), []);
  const toggle = (id: string) => setMods((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  const npc = info?.npc;

  return (
    <article className={styles.details} data-testid={`encounter-${encounter.id}`}>
      <header className={styles.head}>
        <h2>{encounter.name}</h2>
        <div className={styles.tags}>{encounter.tags.map((t) => <span key={t}>{t}</span>)}</div>
      </header>
      <p className={styles.desc}>{encounter.description}</p>

      <div className={styles.columns}>
        <div>
          {npc && info && (
            <>
              <h3>Stats</h3>
              <dl className={styles.stats} aria-label="Boss stats">
                <div><dt>Combat level</dt><dd>{info.combatLevel}</dd></div>
                <div><dt>Hitpoints</dt><dd>{npc.stats.hitpoints}</dd></div>
                <div><dt>Size</dt><dd>{npc.size}x{npc.size}</dd></div>
                <div><dt>Attack / Strength</dt><dd>{npc.stats.attack} / {npc.stats.strength}</dd></div>
                <div><dt>Defence</dt><dd>{npc.stats.defence}</dd></div>
                <div><dt>Ranged / Magic</dt><dd>{npc.stats.ranged} / {npc.stats.magic}</dd></div>
              </dl>
              <h3>Defence bonuses</h3>
              <table className={styles.table}>
                <thead><tr><th /><th>Stab</th><th>Slash</th><th>Crush</th><th>Ranged</th><th>Magic</th></tr></thead>
                <tbody>
                  <tr><th>Base</th>{(["stab", "slash", "crush", "ranged", "magic"] as const).map((s) => <td key={s}>{npc.defence[s]}</td>)}</tr>
                  {npc.behaviour?.phases.filter((p) => p.defence).map((p) => (
                    <tr key={p.id}><th>{p.name ?? p.id}</th>{(["stab", "slash", "crush", "ranged", "magic"] as const).map((s) => <td key={s}>{p.defence![s]}</td>)}</tr>
                  ))}
                </tbody>
              </table>
              {info.attacks.length > 0 && (
                <>
                  <h3>Attacks</h3>
                  <table className={styles.table} aria-label="Attacks">
                    <thead><tr><th>Attack</th><th>Style</th><th>Max</th><th>Speed</th><th>Range</th></tr></thead>
                    <tbody>
                      {info.attacks.map((a) => (
                        <tr key={a.id}>
                          <th>{a.name}</th>
                          <td><span className={styles.dot} data-kind={a.kind} title={STYLE_LABEL[a.kind]} /> {a.style}</td>
                          <td>{a.maxHit}</td>
                          <td>{a.speedTicks}t</td>
                          <td>{a.rangeTiles}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </>
          )}
        </div>
        <div>
          {info && info.phases.length > 0 && info.attacks.length > 0 && (
            <>
              <h3>Phases</h3>
              <ol className={styles.phases}>
                {info.phases.map((p) => (
                  <li key={p.name}>
                    <strong>{p.name}</strong> <span className={styles.from}>from {p.from}</span>
                    <ul>{p.lines.map((l) => <li key={l}>{l}</li>)}</ul>
                  </li>
                ))}
              </ol>
            </>
          )}
          {info && info.specials.length > 0 && (
            <>
              <h3>Special attacks</h3>
              <dl className={styles.specials}>
                {info.specials.map((s) => <div key={s.name}><dt>{s.name}</dt><dd>{s.text}</dd></div>)}
              </dl>
            </>
          )}
          {info?.enrage && <><h3>Enrage</h3><p className={styles.desc}>{info.enrage}</p></>}
          {info && info.rules.length > 0 && (
            <>
              <h3>Encounter rules</h3>
              <ul className={styles.rules}>{info.rules.map((r) => <li key={r}>{r}</li>)}</ul>
            </>
          )}
        </div>
      </div>

      <div className={styles.start}>
        {encounter.modifiers.length > 0 && (
          <fieldset className={styles.fieldset}>
            <legend>Modifiers</legend>
            {encounter.modifiers.map((id) => {
              const mod = content.modifiers.get(id);
              if (!mod) return null;
              return (
                <label key={id} className={styles.mod}>
                  <input type="checkbox" checked={mods.includes(id)} onChange={() => toggle(id)} />
                  <span><strong>{mod.name}</strong> <small>{mod.description}</small></span>
                </label>
              );
            })}
          </fieldset>
        )}
        <label className={styles.loadout}>
          Loadout
          <select value={loadoutId} onChange={(e) => setLoadoutId(e.target.value)}>
            {[...custom, ...PRESETS].map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className={styles.loadout}>
          Seed
          <span className={styles.seedRow}>
            <select aria-label="Seed mode" value={seedMode} onChange={(e) => setSeedMode(e.target.value as "random" | "fixed")}>
              <option value="random">Random each fight</option>
              <option value="fixed">Fixed</option>
            </select>
            {seedMode === "fixed" && <input type="number" aria-label="Seed" value={seedValue} onChange={(e) => setSeedValue(Math.trunc(Number(e.target.value)) || 0)} />}
          </span>
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={retaliate} onChange={(e) => setRetaliate(e.target.checked)} /> Auto Retaliate
        </label>
        <button type="button" className={styles.startButton} onClick={() => navigate(encounterPresetUrl(current(), { speed: false, retaliate: retaliate !== useSettingsStore.getState().settings.autoRetaliate }))}>
          Start
        </button>
        {presetName === null ? (
          <button type="button" className={styles.secondary} onClick={() => setPresetName(`${encounter.name}${mods.length ? " (modified)" : ""}`)}>Save as preset</button>
        ) : (
          <span className={styles.seedRow}>
            <input aria-label="Preset name" value={presetName} onChange={(e) => setPresetName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void savePreset()} autoFocus />
            <button type="button" className={styles.secondary} onClick={() => void savePreset()}>Save</button>
          </span>
        )}
        {presetMsg && <span role="status" className={styles.presetMsg}>{presetMsg}</span>}
      </div>
      {presets.length > 0 && (
        <section className={styles.presets} aria-label="Your presets for this boss">
          <h3>Your presets</h3>
          <ul>
            {presets.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <small>{p.data.modifierIds.map((m) => content.modifiers.get(m)?.name ?? m).join(", ") || "No modifiers"} · {p.data.seed.mode === "fixed" ? `seed ${p.data.seed.value}` : "random seed"}</small>
                <Link to={encounterPresetUrl(p.data)} className={styles.secondary}>Start</Link>
                <button type="button" className={styles.secondary} onClick={() => void configs.delete(p.id).then(loadPresets)}>Delete</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
