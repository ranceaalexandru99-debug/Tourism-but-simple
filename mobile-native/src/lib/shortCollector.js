// Assembling a short from the messages the renderer WebView sends back.
//
// This was the body of ShortRenderer, a React component, which meant none of it
// could be tested: the chunk bookkeeping, the watchdog, and the sanitising of
// values that arrive in a message. That last part is not hygiene — the page is
// ours, but everything it renders comes from the user, and a caption was able
// to inject script into it once. Its messages are input.
//
// Here it is a plain object with no React and no file system of its own: the
// write is injected, so a test can watch it happen or make it fail.

// Only these two are ever legitimate, and the value lands in a filename.
// "mp4/../../x" would otherwise have written outside the shorts directory.
const EXTENSIONS = new Set(["mp4", "webm"]);
export const safeExtension = (mime) => (EXTENSIONS.has(mime) ? mime : "mp4");

// A render of twelve photos is around half a minute of real-time encoding, and
// legitimately quiet between progress reports. Silence for this long is not.
export const STALL_MS = 45000;

// A hostile or broken `begin` must not make us allocate an arbitrary array.
// Twelve photos produce a handful of chunks; a thousand is already absurd.
const MAX_PARTS = 1000;

/**
 * @param {object} opts
 * @param {(v:number)=>void}          opts.onProgress
 * @param {(uri:string,ext:string)=>void} opts.onDone
 * @param {(reason:string)=>void}     opts.onError
 * @param {(base64:string,ext:string)=>Promise<string>} opts.write
 *        Persists the assembled file and resolves to its URI.
 * @param {(fn:Function,ms:number)=>any} [opts.setTimer]   injectable for tests
 * @param {(id:any)=>void}               [opts.clearTimer]
 * @param {number}                       [opts.stallMs]
 */
export function createShortCollector({
  onProgress, onDone, onError, write,
  setTimer = setTimeout, clearTimer = clearTimeout, stallMs = STALL_MS,
} = {}) {
  let parts = [];
  let expected = 0;
  let mime = null;
  let settled = false;
  let timer = null;

  const stopWatchdog = () => { if (timer !== null) { clearTimer(timer); timer = null; } };

  const settle = (fn) => {
    if (settled) return false;
    settled = true;
    stopWatchdog();
    fn?.();
    return true;
  };

  // Reset on every message that parsed: the page reports progress continuously,
  // so only total silence means it has died. A fixed deadline would punish a
  // long render for being long.
  const kickWatchdog = () => {
    stopWatchdog();
    timer = setTimer(() => { settle(() => onError?.("stalled")); }, stallMs);
  };

  const finish = async () => {
    if (settled) return;
    for (let i = 0; i < expected; i++) {
      if (typeof parts[i] !== "string") { settle(() => onError?.("incomplete")); return; }
    }
    if (!expected) { settle(() => onError?.("incomplete")); return; }

    const ext = safeExtension(mime);
    try {
      const uri = await write(parts.join(""), ext);
      settle(() => onDone?.(uri, ext));
    } catch (e) {
      settle(() => onError?.(String(e?.message || e)));
    }
  };

  return {
    /** Arm the watchdog. Call when the renderer is mounted. */
    start() { if (!settled) kickWatchdog(); },

    /** Give up on this render — unmounting, or the WebView failed to load. */
    cancel(reason) { settle(reason ? () => onError?.(reason) : undefined); },

    /** Raw string from the WebView bridge. */
    handleMessage(raw) {
      if (settled) return;
      let msg;
      // A message we cannot read tells us nothing, not even that the page is
      // alive — so it deliberately does not reset the watchdog.
      try { msg = JSON.parse(raw); } catch { return; }
      if (!msg || typeof msg !== "object") return;
      kickWatchdog();

      switch (msg.type) {
        case "progress":
          if (typeof msg.value === "number" && Number.isFinite(msg.value)) {
            onProgress?.(Math.min(1, Math.max(0, msg.value)));
          }
          break;

        case "begin": {
          const n = msg.parts;
          if (!Number.isInteger(n) || n <= 0 || n > MAX_PARTS) {
            settle(() => onError?.("badbegin"));
            return;
          }
          expected = n;
          mime = typeof msg.mime === "string" ? msg.mime : null;
          parts = new Array(n);
          break;
        }

        case "chunk":
          // Indices outside what `begin` announced are dropped rather than
          // stored: they would either grow the array without bound or leave a
          // hole that only surfaces as a corrupt video.
          if (Number.isInteger(msg.i) && msg.i >= 0 && msg.i < expected
              && typeof msg.data === "string") {
            parts[msg.i] = msg.data;
          }
          break;

        case "done":
          stopWatchdog();
          return finish();

        case "error":
          settle(() => onError?.(typeof msg.reason === "string" ? msg.reason : "failed"));
          break;

        default:
          break;
      }
      return undefined;
    },

    /** For assertions in tests. */
    get settled() { return settled; },
  };
}
