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
process.env.PATH = path.join(__dirname, "chromedriver") + path.delimiter + process.env.PATH;
const crpath =
  process.platform === "win32"
    ? path.join(__dirname, "chromedriver", "chromedriver.exe")
    : path.join(__dirname, "chromedriver", "chromedriver");
const version = "147.0.7727.57";
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
  if (!port) {
    args.push("--port=9515");
    port = 9515;
  }
  const cp = require("child_process").spawn(command, args);
  cp.stdout.pipe(process.stdout);
  cp.stderr.pipe(process.stderr);
  defaultInstance = cp;
  if (!returnPromise) return cp;
  const pollInterval = 100;
  const timeout = 10000;
  return tcpPortUsed.waitUntilUsed(port, pollInterval, timeout).then(function () {
    return cp;
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
