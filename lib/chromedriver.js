const fs = require('fs');
const path = require('path');
const tcpPortUsed = require('tcp-port-used');
const utils = require('./install-utils');
const { getChromeVersion } = require('@testim/chrome-version');

// Default to Google's CDN
let cdnUrl = 'https://chromedriver.storage.googleapis.com';

const libPath = path.join(__dirname, 'chromedriver');

function getPortFromArgs(args) {
  let port = 9515;
  if (!args) {
    return port;
  }
  const portRegexp = /--port=(\d*)/;
  const portArg = args.find(function (arg) {
    return portRegexp.test(arg);
  });
  if (portArg) {
    port = parseInt(portRegexp.exec(portArg)[1]);
  }
  return port;
}

process.env.PATH = path.join(__dirname, 'chromedriver') + path.delimiter + process.env.PATH;

exports.path = process.platform === 'win32' ?
  path.join(__dirname, 'chromedriver', 'chromedriver.exe') :
  path.join(__dirname, 'chromedriver', 'chromedriver');

exports.version = '84.0.4147.30';

exports.start = function (args, returnPromise) {
  let command = exports.path;
  if (!fs.existsSync(command)) {
    console.log('Could not find chromedriver in default path: ', command);
    console.log('Falling back to use global chromedriver bin');
    command = process.platform === 'win32' ? 'chromedriver.exe' : 'chromedriver';
  }
  const cp = require('child_process').spawn(command, args);
  cp.stdout.pipe(process.stdout);
  cp.stderr.pipe(process.stderr);
  exports.defaultInstance = cp;
  if (!returnPromise) {
    return cp;
  }
  const port = getPortFromArgs(args);
  const pollInterval = 100;
  const timeout = 10000;
  return tcpPortUsed.waitUntilUsed(port, pollInterval, timeout)
    .then(function () {
      return cp;
    });
};

exports.stop = function () {
  if (exports.defaultInstance != null) {
    exports.defaultInstance.kill();
  }
};

exports.download = async function (options) {
  if (!options) {
    // this allows us to handle non-existent properties more easily
    options = {}
  }
  // allow for a custom cdn url to be set
  if (options.cdn_url) {
    cdnUrl = options.cdn_url;
  }
  // adapt http://chromedriver.storage.googleapis.com/
  cdnUrl = cdnUrl.replace(/\/+$/, '');
  try {
    // allow for a version to be picked, but default to current installed version
    let chromeVersion;
    if (!options.download_version) {
      chromeVersion = await getChromeVersion();
      console.log("Installed Chrome version is " + chromeVersion);
    } else {
      chromeVersion = options.download_version;
      console.log("Selected version is " + chromeVersion);
    }

    let chromeVersionWithoutPatch;
    // allow both full version and major version as input
    if ((chromeVersion + "").includes(".")) {
      chromeVersionWithoutPatch = /^(.*?)\.\d+$/.exec(chromeVersion)[1];
    } else {
      chromeVersionWithoutPatch = chromeVersion;
    }
    chromedriver_version = await utils.getChromeDriverVersion(utils.getRequestOptions(cdnUrl + '/LATEST_RELEASE_' + chromeVersionWithoutPatch));
    console.log("Compatible ChromeDriver version is " + chromedriver_version);

    let latestReleaseForVersionMatch = chromedriver_version.match(/LATEST_(\d+)/);
    if (latestReleaseForVersionMatch) {
      let majorVersion = latestReleaseForVersionMatch[1];
      chromedriver_version = await utils.getChromeDriverVersion(utils.getRequestOptions(`${cdnUrl}/LATEST_RELEASE_${majorVersion}`));
    }
    let tmpPath = utils.findSuitableTempDirectory(chromedriver_version);
    let chromedriverIsAvailable = await utils.verifyIfChromedriverIsAvailableAndHasCorrectVersion(chromedriver_version);
    if (!chromedriverIsAvailable || options.force_download === "true") {
      console.log('Current existing ChromeDriver binary is unavailable, proceeding with download and extraction.');
      await utils.downloadChromedriver(cdnUrl, chromedriver_version, tmpPath);
      await utils.extractDownload(tmpPath);
    }
    await utils.copyIntoPlace(tmpPath, libPath);
    utils.fixFilePermissions();
    console.log('Done. ChromeDriver binary available at', exports.path);
  } catch (err) {
    console.error('ChromeDriver installation failed', err);
    process.exit(1);
  }
};

exports.is_proper_version_installed = async function () {
  let chromeVersion = await getChromeVersion();
  let chromeVersionWithoutPatch = /^(.*?)\.\d+$/.exec(chromeVersion)[1];

  chromedriver_version = await utils.getChromeDriverVersion(utils.getRequestOptions(cdnUrl + '/LATEST_RELEASE_' + chromeVersionWithoutPatch));

  let latestReleaseForVersionMatch = chromedriver_version.match(/LATEST_(\d+)/);
  if (latestReleaseForVersionMatch) {
    let majorVersion = latestReleaseForVersionMatch[1];
    chromedriver_version = await utils.getChromeDriverVersion(utils.getRequestOptions(`${cdnUrl}/LATEST_RELEASE_${majorVersion}`));
  }
  let chromedriverIsAvailable = await utils.verifyIfChromedriverIsAvailableAndHasCorrectVersion(chromedriver_version);
  return chromedriverIsAvailable;
}