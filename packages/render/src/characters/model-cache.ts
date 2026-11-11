import type { ModelRef } from "@sim/assets";
import type { AnimationClip, Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

export interface LoadedModel {
  scene: Object3D;
  animations: AnimationClip[];
}

export interface ModelLoader {
  loadAsync(url: string): Promise<LoadedModel>;
}

/**
 * Loads each GLB once and hands out independent clones (skinned meshes
 * included), so many entities can share one download.
 */
export class ModelCache {
  private readonly pending = new Map<string, Promise<LoadedModel>>();

  constructor(private readonly loader: ModelLoader = new GLTFLoader()) {}

  async instantiate(ref: ModelRef): Promise<LoadedModel> {
    let p = this.pending.get(ref.url);
    if (!p) {
      p = this.loader.loadAsync(ref.url);
      this.pending.set(ref.url, p);
      p.catch(() => this.pending.delete(ref.url)); // allow a retry later
    }
    const base = await p;
    const scene = cloneSkinned(base.scene);
    scene.scale.setScalar(ref.scale);
    scene.rotation.y = ref.rotationY;
    scene.position.y = ref.yOffset;
    scene.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    return { scene, animations: base.animations };
  }
}
