export function createCoalescedUpdater<T>(opts: {
  confirmed: T;
  send: (next: T) => Promise<T>;
  onChange: (optimistic: T, confirmed: T, error?: string) => void;
  isEqual?: (a: T, b: T) => boolean;
}) {
  const eq = opts.isEqual ?? ((a, b) => a === b);
  let desired = opts.confirmed;
  let confirmed = opts.confirmed;
  let running = false;

  async function loop() {
    if (running) return;
    running = true;
    try {
      while (!eq(desired, confirmed)) {
        const sending = desired;
        try {
          confirmed = await opts.send(sending);
          if (eq(desired, sending)) desired = confirmed;
          opts.onChange(desired, confirmed);
        } catch (e) {
          desired = confirmed;
          opts.onChange(
            confirmed,
            confirmed,
            e instanceof Error ? e.message : "Request failed",
          );
        }
      }
    } finally {
      running = false;
    }
  }

  return {
    set(next: T) {
      desired = next;
      opts.onChange(desired, confirmed);
      void loop();
    },
  };
}
