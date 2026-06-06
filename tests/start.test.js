const child_process = require("node:child_process");

describe("start", () => {
  /** @type {import('child_process').ChildProcess} */
  let fakeCp;
  let spawnSpy;
  beforeEach(() => {
    fakeCp = /** @type {any} */ ({
      stdout: { pipe: jest.fn() },
      stderr: { pipe: jest.fn() },
      kill: jest.fn(),
    });
    jest.resetModules();
    spawnSpy = jest.spyOn(child_process, "spawn").mockClear().mockReturnValue(fakeCp);
  });
  afterAll(() => jest.restoreAllMocks());

  it("uses the default port when none is passed", () => {
    const { start } = require("../lib/chromedriver");
    const args = [];
    start(args);
    expect(args).toContain("--port=9515");
    expect(spawnSpy.mock.calls[0][1]).toContain("--port=9515");
  });

  it("keeps --port=0 instead of overriding it with the default", () => {
    const { start } = require("../lib/chromedriver");
    const args = ["--port=0"];
    start(args);
    expect(args).not.toContain("--port=9515");
    expect(spawnSpy.mock.calls[0][1]).toEqual(["--port=0"]);
  });

  it("resolves immediately for --port=0 when a promise is requested", async () => {
    const { start } = require("../lib/chromedriver");
    const cp = await start(["--port=0"], true);
    expect(cp).toBe(fakeCp);
  });

  it("keeps an explicit port", () => {
    const { start } = require("../lib/chromedriver");
    const args = ["--port=9222"];
    start(args);
    expect(args).not.toContain("--port=9515");
    expect(spawnSpy.mock.calls[0][1]).toEqual(["--port=9222"]);
  });
});
