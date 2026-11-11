import { describe, expect, it, vi } from "vitest";
import { FrameLoop, MAX_FRAME_MS } from "../src/host/frame-loop";

function fakeFrames() {
  let cb: ((t: number) => void) | null = null;
  return {
    deps: { requestFrame: (f: (t: number) => void) => ((cb = f), 1), cancelFrame: () => (cb = null) },
    fire: (t: number) => cb?.(t),
  };
}

describe("FrameLoop", () => {
  it("reports elapsed time between frames, starting at 0", () => {
    const f = fakeFrames();
    const onFrame = vi.fn();
    new FrameLoop(onFrame, f.deps).start();
    f.fire(100);
    f.fire(116);
    expect(onFrame.mock.calls.map((c) => c[0])).toEqual([0, 16]);
  });

  it("caps long gaps, such as a hidden tab", () => {
    const f = fakeFrames();
    const onFrame = vi.fn();
    new FrameLoop(onFrame, f.deps).start();
    f.fire(0);
    f.fire(60_000);
    expect(onFrame).toHaveBeenLastCalledWith(MAX_FRAME_MS, 60_000);
  });

  it("stops requesting frames after stop()", () => {
    const f = fakeFrames();
    const onFrame = vi.fn();
    const loop = new FrameLoop(onFrame, f.deps);
    loop.start();
    loop.stop();
    f.fire(10);
    expect(onFrame).not.toHaveBeenCalled();
    expect(loop.running).toBe(false);
  });
});
