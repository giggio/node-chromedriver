const process = require("node:process");
const console = require("node:console");

describe("install", () => {
  let mockProcess;
  let mockConsole;
  let mockInstall;
  /** @type {import('../install')} */
  let installer;

  beforeAll(() => {
    jest.mock("node:process", () => {
      const actualProcess = jest.requireActual("node:process");
      return {
        ...actualProcess,
        env: { ...actualProcess.env, NODE_ENV: "test" },
        exit: jest.fn(),
      };
    });
    jest.mock("node:console", () => {
      const actualConsole = jest.requireActual("node:console");
      return {
        ...actualConsole,
        error: jest.fn(),
      };
    });
    jest.mock("proxy-agent", () => ({ ProxyAgent: jest.fn() }));
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockProcess = require("node:process");
    mockConsole = require("node:console");
    mockInstall = { isEmulatedRosettaEnvironment: false };
    const Installer = require("../install");
    installer = new Installer();
    installer.isEmulatedRosettaEnvironment = jest.fn(
      () => mockInstall.isEmulatedRosettaEnvironment,
    );
  });

  afterAll(() => {
    jest.unmock("node:process");
    jest.unmock("node:console");
    jest.unmock("proxy-agent");
  });

  it("platform linux not x64 calls exit and prints error", () => {
    mockProcess.platform = "linux";
    // @ts-expect-error This is on purpose
    mockProcess.arch = "ppc";
    installer.getPlatform("120.0.0");
    expect(mockProcess.exit).toHaveBeenCalledTimes(1);
    expect(mockConsole.error).toHaveBeenCalledTimes(1);
  });

  it("fails with unexpected platform calls exit and prints error", () => {
    mockProcess.platform = "android";
    mockProcess.arch = "arm64";
    installer.getPlatform("120.0.0");
    expect(mockProcess.exit).toHaveBeenCalledTimes(1);
    expect(mockConsole.error).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["win32", "x64", "120.0.0", "win64"],
    ["win32", "x86", "114.0.0", "win32"],
    ["win32", "x64", "114.0.0", "win32"],
    ["linux", "arm64", "114.0.0", "linux64"],
  ])("finds platform for %s/%s, version %s is %s", (platform, arch, version, result) => {
    // @ts-expect-error String works
    mockProcess.platform = platform;
    // @ts-expect-error String works
    mockProcess.arch = arch;
    expect(installer.getPlatform(version)).toBe(result);
    expect(mockProcess.exit).not.toHaveBeenCalled();
    expect(mockConsole.error).not.toHaveBeenCalled();
  });

  it.each([
    ["darwin", "x64", "116.0.0", false, "mac-x64"],
    ["darwin", "x64", "114.0.0", false, "mac64"],
    ["darwin", "x64", "105.0.0", true, "mac64_m1"],
    ["darwin", "x64", "116.0.0", true, "mac-arm64"],
    ["darwin", "x64", "114.0.0", true, "mac_arm64"],
    ["freebsd", "arm64", "116.0.0", false, "mac-arm64"],
    ["darwin", "arm64", "116.0.0", false, "mac-arm64"],
    ["darwin", "arm64", "114.0.0", false, "mac_arm64"],
    ["darwin", "arm64", "105.0.0", false, "mac64_m1"],
  ])(
    "finds platform for Mac %s/%s, version %s, emulated rosetta is %s is %s",
    (platform, arch, version, isEmulatedRosettaEnvironment, result) => {
      // @ts-expect-error String works
      mockProcess.platform = platform;
      // @ts-expect-error String works
      mockProcess.arch = arch;
      mockInstall.isEmulatedRosettaEnvironment = isEmulatedRosettaEnvironment;
      expect(installer.getPlatform(version)).toBe(result);
      expect(mockProcess.exit).not.toHaveBeenCalled();
      expect(mockConsole.error).not.toHaveBeenCalled();
    },
  );
});
