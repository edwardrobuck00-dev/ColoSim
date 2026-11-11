import type { WorldSnapshot } from "@sim/engine";
import { useEffect, useRef } from "react";
import styles from "./game.module.css";

const PX = 7; // pixels per tile
const SIZE = 168;

/**
 * North-up minimap centred on the player: floor, blocked tiles, NPCs as
 * yellow dots and the player as a white dot.
 */
export function Minimap({ snapshot }: { snapshot: WorldSnapshot }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const { arena, player, npcs } = snapshot;
    const ox = SIZE / 2 - (player.pos.x + 0.5) * PX;
    const oy = SIZE / 2 + (player.pos.y + 0.5) * PX;
    const tx = (x: number) => ox + x * PX;
    const ty = (y: number) => oy - (y + 1) * PX;
    ctx.fillStyle = "#2a2117";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "#5a4a34";
    ctx.fillRect(tx(-1), ty(arena.height), (arena.width + 2) * PX, (arena.height + 2) * PX);
    ctx.fillStyle = "#9c7d4c";
    ctx.fillRect(tx(0), ty(arena.height - 1), arena.width * PX, arena.height * PX);
    ctx.fillStyle = "#4a4038";
    for (const b of arena.blocked) ctx.fillRect(tx(b.x), ty(b.y), PX, PX);
    for (const n of npcs) {
      if (!n.alive) continue;
      ctx.fillStyle = "#ffff00";
      const c = { x: tx(n.pos.x) + (n.size * PX) / 2, y: ty(n.pos.y) + PX - (n.size * PX) / 2 };
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.max(2.5, n.size * 1.6), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.stroke();
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(SIZE / 2 - 2, SIZE / 2 - 2, 4, 4);
    if (player.destination) {
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(tx(player.destination.x) + PX / 2 - 1.5, ty(player.destination.y) + PX / 2 - 1.5, 3, 3);
    }
  }, [snapshot]);
  return (
    <div className={styles.minimap}>
      <canvas ref={ref} width={SIZE} height={SIZE} aria-label="Minimap" role="img" />
    </div>
  );
}
