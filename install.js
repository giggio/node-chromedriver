'use strict';
// @ts-check

const helper = require('./lib/chromedriver');
const utils = require('./lib/install-utils')
const path = require('path');
const { getChromeVersion } = require('@testim/chrome-version');

const skipDownload = process.env.npm_config_chromedriver_skip_download || process.env.CHROMEDRIVER_SKIP_DOWNLOAD;
if (skipDownload === 'true') {
  console.log('Found CHROMEDRIVER_SKIP_DOWNLOAD variable, skipping installation.');
  process.exit(0);
}

const libPath = path.join(__dirname, 'lib', 'chromedriver');
let cdnUrl = process.env.npm_config_chromedriver_cdnurl || process.env.CHROMEDRIVER_CDNURL || 'https://chromedriver.storage.googleapis.com';

// adapt http://chromedriver.storage.googleapis.com/
cdnUrl = cdnUrl.replace(/\/+$/, '');
const detect_chromedriver_version = process.env.npm_config_detect_chromedriver_version || process.env.DETECT_CHROMEDRIVER_VERSION;
let chromedriver_version = process.env.npm_config_chromedriver_version || process.env.CHROMEDRIVER_VERSION || helper.version;
let chromedriverBinaryFilePath;

(async function install() {
  try {
    if (detect_chromedriver_version === 'true') {
      // Refer http://chromedriver.chromium.org/downloads/version-selection
      const chromeVersion = await getChromeVersion();
      console.log("Your Chrome version is " + chromeVersion);
      const chromeVersionWithoutPatch = /^(.*?)\.\d+$/.exec(chromeVersion)[1];
      chromedriver_version = await utils.getChromeDriverVersion(utils.getRequestOptions(cdnUrl + '/LATEST_RELEASE_' + chromeVersionWithoutPatch));
      console.log("Compatible ChromeDriver version is " + chromedriver_version);
    }
    if (chromedriver_version === 'LATEST') {
      chromedriver_version = await utils.getChromeDriverVersion(utils.getRequestOptions(`${cdnUrl}/LATEST_RELEASE`));
    } else {
      const latestReleaseForVersionMatch = chromedriver_version.match(/LATEST_(\d+)/);
      if (latestReleaseForVersionMatch) {
        const majorVersion = latestReleaseForVersionMatch[1];
        chromedriver_version = await utils.getChromeDriverVersion(utils.getRequestOptions(`${cdnUrl}/LATEST_RELEASE_${majorVersion}`));
      }
    }
    const tmpPath = utils.findSuitableTempDirectory(chromedriver_version);
    const chromedriverBinaryFileName = process.platform === 'win32' ? 'chromedriver.exe' : 'chromedriver';
    chromedriverBinaryFilePath = path.resolve(tmpPath, chromedriverBinaryFileName);
    const chromedriverIsAvailable = await utils.verifyIfChromedriverIsAvailableAndHasCorrectVersion(chromedriver_version);
    if (!chromedriverIsAvailable) {
      console.log('Current existing ChromeDriver binary is unavailable, proceeding with download and extraction.');
      await utils.downloadChromedriver(cdnUrl, chromedriver_version, tmpPath);
      await utils.extractDownload(tmpPath);
    }
    await utils.copyIntoPlace(tmpPath, libPath);
    utils.fixFilePermissions();
    console.log('Done. ChromeDriver binary available at', helper.path);
  } catch (err) {
    console.error('ChromeDriver installation failed', err);
    process.exit(1);
  }
})();