const fs = require('node:fs');
const path = require('node:path');
const tcpPortUsed = require('tcp-port-used');
function getPortFromArgs(args) {
  let port = 9515;
  if (!args)
    return port;
  const portRegexp = /--port=(\d*)/;
  const portArg = args.find(function (arg) {
    return portRegexp.test(arg);
  });
  if (portArg)
    port = parseInt(portRegexp.exec(portArg)[1]);
  return port;
}
process.env.PATH = path.join(__dirname, 'chromedriver') + path.delimiter + process.env.PATH;
const crpath = process.platform === 'win32' ? path.join(__dirname, 'chromedriver', 'chromedriver.exe') : path.join(__dirname, 'chromedriver', 'chromedriver');
const version = '131.0.6778.264';
let defaultInstance = null;

function start(args, returnPromise) {
  let command = crpath;
  if (!fs.existsSync(command)) {
    console.log('Could not find chromedriver in default path: ', command);
    console.log('Falling back to use global chromedriver bin');
    command = process.platform === 'win32' ? 'chromedriver.exe' : 'chromedriver';
  }
  const cp = require('child_process').spawn(command, args);
  cp.stdout.pipe(process.stdout);
  cp.stderr.pipe(process.stderr);
  defaultInstance = cp;
  if (!returnPromise)
    return cp;
  const port = getPortFromArgs(args);
  const pollInterval = 100;
  const timeout = 10000;
  return tcpPortUsed.waitUntilUsed(port, pollInterval, timeout)
    .then(function () {
      return cp;
    });
}

function stop() {
  if (defaultInstance != null)
    defaultInstance.kill();
  defaultInstance = null;
}

module.exports = {
  path: crpath,
  version,
  start,
  stop,
  get defaultInstance() {
    return defaultInstance;
  }
};
