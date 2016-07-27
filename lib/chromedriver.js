var path = require('path');
var request = require('request');
process.env.PATH += path.delimiter + path.join(__dirname, 'chromedriver');
exports.path = process.platform === 'win32' ? path.join(__dirname, 'chromedriver', 'chromedriver.exe') : path.join(__dirname, 'chromedriver', 'chromedriver');
exports.version = '2.21';
exports.start = function(args) {
  exports.defaultInstance = require('child_process').execFile(exports.path, args);
  var port = 9515;
  var urlBase = '';
  if (args) {
    args.forEach(function(arg) {
      var matched = arg.match(/--port=([0-9]+)/i);
      if (matched) {
        port = Number(matched[1]);
      }
      matched = arg.match(/--url-base=(.+)/i);
      if (matched) {
        urlBase = matched[1];
      }
    });
  }
  exports.defaultInstance.port = port;
  exports.defaultInstance.urlBase = urlBase;
  return exports.defaultInstance;
}
exports.stop = function () {
  if (exports.defaultInstance != null){
    exports.defaultInstance.kill();
    exports.defaultInstance = null;
  }
}
exports.isRunning = function() {
  if (!exports.defaultInstance) return Promise.resolve(false)
  var port = exports.defaultInstance.port;
  var urlBase = exports.defaultInstance.urlBase;
  var requestOptions = {
    uri: 'http://127.0.0.1:' + port + urlBase + '/status',
    followAllRedirects: true,
    json: true
  };
  return new Promise(function(resolve) {
    request(requestOptions, function (error, response, body) {
      if (error) return resolve(false);
      if (response.statusCode !== 200) return resolve(false);
      resolve(body && body.status === 0);
    });
  });
}
exports.waitUntilRunning = function() {
  return new Promise(function(resolve, reject) {
    var attempts = 20;
    function checkRunning() {
      exports.isRunning().then(function(running) {
        if (!exports.defaultInstance || attempts === 0) {
          return reject('ChromeDriver is not started.');
        }
        if (running) {
          return resolve();
        }

        attempts--;
        setTimeout(checkRunning, 200);
      });
    }
    checkRunning();
  })
}

