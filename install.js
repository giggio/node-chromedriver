'use strict';
// @ts-check

const helper = require('./lib/chromedriver');
const path = require('path');

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
let force_download = process.env.npm_config_chromedriver_force_download === 'true' || process.env.CHROMEDRIVER_FORCE_DOWNLOAD === 'true';

(async function install() {
  let options = {
    cdn_url: cdnUrl
  };
  if (force_download) {
    options.force_download = 'true';
  }
  if (detect_chromedriver_version !== 'true') {
    if (chromedriver_version === 'LATEST') {
      chromedriver_version = await helper.getChromeDriverVersionFromUrl(`${cdnUrl}/LATEST_RELEASE`);
    } else {
      let latestReleaseForVersionMatch = chromedriver_version.match(/LATEST_(\d+)/);
      if (latestReleaseForVersionMatch) {
        let majorVersion = latestReleaseForVersionMatch[1];
        chromedriver_version = await helper.getChromeDriverVersionFromUrl(`${cdnUrl}/LATEST_RELEASE_${majorVersion}`);
      }
    }
    options.download_version = chromedriver_version;
  }
  await helper.download(options);
})();
