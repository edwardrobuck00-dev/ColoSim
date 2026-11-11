# Adding art

Every character, projectile and arena currently uses **original placeholder
art built from primitives at runtime**. The renderer is built so real models
can replace them without code changes.

## Licensing first

Only use art you made, commissioned, or that has a licence allowing use in
this project. Record every third-party file in `packages/assets/LICENSES.md`.
Do **not** use models, textures, animations or sprites extracted from the Old
School RuneScape game client or copied from other fan sites. "OSRS-style"
means the *look* (low-poly, flat-shaded, chunky proportions), never the
original files.

## Character models

1. Export a **GLB** (binary glTF 2.0). Y is up. The character faces **+Z**
   (if it does not, set `rotationY`). Feet at Y = 0.
2. Scale: **1 unit = 1 game tile**. A human is about 1.7 units tall; a size-3
   boss stands on a 3 x 3 footprint.
3. Name animation clips however you like, then map engine cues to them.
   Cues the engine and renderer use:

   | Cue | When |
   |---|---|
   | `idle`, `walk`, `run` | Looping locomotion |
   | `attack.slash`, `attack.stab`, `attack.crush`, `attack.punch` | Player melee (from the weapon) |
   | `attack.shoot`, `attack.cast` | Player ranged and magic |
   | `attack.slam`, `attack.cast`, `attack.throw` | Ashen Warden attacks (from content) |
   | `hit` | Taking damage (skipped if an attack is playing) |
   | `death` | Dying (holds its last frame) |

   Missing cues fall back along their name: `attack.slash` -> `attack` ->
   (nothing). Provide at least `idle` and `attack`.
4. Put the file under `packages/app/public/models/` and point the visual at it
   in `packages/assets/src/manifest.ts`:

   ```ts
   {
     id: "npc.ashen-warden",
     placeholder: { rig: "brute", color: "#3a2a26", height: 3.6 },
     model: { url: "/models/ashen-warden.glb", scale: 1, rotationY: 0 },
     animations: { idle: "Idle", walk: "Walk", attack: "Swipe", "attack.slam": "Slam", hit: "Flinch", death: "Die" },
   }
   ```

The placeholder shows immediately; the model replaces it as soon as it has
loaded. If loading fails, the placeholder stays and a warning is logged.

## How it fits together

| Piece | File |
|---|---|
| Visual definitions (placeholder, model, cue map) | `packages/assets/src/manifest.ts` |
| Loading and cloning GLBs (shared across entities) | `packages/render/src/characters/model-cache.ts` |
| Placeholder or model, swapped transparently | `packages/render/src/characters/character.ts` |
| Animator interface | `packages/render/src/animation/animator.ts` |
| Model animation playback | `packages/render/src/animation/gltf-animator.ts` |
| Placeholder animation (procedural) | `packages/render/src/animation/procedural-*.ts` |

## Projectiles and arenas

Projectile looks (`shape`, colours, size, arc height, trail) and arena moods
(floor colours, lighting, obstacles, braziers, embers) are also in
`manifest.ts`. A projectile model can be added the same way as characters
when needed.
