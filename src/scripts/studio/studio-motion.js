// One render per display frame. Suspending also resets the clock, so returning
// from another tab or an offscreen section cannot advance the scene in a jump.
export function createStudioFrameLoop({
  render,
  canRender,
  onReady = () => {},
  onError = () => {},
  requestFrame = (callback) => requestAnimationFrame(callback),
  cancelFrame = (id) => cancelAnimationFrame(id),
}) {
  let pending = null;
  let previousTime = null;
  let ready = false;
  let disposed = false;

  function request() {
    if (pending !== null || disposed || !canRender()) return;
    pending = requestFrame(frame);
  }

  function suspend() {
    if (pending !== null) cancelFrame(pending);
    pending = null;
    previousTime = null;
  }

  function frame(timestamp) {
    pending = null;
    if (disposed || !canRender()) {
      previousTime = null;
      return;
    }
    const dt = previousTime === null
      ? 0
      : Math.min(0.05, Math.max(0, (timestamp - previousTime) / 1000));
    previousTime = timestamp;
    let moving;
    try {
      moving = render(dt);
    } catch (error) {
      disposed = true;
      suspend();
      onError(error);
      return;
    }
    if (!ready) {
      ready = true;
      onReady();
    }
    if (moving) request();
    else previousTime = null;
  }

  return {
    request,
    suspend,
    dispose() {
      disposed = true;
      suspend();
    },
  };
}
