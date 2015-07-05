'use strict'

var AdmZip = require('adm-zip')
var cp = require('child_process')
var fs = require('fs')
var helper = require('./lib/chromedriver')
var http = require('http')
var kew = require('kew')
var npmconf = require('npmconf')
var mkdirp = require('mkdirp')
var path = require('path')
var rimraf = require('rimraf').sync
var url = require('url')
var util = require('util')

var libPath = path.join(__dirname, 'lib', 'chromedriver')
var cdnUrl = process.env.npm_config_chromedriver_cdnurl || process.env.CHROMEDRIVER_CDNURL || 'http://chromedriver.storage.googleapis.com'
// adapt http://chromedriver.storage.googleapis.com/
cdnUrl = cdnUrl.replace(/\/+$/, '')
var downloadUrl = cdnUrl + '/%s/chromedriver_%s.zip'
var platform = process.platform

if (platform === 'linux') {
  if (process.arch === 'x64') {
    platform += '64'
  } else {
    platform += '32'
  }
} else if (platform === 'darwin') {
  platform = 'mac32'
} else if (platform !== 'win32') {
  console.log('Unexpected platform or architecture:', process.platform, process.arch)
  process.exit(1)
}

downloadUrl = util.format(downloadUrl, helper.version, platform);

var fileName = downloadUrl.split('/').pop()

npmconf.load(function(err, conf) {
  if (err) {
    console.log('Error loading npm config')
    console.error(err)
    process.exit(1)
    return
  }

  var tmpPath = findSuitableTempDirectory(conf)
  var downloadedFile = path.join(tmpPath, fileName)
  var promise = kew.resolve(true)

  // Start the install.
  promise = promise.then(function () {
    console.log('Downloading', downloadUrl)
    console.log('Saving to', downloadedFile)
    return requestBinary(getRequestOptions(conf.get('proxy')), downloadedFile)
  })

  promise.then(function () {
    return extractDownload(downloadedFile, tmpPath)
  })
  .then(function () {
    return copyIntoPlace(tmpPath, libPath)
  })
  .then(function () {
    return fixFilePermissions()
  })
  .then(function () {
    console.log('Done. ChromeDriver binary available at', helper.path)
  })
  .fail(function (err) {
    console.error('ChromeDriver installation failed', err.stack)
    process.exit(1)
  })
})


function findSuitableTempDirectory(npmConf) {
  var now = Date.now()
  var candidateTmpDirs = [
    process.env.TMPDIR || npmConf.get('tmp'),
    '/tmp',
    path.join(process.cwd(), 'tmp')
  ]

  for (var i = 0; i < candidateTmpDirs.length; i++) {
    var candidatePath = path.join(candidateTmpDirs[i], 'chromedriver')

    try {
      mkdirp.sync(candidatePath, '0777')
      var testFile = path.join(candidatePath, now + '.tmp')
      fs.writeFileSync(testFile, 'test')
      fs.unlinkSync(testFile)
      return candidatePath
    } catch (e) {
      console.log(candidatePath, 'is not writable:', e.message)
    }
  }

  console.error('Can not find a writable tmp directory, please report issue on https://github.com/giggio/chromedriver/issues/ with as much information as possible.');
  process.exit(1);
}


function getRequestOptions(proxyUrl) {
  if (proxyUrl) {
    var options = url.parse(proxyUrl)
    options.path = downloadUrl
    options.headers = { Host: url.parse(downloadUrl).host }
    // Turn basic authorization into proxy-authorization.
    if (options.auth) {
      options.headers['Proxy-Authorization'] = 'Basic ' + new Buffer(options.auth).toString('base64')
      delete options.auth
    }

    return options
  } else {
    return url.parse(downloadUrl)
  }
}


function requestBinary(requestOptions, filePath) {
  var deferred = kew.defer()

  var count = 0
  var notifiedCount = 0
  var outFile = fs.openSync(filePath, 'w')

  var client = http.get(requestOptions, function (response) {
    var status = response.statusCode
    console.log('Receiving...')

    if (status === 200) {
      response.addListener('data',   function (data) {
        fs.writeSync(outFile, data, 0, data.length, null)
        count += data.length
        if ((count - notifiedCount) > 800000) {
          console.log('Received ' + Math.floor(count / 1024) + 'K...')
          notifiedCount = count
        }
      })

      response.addListener('end',   function () {
        console.log('Received ' + Math.floor(count / 1024) + 'K total.')
        fs.closeSync(outFile)
        deferred.resolve(true)
      })

    } else {
      client.abort()
      deferred.reject('Error with http request: ' + util.inspect(response.headers))
    }
  })

  return deferred.promise
}


function extractDownload(filePath, tmpPath) {
  var deferred = kew.defer()
  var options = {cwd: tmpPath}

  console.log('Extracting zip contents')
  try {
    var zip = new AdmZip(filePath)
    zip.extractAllTo(tmpPath, true)
    deferred.resolve(true)
  } catch (err) {
    deferred.reject('Error extracting archive ' + err.stack)
  }
  return deferred.promise
}


function copyIntoPlace(tmpPath, targetPath) {
  rimraf(targetPath);
  console.log("Copying to target path", targetPath);
  fs.mkdirSync(targetPath);

  // Look for the extracted directory, so we can rename it.
  var files = fs.readdirSync(tmpPath);
  var promises = files.map(function (name) {
    var deferred = kew.defer();

    var file = path.join(tmpPath, name);
    var reader = fs.createReadStream(file);

    var targetFile = path.join(targetPath, name);
    var writer = fs.createWriteStream(targetFile);
    writer.on("close", function() {
      deferred.resolve(true);
    });

    reader.pipe(writer);
    return deferred.promise;
  });

  return kew.all(promises);
}



function fixFilePermissions() {
  // Check that the binary is user-executable and fix it if it isn't (problems with unzip library)
  if (process.platform != 'win32') {
    var stat = fs.statSync(helper.path)
    // 64 == 0100 (no octal literal in strict mode)
    if (!(stat.mode & 64)) {
      console.log('Fixing file permissions')
      fs.chmodSync(helper.path, '755')
    }
  }
}
