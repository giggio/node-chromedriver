var path = require('path');
process.env.PATH = path.join(__dirname, 'chromedriver') + path.delimiter + process.env.PATH;
exports.path = process.platform === 'win32' ? path.join(__dirname, 'chromedriver', 'chromedriver.exe') : path.join(__dirname, 'chromedriver', 'chromedriver');
exports.version = '2.41';
exports.start = function(args) {
  var cp = require('child_process').spawn(exports.path, args);
  cp.stdout.pipe(process.stdout);
  cp.stderr.pipe(process.stderr);
  exports.defaultInstance = cp;
  return cp;
};
exports.stop = function () {
  if (exports.defaultInstance != null){
    exports.defaultInstance.kill();
  }
};
