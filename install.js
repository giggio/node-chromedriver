'use strict';
// @ts-check

const fs = require('fs');
const helper = require('./lib/chromedriver');
const axios = require('axios');
const path = require('path');
const child_process = require('child_process');
const os = require('os');
const url = require('url');
const https = require('https');
const { promisify } = require('util');
const { finished } = require('stream');
const extractZip = require('extract-zip');
const { getChromeVersion } = require('@testim/chrome-version');
const HttpsProxyAgent = require('https-proxy-agent');
const getProxyForUrl = require("proxy-from-env").getProxyForUrl;
const { compareVersions } = require('compare-versions');

const finishedAsync = promisify(finished);

const skipDownload = process.env.npm_config_chromedriver_skip_download || process.env.CHROMEDRIVER_SKIP_DOWNLOAD;
if (skipDownload === 'true') {
  console.log('Found CHROMEDRIVER_SKIP_DOWNLOAD variable, skipping installation.');
  process.exit(0);
}

const libPath = path.join(__dirname, 'lib', 'chromedriver');
let cdnUrl = process.env.npm_config_chromedriver_cdnurl || process.env.CHROMEDRIVER_CDNURL || 'https://chromedriver.storage.googleapis.com';
const configuredfilePath = process.env.npm_config_chromedriver_filepath || process.env.CHROMEDRIVER_FILEPATH;

// adapt http://chromedriver.storage.googleapis.com/
cdnUrl = cdnUrl.replace(/\/+$/, '');
const detect_chromedriver_version = process.env.npm_config_detect_chromedriver_version || process.env.DETECT_CHROMEDRIVER_VERSION;
const include_chromium = (process.env.npm_config_include_chromium || process.env.INCLUDE_CHROMIUM) === 'true';
let chromedriver_version = process.env.npm_config_chromedriver_version || process.env.CHROMEDRIVER_VERSION || helper.version;
let chromedriverBinaryFilePath;
let downloadedFile = '';
let platform = '';

(async function install() {
  try {
    if (detect_chromedriver_version === 'true') {
      // Refer http://chromedriver.chromium.org/downloads/version-selection
      const chromeVersion = await getChromeVersion(include_chromium);
      console.log("Your Chrome version is " + chromeVersion);
      const versionMatch = /^(.*?)\.\d+$/.exec(chromeVersion);
      if (versionMatch) {
        const chromeVersionWithoutPatch = versionMatch[1];
        await getChromeDriverVersion(getRequestOptions(cdnUrl + '/LATEST_RELEASE_' + chromeVersionWithoutPatch));
        console.log("Compatible ChromeDriver version is " + chromedriver_version);
      }
    }
    if (chromedriver_version === 'LATEST') {
      await getChromeDriverVersion(getRequestOptions(`${cdnUrl}/LATEST_RELEASE`));
    } else {
      const latestReleaseForVersionMatch = chromedriver_version.match(/LATEST_(\d+)/);
      if (latestReleaseForVersionMatch) {
        const majorVersion = latestReleaseForVersionMatch[1];
        await getChromeDriverVersion(getRequestOptions(`${cdnUrl}/LATEST_RELEASE_${majorVersion}`));
      }
    }
    platform = validatePlatform();
    const tmpPath = findSuitableTempDirectory();
    const chromedriverBinaryFileName = process.platform === 'win32' ? 'chromedriver.exe' : 'chromedriver';
    chromedriverBinaryFilePath = path.resolve(tmpPath, chromedriverBinaryFileName);
    const chromedriverIsAvailable = await verifyIfChromedriverIsAvailableAndHasCorrectVersion();
    if (!chromedriverIsAvailable) {
      console.log('Current existing ChromeDriver binary is unavailable, proceeding with download and extraction.');
      await downloadFile(tmpPath);
      await extractDownload(tmpPath);
    }
    await copyIntoPlace(tmpPath, libPath);
    fixFilePermissions();
    console.log('Done. ChromeDriver binary available at', helper.path);
  } catch (err) {
    console.error('ChromeDriver installation failed', err);
    process.exit(1);
  }
})();

function validatePlatform() {
  /** @type string */
  let thePlatform = process.platform;
  if (thePlatform === 'linux') {
    if (process.arch === 'arm64' || process.arch === 'x64') {
      thePlatform += '64';
    } else {
      console.log('Only Linux 64 bits supported.');
      process.exit(1);
    }
  } else if (thePlatform === 'darwin' || thePlatform === 'freebsd') {
    const osxPlatform = getMacOsRealArch();

    if (!osxPlatform) {
      console.log('Only Mac 64 bits supported.');
      process.exit(1);
    }

    thePlatform = osxPlatform;
  } else if (thePlatform !== 'win32') {
    console.log('Unexpected platform or architecture:', process.platform, process.arch);
    process.exit(1);
  }

  return thePlatform;
}

async function downloadFile(dirToLoadTo) {
  if (detect_chromedriver_version !== 'true' && configuredfilePath) {
    downloadedFile = configuredfilePath;
    console.log('Using file: ', downloadedFile);
    return;
  } else {
    const fileName = `chromedriver_${platform}.zip`;
    const tempDownloadedFile = path.resolve(dirToLoadTo, fileName);
    downloadedFile = tempDownloadedFile;
    const formattedDownloadUrl = `${cdnUrl}/${chromedriver_version}/${fileName}`;
    console.log('Downloading from file: ', formattedDownloadUrl);
    console.log('Saving to file:', downloadedFile);
    await requestBinary(getRequestOptions(formattedDownloadUrl), downloadedFile);
  }
}

function verifyIfChromedriverIsAvailableAndHasCorrectVersion() {
  if (!fs.existsSync(chromedriverBinaryFilePath))
    return Promise.resolve(false);
  const forceDownload = process.env.npm_config_chromedriver_force_download === 'true' || process.env.CHROMEDRIVER_FORCE_DOWNLOAD === 'true';
  if (forceDownload)
    return Promise.resolve(false);
  console.log('ChromeDriver binary exists. Validating...');
  const deferred = new Deferred();
  try {
    fs.accessSync(chromedriverBinaryFilePath, fs.constants.X_OK);
    const cp = child_process.spawn(chromedriverBinaryFilePath, ['--version']);
    let str = '';
    cp.stdout.on('data', data => str += data);
    cp.on('error', () => deferred.resolve(false));
    cp.on('close', code => {
      if (code !== 0)
        return deferred.resolve(false);
      const parts = str.split(' ');
      if (parts.length < 3)
        return deferred.resolve(false);
      if (parts[1].startsWith(chromedriver_version)) {
        console.log(`ChromeDriver is already available at '${chromedriverBinaryFilePath}'.`);
        return deferred.resolve(true);
      }
      deferred.resolve(false);
    });
  }
  catch (error) {
    deferred.resolve(false);
  }
  return deferred.promise;
}

function findSuitableTempDirectory() {
  const now = Date.now();
  const candidateTmpDirs = [
    process.env.npm_config_tmp,
    process.env.XDG_CACHE_HOME,
    // Platform specific default, including TMPDIR/TMP/TEMP env
    os.tmpdir(),
    path.join(process.cwd(), 'tmp')
  ];

  for (const tempDir of candidateTmpDirs) {
    if (!tempDir) continue;
    const namespace = chromedriver_version;
    const candidatePath = path.join(tempDir, namespace, 'chromedriver');
    try {
      fs.mkdirSync(candidatePath, { recursive: true });
      const testFile = path.join(candidatePath, now + '.tmp');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      return candidatePath;
    } catch (e) {
      console.log(candidatePath, 'is not writable:', e.message);
    }
  }
  console.error('Can not find a writable tmp directory, please report issue on https://github.com/giggio/chromedriver/issues/ with as much information as possible.');
  process.exit(1);
}

function getRequestOptions(downloadPath) {
  /** @type import('axios').AxiosRequestConfig */
  const options = { url: downloadPath, method: "GET" };
  const urlParts = url.parse(downloadPath);
  const isHttps = urlParts.protocol === 'https:';
  const proxyUrl = getProxyForUrl(downloadPath);

  if (proxyUrl) {
    const proxyUrlParts = url.parse(proxyUrl);
    if (proxyUrlParts.hostname && proxyUrlParts.protocol)
      options.proxy = {
        host: proxyUrlParts.hostname,
        port: proxyUrlParts.port ? parseInt(proxyUrlParts.port) : 80,
        protocol: proxyUrlParts.protocol
      };
  }

  if (isHttps) {
    // Use certificate authority settings from npm
    let ca = process.env.npm_config_ca;
    if (ca)
      console.log('Using npmconf ca.');

    if (!ca && process.env.npm_config_cafile) {
      try {
        ca = fs.readFileSync(process.env.npm_config_cafile, { encoding: 'utf8' });
      } catch (e) {
        console.error('Could not read cafile', process.env.npm_config_cafile, e);
      }
      console.log('Using npmconf cafile.');
    }

    if (proxyUrl) {
      console.log('Using workaround for https-url combined with a proxy.');
      const httpsProxyAgentOptions = url.parse(proxyUrl);
      // @ts-ignore
      httpsProxyAgentOptions.ca = ca;
      // @ts-ignore
      httpsProxyAgentOptions.rejectUnauthorized = !!process.env.npm_config_strict_ssl;
      // @ts-ignore
      options.httpsAgent = new HttpsProxyAgent(httpsProxyAgentOptions);
      options.proxy = false;
    } else {
      options.httpsAgent = new https.Agent({
        rejectUnauthorized: !!process.env.npm_config_strict_ssl,
        ca: ca
      });
    }
  }

  // Use specific User-Agent
  if (process.env.npm_config_user_agent) {
    options.headers = { 'User-Agent': process.env.npm_config_user_agent };
  }

  return options;
}

/**
 *
 * @param {import('axios').AxiosRequestConfig} requestOptions
 */
async function getChromeDriverVersion(requestOptions) {
  console.log('Finding Chromedriver version.');
  // @ts-expect-error
  const response = await axios.request(requestOptions);
  chromedriver_version = response.data.trim();
  console.log(`Chromedriver version is ${chromedriver_version}.`);
}

/**
 *
 * @param {import('axios').AxiosRequestConfig} requestOptions
 * @param {string} filePath
 */
async function requestBinary(requestOptions, filePath) {
  const outFile = fs.createWriteStream(filePath);
  let response;
  try {
    // @ts-expect-error
    response = await axios.request({ responseType: 'stream', ...requestOptions });
  } catch (error) {
    if (error && error.response) {
      if (error.response.status)
        console.error('Error status code:', error.response.status);
      if (error.response.data) {
        error.response.data.on('data', data => console.error(data.toString('utf8')));
        try {
          await finishedAsync(error.response.data);
        } catch (error) {
          console.error('Error downloading entire response:', error);
        }
      }
    }
    throw new Error('Error with http(s) request: ' + error);
  }
  let count = 0;
  let notifiedCount = 0;
  response.data.on('data', data => {
    count += data.length;
    if ((count - notifiedCount) > 1024 * 1024) {
      console.log('Received ' + Math.floor(count / 1024) + 'K...');
      notifiedCount = count;
    }
  });
  response.data.on('end', () => console.log('Received ' + Math.floor(count / 1024) + 'K total.'));
  const pipe = response.data.pipe(outFile);
  await new Promise((resolve, reject) => {
    pipe.on('finish', resolve);
    pipe.on('error', reject);
  });
}

async function extractDownload(dirToExtractTo) {
  if (path.extname(downloadedFile) !== '.zip') {
    fs.copyFileSync(downloadedFile, chromedriverBinaryFilePath);
    console.log('Skipping zip extraction - binary file found.');
    return;
  }
  console.log(`Extracting zip contents to ${dirToExtractTo}.`);
  try {
    await extractZip(path.resolve(downloadedFile), { dir: dirToExtractTo });
  } catch (error) {
    throw new Error('Error extracting archive: ' + error);
  }
}

async function copyIntoPlace(originPath, targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
  console.log(`Copying from ${originPath} to target path ${targetPath}`);
  fs.mkdirSync(targetPath);

  // Look for the extracted directory, so we can rename it.
  const files = fs.readdirSync(originPath, { withFileTypes: true })
    .filter(dirent => dirent.isFile() && dirent.name.startsWith('chromedriver') && !dirent.name.endsWith(".debug") && !dirent.name.endsWith(".zip"))
    .map(dirent => dirent.name);
  const promises = files.map(name => {
    return /** @type {Promise<void>} */(new Promise((resolve) => {
      const file = path.join(originPath, name);
      const reader = fs.createReadStream(file);
      const targetFile = path.join(targetPath, name);
      const writer = fs.createWriteStream(targetFile);
      writer.on("close", () => resolve());
      reader.pipe(writer);
    }));
  });
  await Promise.all(promises);
}


function fixFilePermissions() {
  // Check that the binary is user-executable and fix it if it isn't (problems with unzip library)
  if (process.platform != 'win32') {
    const stat = fs.statSync(helper.path);
    // 64 == 0100 (no octal literal in strict mode)
    if (!(stat.mode & 64)) {
      console.log('Fixing file permissions.');
      fs.chmodSync(helper.path, '755');
    }
  }
}

function getMacOsRealArch() {
  if (process.arch === 'arm64' || isEmulatedRosettaEnvironment()) {
    if (compareVersions(chromedriver_version, '106.0.5249.61') < 0) {
      return 'mac64_m1';
    }

    return 'mac_arm64';
  }

  if (process.arch === 'x64') {
    return 'mac64';
  }

  return null;
}

function isEmulatedRosettaEnvironment() {
  const archName = child_process.spawnSync('uname', ['-m']).stdout.toString().trim();

  if (archName === 'x86_64') {
    const proc = child_process.spawnSync('sysctl', ['-in', 'sysctl.proc_translated']);

    // When run with `-in`, the return code is 0 even if there is no `sysctl.proc_translated`
    if (proc.status) {
      throw new Error('Unexpected return code from sysctl: ' + proc.status);
    }

    // If there is no `sysctl.proc_translated` (i.e. not rosetta) then nothing is printed to
    // stdout
    if (!proc.stdout) {
      return false;
    }

    const processTranslated = proc.stdout.toString().trim();

    return processTranslated === '1';
  }

  return false;
}

function Deferred() {
  this.resolve = null;
  this.reject = null;
  this.promise = new Promise(function (resolve, reject) {
    this.resolve = resolve;
    this.reject = reject;
  }.bind(this));
  Object.freeze(this);
}
