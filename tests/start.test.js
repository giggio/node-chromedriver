const child_process = require("node:child_process");
const { EventEmitter } = require("node:events");

jest.mock("tcp-port-used", () => ({ waitUntilUsed: jest.fn(() => Promise.resolve()) }));

const startedLine = "ChromeDriver was started successfully on port 51234.\n";

describe("start", () => {
  /** @type {any} */
  let fakeCp;
  /** @type {jest.SpyInstance} */
  let spawnSpy;
  // The module keeps state between calls, so it and its mocked dependency are
  // required per test, after the registry is reset.
  function load() {
    return {
      chromedriver: require("../lib/chromedriver"),
      tcpPortUsed: require("tcp-port-used"),
    };
  }
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  beforeEach(() => {
    fakeCp = new EventEmitter();
    fakeCp.stdout = Object.assign(new EventEmitter(), { pipe: jest.fn() });
    fakeCp.stderr = Object.assign(new EventEmitter(), { pipe: jest.fn() });
    fakeCp.kill = jest.fn();
    jest.resetModules();
    spawnSpy = jest.spyOn(child_process, "spawn").mockClear().mockReturnValue(fakeCp);
  });
  afterAll(() => jest.restoreAllMocks());

  it("uses the default port when none is passed", () => {
    const { chromedriver } = load();
    const args = [];
    chromedriver.start(args);
    expect(args).toContain("--port=9515");
    expect(spawnSpy.mock.calls[0][1]).toContain("--port=9515");
  });

  it("keeps --port=0 instead of overriding it with the default", () => {
    const { chromedriver } = load();
    const args = ["--port=0"];
    chromedriver.start(args);
    expect(args).not.toContain("--port=9515");
    expect(spawnSpy.mock.calls[0][1]).toEqual(["--port=0"]);
  });

  it("keeps an explicit port", () => {
    const { chromedriver } = load();
    const args = ["--port=9222"];
    chromedriver.start(args);
    expect(args).not.toContain("--port=9515");
    expect(spawnSpy.mock.calls[0][1]).toEqual(["--port=9222"]);
  });

  it("polls the explicit port and exposes it", async () => {
    const { chromedriver, tcpPortUsed } = load();
    const cp = await chromedriver.start(["--port=9222"], true);
    expect(tcpPortUsed.waitUntilUsed).toHaveBeenCalledWith(9222, 100, 10000);
    expect(cp).toBe(fakeCp);
    expect(cp.port).toBe(9222);
  });

  it("polls the port chromedriver reports for --port=0", async () => {
    const { chromedriver, tcpPortUsed } = load();
    const promise = chromedriver.start(["--port=0"], true);
    fakeCp.stdout.emit("data", startedLine);
    const cp = await promise;
    expect(tcpPortUsed.waitUntilUsed).toHaveBeenCalledWith(51234, 100, 10000);
    expect(cp).toBe(fakeCp);
    expect(cp.port).toBe(51234);
  });

  it("does not resolve for --port=0 before the startup line arrives", async () => {
    const { chromedriver, tcpPortUsed } = load();
    let resolved = false;
    const promise = Promise.resolve(chromedriver.start(["--port=0"], true)).then(
      () => (resolved = true),
    );
    // The banner also mentions the requested port and must not be mistaken for
    // the startup line.
    fakeCp.stdout.emit("data", "Starting ChromeDriver 151.0.7922.77 on port 0\n");
    await flush();
    expect(resolved).toBe(false);
    expect(tcpPortUsed.waitUntilUsed).not.toHaveBeenCalled();
    fakeCp.stdout.emit("data", startedLine);
    await promise;
    expect(resolved).toBe(true);
  });

  it("reads the startup line when it is split across chunks", async () => {
    const { chromedriver, tcpPortUsed } = load();
    const promise = chromedriver.start(["--port=0"], true);
    fakeCp.stdout.emit("data", "ChromeDriver was started su");
    fakeCp.stdout.emit("data", "ccessfully on port 51234.\n");
    await promise;
    expect(tcpPortUsed.waitUntilUsed).toHaveBeenCalledWith(51234, 100, 10000);
  });

  it("rejects for --port=0 when the process fails to spawn", async () => {
    const { chromedriver } = load();
    const promise = chromedriver.start(["--port=0"], true);
    fakeCp.emit("error", new Error("spawn chromedriver ENOENT"));
    await expect(promise).rejects.toThrow("spawn chromedriver ENOENT");
  });

  it("rejects for --port=0 when the process exits before reporting its port", async () => {
    const { chromedriver } = load();
    const promise = chromedriver.start(["--port=0"], true);
    fakeCp.emit("exit", 1);
    await expect(promise).rejects.toThrow("chromedriver exited with code 1");
  });

  it("rejects for --port=0 when the port is never reported", async () => {
    const { chromedriver } = load();
    /** @type {any} */
    let onTimeout;
    // The timer callback is swapped in by hand rather than with
    // jest.useFakeTimers(), which leaves the global timers undefined for the
    // tests that follow.
    const realSetTimeout = global.setTimeout;
    global.setTimeout = /** @type {any} */ (
      (fn, ms) => {
        expect(ms).toBe(10000);
        onTimeout = fn;
        return 0;
      }
    );
    const promise = chromedriver.start(["--port=0"], true);
    global.setTimeout = realSetTimeout;
    const rejection = expect(promise).rejects.toThrow("Timed out after 10000ms");
    onTimeout();
    await rejection;
  });

  it("stops listening to stdout once the port is known", async () => {
    const { chromedriver } = load();
    const promise = chromedriver.start(["--port=0"], true);
    expect(fakeCp.stdout.listenerCount("data")).toBe(1);
    fakeCp.stdout.emit("data", startedLine);
    await promise;
    expect(fakeCp.stdout.listenerCount("data")).toBe(0);
    expect(fakeCp.listenerCount("error")).toBe(0);
    expect(fakeCp.listenerCount("exit")).toBe(0);
  });
});
