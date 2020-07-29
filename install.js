'use strict';
// @ts-check

const helper = require('./lib/chromedriver');
const utils = require('./lib/install-utils')

let skipDownload = process.env.npm_config_chromedriver_skip_download || process.env.CHROMEDRIVER_SKIP_DOWNLOAD;
if (skipDownload === 'true') {
  console.log('Found CHROMEDRIVER_SKIP_DOWNLOAD variable, skipping installation.');
  process.exit(0);
}

let cdnUrl = process.env.npm_config_chromedriver_cdnurl || process.env.CHROMEDRIVER_CDNURL || 'https://chromedriver.storage.googleapis.com';
// adapt http://chromedriver.storage.googleapis.com/
cdnUrl = cdnUrl.replace(/\/+$/, '');
let detect_chromedriver_version = process.env.npm_config_detect_chromedriver_version || process.env.DETECT_CHROMEDRIVER_VERSION;
let chromedriver_version = process.env.npm_config_chromedriver_version || process.env.CHROMEDRIVER_VERSION || helper.version;

(async function install() {
  let options = {
    cdn_url: cdnUrl,
    force_download: "true"
  };

  if (chromedriver_version === 'LATEST') {
    chromedriver_version = await utils.getChromeDriverVersion(utils.getRequestOptions(`${cdnUrl}/LATEST_RELEASE`));
  } else {
    let latestReleaseForVersionMatch = chromedriver_version.match(/LATEST_(\d+)/);
    if (latestReleaseForVersionMatch) {
      let majorVersion = latestReleaseForVersionMatch[1];
      chromedriver_version = await utils.getChromeDriverVersion(utils.getRequestOptions(`${cdnUrl}/LATEST_RELEASE_${majorVersion}`));
    }
  }

  if (detect_chromedriver_version !== 'true') {
    options.download_version = chromedriver_version
  }

  await (helper.download(options))
})();