# Visual style and interface

The simulator should feel familiar to someone who plays classic tick-based
MMO boss fights, so that what you practise here transfers. It does this with
the genre's conventions and a consistent colour language. Every model, icon,
texture and font is original or openly licensed; nothing is copied or traced
from any game's art.

## Colour language

Keep these consistent across every encounter. A player should be able to
react to a colour without reading anything.

| Colour | Meaning | Where |
|---|---|---|
| Blue / violet glowing orb | Magic attack | Projectiles (`projectile.warden-magic`, `projectile.arcane-bolt`) |
| Green projectile (arrow, lobbed rock) | Ranged attack | Projectiles (`projectile.warden-ranged`) |
| No projectile, weapon swing | Melee attack | Boss animation; stand next to it and it hits |
| Orange fire | Player fire spells, braziers | `projectile.fire-bolt`, arena decoration |
| Glowing orange-yellow tiles, pulsing faster near the end | Telegraphed area attack: move off before it bursts | `effects/hazards.ts` |
| Red-orange tiles with flames | Burning ground: hurts every tick you stand on it | |
| Green hitsplat | Healing (the Warden feeding on fire) | |
| Expanding ring on the floor | A moment worth noticing: orange for detonating fire and phase changes, red for enrage, gold for your special attack, white for Redemption | `effects/bursts.ts` |
| Red tint on the boss | Enraged | `characters/character.ts` (`setTint`) |
| Golden shimmer around the boss | Immune (phase transition) | `entities/entity-view.ts` |
| Red hitsplat, white number | Damage taken or dealt | `effects/textures.ts` |
| Blue hitsplat | Zero damage (miss or blocked) | |
| Red hitsplat with a gold rim | A max hit | |
| Yellow text above a character | Something the boss says (mechanic announcements) | `effects/overhead-text.ts` |
| Yellow cross | Walk click | `ui/game/ClickCrosses.tsx` |
| Red cross | Attack click | |
| Overhead badge above the player | Active protection prayer: red with a blade (melee), green with an arrow (ranged), blue with a star (magic), a cross (Redemption) | `effects/textures.ts` (`overhead`) |
| Orbs: red, cyan, yellow, green | Hitpoints, Prayer, Run energy, Special attack | `ui/game/Orbs.tsx` |

New attack visuals go in `packages/assets/src/manifest.ts`; pick the colour
from this table.

## The 3D view

- Matte, flat-shaded low-poly models (`MeshLambertMaterial`), soft even
  lighting, no shadow maps. Characters get a round blob shadow.
- The floor is one vertex-coloured terrain mesh: no visible tile grid. Tile
  markers (true tile, destination, target, hover) show the grid where it matters.
- The camera centres on the player. Arrow keys or middle-drag rotate, the
  wheel zooms, C resets.
- Characters wear their gear. `packages/assets/src/appearance.ts` gives every
  item a shape and two colours (rune is cyan-blue, dragon is red, Armadyl is
  white and gold, and so on). The humanoid rig draws the helmet, body, legs,
  skirt, cape, shield, gloves, boots and amulet from it, and the held weapon
  has its own shape (whip, scimitar, godsword, crossbow and so on).
- Hitsplats appear at full size, hold still for about two ticks and vanish.
- Eating and drinking play their own short animations; special attacks use a
  wind-up strike unless the weapon names its own.
- The scene is a pure function of simulation state and events. The renderer
  reports what it draws (`renderState()`), and `compareRenderToSnapshot`
  lists any difference from the snapshot: positions, health bars, death,
  overhead prayer, boss enrage and immunity, projectiles in flight and
  hazards. A browser test samples this hundreds of times in a live fight while
  the player does everything (`packages/app/e2e/consistency.spec.ts`). In the
  app it is available as `window.__simDebug.consistency()`.

## The interface

| Part | Where | Notes |
|---|---|---|
| Side panel | `ui/game/GameInterface.tsx` | Minimap with orbs on top, a row of four tabs above and below the open panel |
| Tabs | `ui/game/tabs/` | Combat, Skills, Inventory, Equipment / Prayer, Magic, Info, Simulation |
| Tab keys | Settings page | F1 Combat, F2 Skills, F3 Inventory, F4 Equipment, F5 Prayer, F6 Magic, F7 Info, F8 Simulation. All remappable. If your browser keeps a key for itself (some reserve F6 or F11), map that tab to another key. |
| Chatbox | `ui/game/Chatbox.tsx` | Bottom-left of the view. Filters: All, Game, Combat, Boss |
| Mouseover text | `ui/game/MouseText.tsx` | Top-left: "Walk here", "Attack The Ashen Warden", "Drink Super combat potion(4)" |
| Boss health bar | `ui/game/BossBar.tsx` | Top centre, green over red, with the phase ("Phase 2/3: Kindled"), "Enraged", and grey with "Immune" while invulnerable |
| Simulator controls | `ui/hud/FightControls.tsx` | Bottom-right: pause, step, run, reset, speed. Not part of the classic interface |

Icons (`ui/game/icons.tsx`) are original SVG drawings: tab icons, skill icons,
a glyph per prayer (coloured by tier: bronze, silver, gold) and item icons
drawn from the appearance table (potions show their dose level).

The font is [Pixelify Sans](https://github.com/eifetx/Pixelify-Sans) (SIL Open
Font License 1.1), installed from `@fontsource/pixelify-sans`.
