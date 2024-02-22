const process = require('node:process');
const console = require('node:console');

describe('install', () => {
  const mockProcess = {
    ...process,
    env: {
      NODE_ENV: 'test'
    },
    exit: jest.fn(),
  };
  const mockConsole = {
    ...console,
    error: jest.fn(),
  };
  const mockInstall = {
    isEmulatedRosettaEnvironment: false
  };
  jest.mock('node:process', () => mockProcess);
  jest.mock('node:console', () => mockConsole);
  beforeAll(() => {
  });
  /** @type {import('../install')} */
  let installer;
  beforeEach(() => {
    const Installer = require('../install');
    installer = new Installer();
    installer.isEmulatedRosettaEnvironment = jest.fn(() => mockInstall.isEmulatedRosettaEnvironment);
  });
  afterEach(() => jest.resetAllMocks());
  afterAll(() => jest.restoreAllMocks());
  it('platform linux not x64 fails', () => {
    mockProcess.platform = 'linux';
    mockProcess.arch = 'ppc';
    expect(installer.getPlatform('120.0.0')).toBeUndefined();
    expect(mockProcess.exit.mock.calls).toHaveLength(2);
    expect(mockConsole.error.mock.calls).toHaveLength(2);
  });
  it('fails with unexpected platform', () => {
    mockProcess.platform = 'android';
    mockProcess.arch = 'arm64';
    expect(installer.getPlatform('120.0.0')).toBeUndefined();
    expect(mockProcess.exit.mock.calls).toHaveLength(1);
    expect(mockConsole.error.mock.calls).toHaveLength(1);
  });
  it.each([
    ['win32', 'x64', '120.0.0', 'win64'],
    ['win32', 'x86', '114.0.0', 'win32'],
    ['win32', 'x64', '114.0.0', 'win32'],
    ['linux', 'arm64', '114.0.0', 'linux64'],
  ])('finds platform for %s/%s, version %s is %s', (/** @type {NodeJS.Platform} */ platform, /** @type {NodeJS.Architecture} */ arch, version, result) => {
    mockProcess.platform = platform;
    mockProcess.arch = arch;
    expect(installer.getPlatform(version)).toBe(result);
    expect(mockProcess.exit.mock.calls).toHaveLength(0);
    expect(mockConsole.error.mock.calls).toHaveLength(0);
  });
  it.each([
    ['darwin', 'x64', '116.0.0', false, 'mac-x64'],
    ['darwin', 'x64', '114.0.0', false, 'mac64'],
    ['darwin', 'x64', '105.0.0', true, 'mac64_m1'],
    ['darwin', 'x64', '116.0.0', true, 'mac-arm64'],
    ['darwin', 'x64', '114.0.0', true, 'mac_arm64'],
    ['freebsd', 'arm64', '116.0.0', false, 'mac-arm64'],
    ['darwin', 'arm64', '116.0.0', false, 'mac-arm64'],
    ['darwin', 'arm64', '114.0.0', false, 'mac_arm64'],
    ['darwin', 'arm64', '105.0.0', false, 'mac64_m1'],
  ])('finds platform for Mac %s/%s, version %s, emulated rosetta is %s is %s', (/** @type {NodeJS.Platform} */ platform, /** @type {NodeJS.Architecture} */ arch, version, isEmulatedRosettaEnvironment, result) => {
    mockProcess.platform = platform;
    mockProcess.arch = arch;
    mockInstall.isEmulatedRosettaEnvironment = isEmulatedRosettaEnvironment;
    expect(installer.getPlatform(version)).toBe(result);
    expect(mockProcess.exit.mock.calls).toHaveLength(0);
    expect(mockConsole.error.mock.calls).toHaveLength(0);
  });

});
