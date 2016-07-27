var path = require('path');
process.env.PATH += path.delimiter + path.join(__dirname, 'chromedriver');
exports.path = process.platform === 'win32' ? path.join(__dirname, 'chromedriver', 'chromedriver.exe') : path.join(__dirname, 'chromedriver', 'chromedriver');
exports.version = '2.21';
exports.start = function(args) {
  exports.defaultInstance = require('child_process').execFile(exports.path, args);
  var port = 9515;
  args.forEach(function(arg) {
    var matched = arg.match(/--port=([0-9]+)/i);
    if (matched) {
      port = Number(matched[1]);
    }
  });
  exports.defaultInstance.port = port;
  return exports.defaultInstance;
}
exports.stop = function () {
  if (exports.defaultInstance != null){
    exports.defaultInstance.kill();
    exports.defaultInstance = null;
  }
}
