const fs = require("node:fs");
const path = require("node:path");
const tcpPortUsed = require("tcp-port-used");
function getPortFromArgs(args) {
  if (!args || args.length === 0) return;
  const portRegexp = /--port=(\d+)/;
  const portArg = args.find(function (arg) {
    return portRegexp.test(arg);
  });
  if (!portArg) {
    const catchAllPortRegexp = /--port=(\S+)/;
    const incorrectTypePortArg = args.find(function (arg) {
      return catchAllPortRegexp.test(arg);
    });
    if (incorrectTypePortArg) {
      console.error("Invalid port.");
      process.exit(1);
    } else {
      return;
    }
  }
  // @ts-expect-error Regex already checked
  const port = parseInt(portRegexp.exec(portArg)[1]);
  return port;
}
/**
 * Resolves with the port chromedriver reports on its startup line, which it
 * prints once it is listening. With `--port=0` the OS assigns an ephemeral
 * port, so this is the only way to learn which one it got.
 * @param {import("node:child_process").ChildProcessWithoutNullStreams} cp
 * @param {number} timeout
 * @returns {Promise<number>}
 */
function getPortFromStdout(cp, timeout) {
  const startedRegexp = /ChromeDriver was started successfully on port (\d+)\./;
  return new Promise(function (resolve, reject) {
    let output = "";
    const timer = setTimeout(function () {
      finish(
        new Error("Timed out after " + timeout + "ms waiting for chromedriver to report its port."),
      );
    }, timeout);
    /**
     * @param {Error | null} err
     * @param {number} [port]
     */
    function finish(err, port) {
      clearTimeout(timer);
      cp.stdout.removeListener("data", onData);
      cp.removeListener("error", finish);
      cp.removeListener("exit", onExit);
      if (err) reject(err);
      else resolve(/** @type {number} */ (port));
    }
    function onData(data) {
      output += data;
      const match = startedRegexp.exec(output);
      if (match) finish(null, parseInt(match[1]));
    }
    /**
     * @param {number | null} code
     */
    function onExit(code) {
      finish(new Error("chromedriver exited with code " + code + " before reporting its port."));
    }
    cp.stdout.on("data", onData);
    cp.once("error", finish);
    cp.once("exit", onExit);
  });
}
process.env.PATH = path.join(__dirname, "chromedriver") + path.delimiter + process.env.PATH;
const crpath =
  process.platform === "win32"
    ? path.join(__dirname, "chromedriver", "chromedriver.exe")
    : path.join(__dirname, "chromedriver", "chromedriver");
const version = "151.0.7922.77";
/**
 * A chromedriver child process. `port` is the port it listens on, and is only
 * set once known: immediately for an explicit port, and when the returned
 * promise resolves for `--port=0`.
 * @typedef {import("node:child_process").ChildProcessWithoutNullStreams & { port?: number }} ChromedriverProcess
 */
/** @type {ChromedriverProcess | null} */
let defaultInstance = null;

function start(args, returnPromise) {
  args = args || [];
  let command = crpath;
  if (!fs.existsSync(command)) {
    console.log("Could not find chromedriver in default path: ", command);
    console.log("Falling back to use global chromedriver bin");
    command = process.platform === "win32" ? "chromedriver.exe" : "chromedriver";
  }
  let port = getPortFromArgs(args);
  if (port === undefined) {
    args.push("--port=9515");
    port = 9515;
  }
  /** @type {ChromedriverProcess} */
  const cp = require("child_process").spawn(command, args);
  cp.stdout.pipe(process.stdout);
  cp.stderr.pipe(process.stderr);
  if (port !== 0) cp.port = port;
  defaultInstance = cp;
  if (!returnPromise) return cp;
  const pollInterval = 100;
  const timeout = 10000;
  // `--port=0` asks the OS for a free port, so which port to poll is only known
  // once chromedriver reports it on stdout.
  const portPromise = port === 0 ? getPortFromStdout(cp, timeout) : Promise.resolve(port);
  return portPromise.then(function (listeningPort) {
    cp.port = listeningPort;
    return tcpPortUsed.waitUntilUsed(listeningPort, pollInterval, timeout).then(function () {
      return cp;
    });
  });
}

function stop() {
  if (defaultInstance != null) defaultInstance.kill();
  defaultInstance = null;
}

module.exports = {
  path: crpath,
  version,
  start,
  stop,
  get defaultInstance() {
    return defaultInstance;
  },
};
