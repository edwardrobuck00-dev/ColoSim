import type { PlayerSetup } from "@sim/engine";
import { CONFIG_KIND_LABELS, CONFIG_KINDS, type ConfigKind, type ConfigRecord, type EncounterConfig, type ImportReport } from "@sim/storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { configs } from "../services/configs";
import { content } from "../services/content";
import { PRESETS, saveCustomLoadout, type Loadout } from "../services/loadouts";
import { Button } from "../ui/components/Button";
import { LoadoutEditor } from "../ui/loadout/LoadoutEditor";
import { encounterPresetUrl } from "../utils/presets";
import { fightUrl } from "../utils/urls";
import styles from "./pages.module.css";

const item = (id: string) => content.items.get(id)?.name ?? id;
const prayer = (id: string) => content.prayers.get(id)?.name ?? id;
const entryId = (e: unknown) => (typeof e === "string" ? e : (e as { itemId: string }).itemId);

/** One-line description of a saved configuration; old or hand-edited data that cannot be read says so. */
function summary(r: ConfigRecord): string {
  try {
    return describeConfig(r);
  } catch {
    return "This setup's data can't be read; delete it or import a fresh copy.";
  }
}

function describeConfig(r: ConfigRecord): string {
  const d = r.data as Record<string, unknown>;
  switch (r.kind) {
    case "loadout": {
      const eq = Object.values((d.equipment ?? {}) as Record<string, unknown>);
      const inv = ((d.inventory ?? []) as unknown[]).filter(Boolean);
      const weapon = (d.equipment as Record<string, unknown> | undefined)?.weapon;
      return `${weapon ? item(entryId(weapon)) : "Unarmed"} · ${eq.length} worn · ${inv.length} in inventory`;
    }
    case "equipment": return Object.values((d.equipment ?? {}) as Record<string, unknown>).map((e) => item(entryId(e))).join(", ") || "Nothing worn";
    case "stats": { const s = d as Record<string, number>; return `Atk ${s.attack} · Str ${s.strength} · Def ${s.defence} · Rng ${s.ranged} · Mag ${s.magic} · Pray ${s.prayer} · HP ${s.hitpoints}`; }
    case "inventory": { const inv = ((d.inventory ?? []) as unknown[]).filter(Boolean); return `${inv.length}/28: ${[...new Set(inv.map((e) => item(entryId(e))))].join(", ")}`; }
    case "prayers": return `Start: ${(d.start as string[]).map(prayer).join(", ") || "none"} · Quick: ${(d.quick as string[]).map(prayer).join(", ") || "none"}`;
    case "encounter": {
      const e = d as unknown as EncounterConfig;
      const enc = content.encounters.get(e.encounterId);
      const mods = e.modifierIds.map((m) => content.modifiers.get(m)?.name ?? m);
      return `${enc?.name ?? e.encounterId}${mods.length ? ` + ${mods.join(", ")}` : ""} · ${e.seed.mode === "fixed" ? `seed ${e.seed.value}` : "random seed"} · ${e.speed}x`;
    }
  }
}

function download(name: string, data: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Saved setups: complete loadouts, and the parts they are made of (equipment,
 * stats, inventory, prayers), plus encounter presets. Use, edit, rename,
 * duplicate, delete, export and import. Saved on this device.
 */
export function LoadoutsPage() {
  const [params, setParams] = useSearchParams();
  const kind = (CONFIG_KINDS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as ConfigKind) : "loadout";
  const [rows, setRows] = useState<ConfigRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; name: string; setup: PlayerSetup; quick: string[] } | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = useCallback(() => void configs.list(kind).then(setRows).catch(() => setRows([])), [kind]);
  useEffect(refresh, [refresh]);

  const run = async (f: () => Promise<unknown>) => {
    try {
      setError(null);
      await f();
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (editing) {
    return (
      <div className={styles.page}>
        <h1>{editing.id ? "Edit loadout" : "New loadout"}</h1>
        <LoadoutEditor
          content={content}
          initialName={editing.name}
          initialSetup={editing.setup}
          initialQuickPrayers={editing.quick}
          onCancel={() => setEditing(null)}
          onSave={async (name, setup, quick) => {
            await saveCustomLoadout(editing.id, name, setup, quick);
            setEditing(null);
            refresh();
          }}
        />
      </div>
    );
  }

  const loadoutOf = (r: ConfigRecord) => {
    const { quickPrayers, ...setup } = r.data as PlayerSetup & { quickPrayers: string[] };
    return { setup, quick: quickPrayers };
  };
  const presetRow = (l: Loadout) => (
    <li key={l.id} className={styles.loadoutRow}>
      <span>{l.name} <small className={styles.note}>built in</small></span>
      <span className={styles.rowActions}>
        <Link to={fightUrl("training-grounds", [], l.id)}>Try</Link>
        <Button onClick={() => setEditing({ id: null, name: `${l.name} (copy)`, setup: structuredClone(l.setup), quick: [...l.quickPrayers] })}>Copy</Button>
      </span>
    </li>
  );

  const exportSelected = () => run(async () => {
    const bundle = await configs.exportBundle(selected.size ? [...selected] : undefined);
    download(`combat-sim-setups-${new Date().toISOString().slice(0, 10)}.json`, bundle);
  });

  return (
    <div className={styles.page}>
      <h1>Setups</h1>
      <p className={styles.note}>
        Save complete loadouts, or just their parts (equipment, stats, inventory, prayers) to mix into any loadout from the loadout editor.
        Encounter presets remember a boss, its modifiers, the loadout and the seed. Everything is saved on this device; export to move it elsewhere.
      </p>
      <nav className={styles.kindTabs} role="tablist" aria-label="Setup kinds">
        {CONFIG_KINDS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={k === kind} onClick={() => {
            setSelected(new Set());
            setParams({ tab: k });
          }}>{CONFIG_KIND_LABELS[k]}</button>
        ))}
      </nav>
      <div className={styles.toolbar}>
        {kind === "loadout" && (
          <Button variant="primary" onClick={() => setEditing({ id: null, name: "My loadout", setup: { ...structuredClone(PRESETS[0]!.setup), equipment: {}, inventory: [] }, quick: [] })}>
            New empty loadout
          </Button>
        )}
        <Button onClick={() => fileRef.current?.click()}>Import</Button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden aria-label="Setups file" onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void run(async () => setReport(await configs.importBundle(await f.text())));
        }} />
        <Button onClick={() => void exportSelected()}>{selected.size ? `Export ${selected.size} selected` : "Export all setups"}</Button>
      </div>
      {error && <p role="alert" className={styles.errorText}>{error}</p>}
      {report && (
        <div role="status" className={styles.report}>
          Imported {report.imported.length}{report.skipped.length ? `, skipped ${report.skipped.length}` : ""}.
          {report.skipped.length > 0 && <ul>{report.skipped.map((s, i) => <li key={i}>{s.name} ({s.kind}): {s.reason}</li>)}</ul>}
          <button type="button" className={styles.linkButton} onClick={() => setReport(null)}>Dismiss</button>
        </div>
      )}

      <h2>Your {CONFIG_KIND_LABELS[kind].toLowerCase()}</h2>
      {rows.length === 0 ? <p className={styles.note}>None yet.{kind !== "loadout" && kind !== "encounter" ? " Save one from the loadout editor." : kind === "encounter" ? " Save one from the boss selection screen." : ""}</p> : (
        <ul className={styles.loadoutList} aria-label={`Saved ${CONFIG_KIND_LABELS[kind].toLowerCase()}`}>
          {rows.map((r) => (
            <li key={r.id} className={styles.loadoutRow} data-testid={`config-${r.id}`}>
              <span className={styles.rowMain}>
                <input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.has(r.id)} onChange={() => setSelected((s) => {
                  const n = new Set(s);
                  if (n.has(r.id)) n.delete(r.id);
                  else n.add(r.id);
                  return n;
                })} />
                {renaming?.id === r.id ? (
                  <span className={styles.rowActions}>
                    <input aria-label="New name" value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} autoFocus
                      onKeyDown={(e) => e.key === "Enter" && void run(async () => { await configs.update(r.id, { name: renaming.name }); setRenaming(null); })} />
                    <Button onClick={() => void run(async () => { await configs.update(r.id, { name: renaming.name }); setRenaming(null); })}>Save</Button>
                  </span>
                ) : (
                  <span><strong>{r.name}</strong><br /><small className={styles.note}>{summary(r)}</small></span>
                )}
              </span>
              <span className={styles.rowActions}>
                {r.kind === "loadout" && <Link to={fightUrl("training-grounds", [], `custom:${r.id}`)}>Try</Link>}
                {r.kind === "encounter" && <Link to={encounterPresetUrl(r.data as EncounterConfig)}>Start</Link>}
                {r.kind === "loadout" && <Button onClick={() => setEditing({ id: `custom:${r.id}`, name: r.name, ...loadoutOf(r) })}>Edit</Button>}
                <Button onClick={() => setRenaming({ id: r.id, name: r.name })}>Rename</Button>
                <Button onClick={() => void run(() => configs.duplicate(r.id))}>Duplicate</Button>
                <Button onClick={() => void run(async () => download(`${r.name.replace(/[^\w-]+/g, "-")}.json`, await configs.exportBundle([r.id])))}>Export</Button>
                <Button variant="ghost" onClick={() => void run(() => configs.delete(r.id))}>Delete</Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {kind === "loadout" && (
        <>
          <h2>Built-in loadouts</h2>
          <ul className={styles.loadoutList}>{PRESETS.map(presetRow)}</ul>
        </>
      )}
    </div>
  );
}
