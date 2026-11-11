import type { PlayerSetup, Replay } from "@sim/engine";
import { SceneRenderer, compareRenderToSnapshot } from "@sim/render";
import { snapSpeed } from "@sim/storage";
import { useEffect, useMemo, useRef, useState } from "react";
import { SimulationHost } from "../../host/simulation-host";
import { commandForClick } from "../../input/command-mapper";
import { HELD_ACTIONS, actionForKey, cameraVelocity, tabForAction, type KeyAction } from "../../input/keybinds";
import { arenaVisualIdFor, content, createVisualLookup } from "../../services/content";
import { repositories } from "../../services/storage";
import { useSessionStore } from "../../state/session-store";
import { useSettingsStore } from "../../state/settings-store";
import { useUiStore } from "../../state/ui-store";
import { randomSeed } from "../../utils/seed";
import { FightControls, type FightControlActions } from "../hud/FightControls";
import { BossBar } from "../game/BossBar";
import { Chatbox } from "../game/Chatbox";
import { ClickCrosses, type ClickCross } from "../game/ClickCrosses";
import { MouseText } from "../game/MouseText";
import { AnalyticsWindow } from "../analytics/AnalyticsWindow";
import { TickIndicator } from "../hud/TickIndicator";
import { ResultsOverlay } from "../results/ResultsOverlay";
import styles from "./arena.module.css";

export interface ArenaViewProps {
  encounterId: string;
  modifierIds: string[];
  setup: PlayerSetup;
  /** Seed for the first fight (from the URL), or a random one. */
  seed: number;
  /** Watch this saved fight instead of playing a new one. */
  replay?: Replay;
  /** Prayers the prayer orb toggles (from the loadout). */
  quickPrayers?: string[];
  /** From an encounter preset: start at this speed / with this auto retaliate setting instead of the saved settings. */
  speedOverride?: number;
  autoRetaliateOverride?: boolean;
  onChangeSetup: () => void;
}

function supportsWebGL(): boolean {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

/** Keys go to text fields while typing; sliders, checkboxes and buttons keep the game's shortcuts. */
const NON_TEXT_INPUTS = new Set(["range", "checkbox", "radio", "button", "submit", "color"]);
const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || (t instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(t.type)));

async function persistResult(replay: Replay): Promise<void> {
  try {
    const id = await repositories.replays.save(replay);
    useSessionStore.getState().setLastReplayId(id);
    await repositories.attempts.record({
      encounterId: replay.config.encounterId,
      modifierIds: replay.config.modifierIds,
      result: replay.outcome?.result ?? "abandoned",
      durationTicks: replay.durationTicks,
    });
  } catch (e) {
    console.warn("Could not save the replay (storage unavailable?)", e);
  }
}

/** Waits for the death animation to play before covering the arena with the results. */
function DelayedResults(props: Parameters<typeof ResultsOverlay>[0]) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), RESULTS_DELAY_MS);
    return () => clearTimeout(t);
  }, []);
  return visible ? <ResultsOverlay {...props} /> : null;
}

const RESULTS_DELAY_MS = 1600;

/**
 * The fight screen's canvas and HUD. Creates the renderer and simulation host,
 * wires input to engine commands, and tears everything down on unmount.
 * Remount (change `key`) to start a fight with a different setup.
 */
export function ArenaView({ encounterId, modifierIds, setup, seed, onChangeSetup, replay, quickPrayers = [], speedOverride, autoRetaliateOverride }: ArenaViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<SimulationHost | null>(null);
  const [webgl] = useState(supportsWebGL);
  const snapshot = useSessionStore((s) => s.snapshot);
  const runState = useSessionStore((s) => s.runState);
  const speed = useSessionStore((s) => s.speed);
  const currentSeed = useSessionStore((s) => s.seed);
  const [crosses, setCrosses] = useState<ClickCross[]>([]);

  const actions = useMemo<FightControlActions>(
    () => ({
      togglePause: () => hostRef.current?.togglePause(),
      step: () => hostRef.current?.step(),
      stepBack: () => hostRef.current?.stepBack(),
      seek: (t) => hostRef.current?.seek(t),
      goLive: () => hostRef.current?.goLive(false),
      continueFromHere: () => hostRef.current?.continueFromHere(),
      reset: () => hostRef.current?.reset(useSettingsStore.getState().settings.lockSeed ? "same" : "new"),
      resetSameSeed: () => hostRef.current?.reset("same"),
      toggleRun: () => {
        const host = hostRef.current;
        if (host) host.queueCommand({ type: "setRun", running: !host.getSnapshot().player.running });
      },
      setSpeed: (s) => useSettingsStore.getState().update({ speed: s }),
    }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !webgl) return;
    let renderer: SceneRenderer;
    try {
      renderer = new SceneRenderer({
        canvas,
        visualLookup: createVisualLookup(content),
        arenaVisualId: arenaVisualIdFor(content, encounterId),
      });
    } catch (e) {
      console.error("Could not create the WebGL renderer", e);
      return;
    }

    if (speedOverride !== undefined && Number.isFinite(speedOverride)) useSettingsStore.getState().update({ speed: snapSpeed(speedOverride) });
    const settings = useSettingsStore.getState().settings;
    useSessionStore.getState().setQuickPrayers(quickPrayers);
    const session = useSessionStore.getState;
    const held = new Set<KeyAction>();

    session().setSpeed(settings.speed);
    const host = new SimulationHost({
      content,
      encounterId,
      modifierIds,
      player: { ...setup, autoRetaliate: autoRetaliateOverride ?? settings.autoRetaliate },
      renderer,
      seed,
      seedSource: randomSeed,
      speed: settings.speed,
      replay,
      onStart: (snap, events, s, history) => session().begin(snap, events, s, history),
      onView: (record, history, mode) => session().view(record, history, mode),
      onModeChange: (mode) => session().setMode(mode),
      onTick: (result) => session().applyTick(result),
      onStateChange: (state) => session().setRunState(state),
      onEnd: (_result, replay) => void persistResult(replay),
      onFrame: (elapsedMs) => {
        const v = cameraVelocity(held);
        if (v.yaw || v.pitch) renderer.orbit.rotate((v.yaw * elapsedMs) / 1000, (v.pitch * elapsedMs) / 1000);
      },
    });
    hostRef.current = host;
    renderer.setFollowPlayer(settings.followCamera);

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      renderer.resize(Math.max(1, r.width), Math.max(1, r.height));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const ui = useUiStore.getState;
    let crossId = 0;
    const run = (action: KeyAction) => {
      const tab = tabForAction(action);
      if (tab) ui().setTab(tab);
      else if (action === "toggleAnalytics") ui().setAnalytics(!ui().analyticsOpen);
      else if (action === "pause") actions.togglePause();
      else if (action === "step") actions.step();
      else if (action === "stepBack") actions.stepBack();
      else if (action === "goLive") actions.goLive();
      else if (action === "reset") actions.reset();
      else if (action === "toggleRun") actions.toggleRun();
      else if (action === "cameraReset") renderer.resetCamera();
      else if (action === "toggleSpecial") host.queueCommand({ type: "toggleSpecial" });
      else if (action === "protectMelee" || action === "protectRanged" || action === "protectMagic") {
        const cls = action === "protectMelee" ? "melee" : action === "protectRanged" ? "ranged" : "magic";
        const prayer = [...content.prayers.values()].find((pr) => pr.protects === cls);
        if (prayer) host.queueCommand({ type: "togglePrayer", prayerId: prayer.id });
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const action = actionForKey(e.code, useSettingsStore.getState().settings.keybinds);
      if (!action) return;
      e.preventDefault();
      if (HELD_ACTIONS.has(action)) held.add(action);
      else if (!e.repeat) run(action);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const action = actionForKey(e.code, useSettingsStore.getState().settings.keybinds);
      if (action) held.delete(action);
    };
    const onBlur = () => held.clear();

    // Mouse: left click = move/attack, middle drag = rotate, wheel = zoom.
    let drag: { x: number; y: number } | null = null;
    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 1) {
        drag = { x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
      } else if (e.button === 0) {
        const cmd = commandForClick({ entityId: renderer.pickEntity(e.clientX, e.clientY), tile: renderer.pickTile(e.clientX, e.clientY) });
        if (cmd) {
          host.queueCommand(cmd);
          const r = canvas.getBoundingClientRect();
          const cross: ClickCross = { id: ++crossId, x: e.clientX - r.left, y: e.clientY - r.top, kind: cmd.type === "attack" ? "attack" : "walk" };
          setCrosses((cs) => [...cs.slice(-3), cross]);
          setTimeout(() => setCrosses((cs) => cs.filter((c) => c.id !== cross.id)), 450);
        }
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (drag) {
        renderer.orbit.rotate((e.clientX - drag.x) * -0.008, (e.clientY - drag.y) * 0.006);
        drag = { x: e.clientX, y: e.clientY };
      }
      const tile = renderer.pickTile(e.clientX, e.clientY);
      if (useSettingsStore.getState().settings.showHoverTile) renderer.setHoverTile(tile);
      // Mouseover text: what a left click would do here.
      const entityId = renderer.pickEntity(e.clientX, e.clientY);
      const npc = entityId ? host.getSnapshot().npcs.find((n) => n.id === entityId && n.alive) : undefined;
      ui().setHoverText(npc ? `Attack ${npc.name}` : tile ? "Walk here" : null);
    };
    const onPointerUp = () => {
      drag = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      renderer.orbit.zoom(e.deltaY > 0 ? 1.1 : 1 / 1.1);
    };
    const onPointerLeave = () => {
      renderer.setHoverTile(null);
      ui().setHoverText(null);
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);

    const unsubscribe = useSettingsStore.subscribe(({ settings: s }) => {
      host.setSpeed(s.speed);
      session().setSpeed(s.speed);
      renderer.setFollowPlayer(s.followCamera);
      if (!s.showHoverTile) renderer.setHoverTile(null);
    });

    session().setSender((cmd) => host.queueCommand(cmd));
    session().setMode(host.mode);
    session().setControls({
      seek: (t) => host.seek(t),
      stepBack: () => host.stepBack(),
      goLive: (resume) => host.goLive(resume),
      continueFromHere: () => host.continueFromHere(),
    });
    host.start();
    // Read-only hook for browser tests and debugging: what the renderer is showing.
    window.__simDebug = {
      renderer: () => renderer.stats(),
      snapshot: () => host.getSnapshot(),
      runner: () => ({
        state: host.state, seed: host.getSnapshot().seed, speed: host.runner?.speed ?? 1,
        hash: host.history.at(host.viewTick)?.hash ?? "", mode: host.mode, viewTick: host.viewTick, latestTick: host.history.latestTick,
      }),
      screenPosition: (id) => renderer.screenPosition(id),
      pick: (x, y) => ({ entityId: renderer.pickEntity(x, y), tile: renderer.pickTile(x, y) }),
      consistency: () => compareRenderToSnapshot(renderer.renderState(), host.getSnapshot()),
    };

    return () => {
      delete window.__simDebug;
      session().setSender(null);
      unsubscribe();
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
      host.dispose();
      renderer.dispose();
      hostRef.current = null;
      session().clear();
    };
    // The parent remounts this component (via `key`) when the setup changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showTick = useSettingsStore((s) => s.settings.showTickCounter);

  return (
    <div className={styles.arena}>
      <canvas ref={canvasRef} className={styles.canvas} data-testid="arena-canvas" />
      {!webgl && <div className={styles.error}>Your browser could not start WebGL, which the arena needs.</div>}
      {snapshot && (
        <>
          {showTick && <TickIndicator tick={snapshot.tick} state={runState} speed={speed} />}
          <MouseText />
          <BossBar snapshot={snapshot} />
          <ClickCrosses crosses={crosses} />
          <Chatbox />
          <AnalyticsWindow />
          <FightControls state={runState} speed={speed} actions={actions} />
          {snapshot.outcome && (
            <DelayedResults
              key={`${currentSeed}:${snapshot.outcome.tick}`}
              outcome={snapshot.outcome}
              seed={currentSeed}
              onRestart={actions.reset}
              onRestartSameSeed={actions.resetSameSeed}
              onChangeSetup={onChangeSetup}
            />
          )}
        </>
      )}
    </div>
  );
}
