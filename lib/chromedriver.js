var fs = require('fs');
var path = require('path');
var tcpPortUsed = require('tcp-port-used');
function getPortFromArgs(args) {
  var port = 9515;
  if (!args){
    return port;
  }
  var portRegexp = /--port=(\d*)/;
  var portArg = args.find(function (arg) {
    return portRegexp.test(arg);
  });
  if (portArg){
    port = parseInt(portRegexp.exec(portArg)[1]);
  }
  return port;
};
process.env.PATH = path.join(__dirname, 'chromedriver') + path.delimiter + process.env.PATH;
exports.path = process.platform === 'win32' ? path.join(__dirname, 'chromedriver', 'chromedriver.exe') : path.join(__dirname, 'chromedriver', 'chromedriver');
exports.version = '2.43';
exports.start = function(args, returnPromise) {
  var command = exports.path;
  if (!fs.existsSync(command)) {
    console.log('Could not find chromedriver in default path: ', command);
    console.log('Falling back to use global chromedriver bin');
    command = process.platform === 'win32' ? 'chromedriver.exe' : 'chromedriver';
  }
  var cp = require('child_process').spawn(command, args);
  cp.stdout.pipe(process.stdout);
  cp.stderr.pipe(process.stderr);
  exports.defaultInstance = cp;
  if (!returnPromise) {
    return cp;
  }
  var port = getPortFromArgs(args);
  var pollInterval = 100;
  var timeout = 10000;
  return tcpPortUsed.waitUntilUsed(port, pollInterval, timeout)
    .then(function () {
      return cp;
    });
};
exports.stop = function () {
  if (exports.defaultInstance != null){
    exports.defaultInstance.kill();
  }
};
