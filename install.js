'use strict';
// @ts-check

const fs = require('node:fs');
const helper = require('./lib/chromedriver');
const axios = require('axios').default;
const path = require('node:path');
const child_process = require('node:child_process');
const os = require('node:os');
const { ProxyAgent } = require('proxy-agent');
const { promisify } = require('node:util');
const { finished } = require('node:stream');
const extractZip = require('extract-zip');
const { getChromeVersion } = require('@testim/chrome-version');
const { compareVersions } = require('compare-versions');
const finishedAsync = promisify(finished);
const process = require('node:process');
const console = require('node:console');

function getNpmEnvVar(name) {
  return process.env[name.toUpperCase()] ??
    process.env[`npm_package_config_${name}`] ??
    process.env[`npm_config_${name}`];
}

class Installer {
  async install() {
    const skipDownload = (getNpmEnvVar('chromedriver_skip_download') === 'true');
    if (skipDownload) {
      console.log('Found CHROMEDRIVER_SKIP_DOWNLOAD variable, skipping installation.');
      process.exit(0);
    }
    const cdnUrl = (getNpmEnvVar('chromedriver_cdnurl') || 'https://googlechromelabs.github.io').replace(/\/+$/, '');
    const legacyCdnUrl = (getNpmEnvVar('chromedriver_legacy_cdnurl') || 'https://chromedriver.storage.googleapis.com').replace(/\/+$/, '');
    let chromedriverVersion = getNpmEnvVar('chromedriver_version') || helper.version;
    const detectChromedriverVersion = (getNpmEnvVar('detect_chromedriver_version') === 'true');
    try {
      if (detectChromedriverVersion) {
        const includeChromium = (getNpmEnvVar('include_chromium') === 'true');
        // Refer http://chromedriver.chromium.org/downloads/version-selection
        const chromeVersion = await getChromeVersion(includeChromium);
        console.log("Your Chrome version is " + chromeVersion);
        const versionMatch = /^(.*?)\.\d+$/.exec(chromeVersion);
        if (versionMatch) {
          chromedriverVersion = await this.getChromeDriverVersion(cdnUrl, legacyCdnUrl, parseInt(versionMatch[1]));
          console.log("Compatible ChromeDriver version is " + chromedriverVersion);
        }
      } else if (chromedriverVersion === 'LATEST') {
        chromedriverVersion = await this.getChromeDriverVersion(cdnUrl, legacyCdnUrl);
      } else {
        const latestReleaseForVersionMatch = chromedriverVersion.match(/LATEST_(\d+)/);
        if (latestReleaseForVersionMatch) {
          chromedriverVersion = await this.getChromeDriverVersion(cdnUrl, legacyCdnUrl, parseInt(latestReleaseForVersionMatch[1]));
        }
      }
      let tmpPath = this.findSuitableTempDirectory(chromedriverVersion);
      const extractDirectory = tmpPath;
      const majorVersion = parseInt(chromedriverVersion.split('.')[0]);
      const useLegacyMethod = majorVersion <= 114;
      const platform = this.getPlatform(chromedriverVersion);
      let downloadedFile = this.getDownloadFilePath(useLegacyMethod, tmpPath, platform);
      if (!useLegacyMethod)
        tmpPath = path.join(tmpPath, path.basename(downloadedFile, path.extname(downloadedFile)));
      const chromedriverBinaryFileName = process.platform === 'win32' ? 'chromedriver.exe' : 'chromedriver';
      const chromedriverBinaryFilePath = path.resolve(tmpPath, chromedriverBinaryFileName);
      const chromedriverIsAvailable = await this.verifyIfChromedriverIsAvailableAndHasCorrectVersion(chromedriverVersion, chromedriverBinaryFilePath);
      if (!chromedriverIsAvailable) {
        console.log('Current existing ChromeDriver binary is unavailable, proceeding with download and extraction.');
        const configuredfilePath = getNpmEnvVar('chromedriver_filepath');
        if (configuredfilePath) {
          console.log('Using file: ', configuredfilePath);
          downloadedFile = configuredfilePath;
        } else {
          if (useLegacyMethod)
            await this.downloadFileLegacy(legacyCdnUrl, downloadedFile, chromedriverVersion);
          else
            await this.downloadFile(cdnUrl, downloadedFile, chromedriverVersion, platform);
        }
        await this.extractDownload(extractDirectory, chromedriverBinaryFilePath, downloadedFile);
      }
      const libPath = path.join(__dirname, 'lib', 'chromedriver');
      await this.copyIntoPlace(tmpPath, libPath);
      this.fixFilePermissions();
      console.log('Done. ChromeDriver binary available at', helper.path);
    } catch (err) {
      console.error('ChromeDriver installation failed', err);
      process.exit(1);
    }
  }

  /**
   * @param {string} chromedriverVersion
   */
  getPlatform(chromedriverVersion) {
    const thePlatform = process.platform;
    if (thePlatform === 'linux') {
      if (process.arch === 'arm64' || process.arch === 's390x' || process.arch === 'x64') {
        return 'linux64';
      } else if (process.arch === 'riscv64') {
        // Check if --chromedriver_filepath is provided via env vars
        const configuredfilePath = getNpmEnvVar('chromedriver_filepath');
        if (!configuredfilePath) {
          console.error(
            'Error: RISC-V detected: No official Chromedriver binary is available for RISC-V 64-bit. ' +
            'Please provide a local Chromedriver binary using the --chromedriver_filepath option. ' +
            'Example: npm install chromedriver --chromedriver_filepath=/path/to/chromedriver ' +
            'You may need to build Chromedriver from source or obtain it from a third-party source.'
          );
          process.exit(1);
        }
        // Return a placeholder platform; actual file will come from configuredfilePath
        return 'linux64'; // Compatible with downstream logic, though download is skipped
      } else {
        console.error('Only Linux 64 bits supported.');
        process.exit(1);
      }
    } else if (thePlatform === 'darwin' || thePlatform === 'freebsd') {
      const osxPlatform = this.getMacOsRealArch(chromedriverVersion);

      if (!osxPlatform) {
        console.error('Only Mac 64 bits supported.');
        process.exit(1);
      }

      return osxPlatform;
    } else if (thePlatform === 'win32') {
      if (compareVersions(chromedriverVersion, '115') < 0) {
        return 'win32';
      }
      return (process.arch === 'x64') ? 'win64' : 'win32';
    }
    console.error('Unexpected platform or architecture:', process.platform, process.arch);
    process.exit(1);
  }

  /**
   * @param {string} cdnUrl
   * @param {string} downloadedFile
   * @param {string} chromedriverVersion
   * @param {string} platform
   */
  async downloadFile(cdnUrl, downloadedFile, chromedriverVersion, platform) {
    const cdnBinariesUrl = (getNpmEnvVar('chromedriver_cdnbinariesurl'))?.replace(/\/+$/, '');
    const url = cdnBinariesUrl
      ? `${cdnBinariesUrl}/${chromedriverVersion}/${platform}/${path.basename(downloadedFile)}`
      : await this.getDownloadUrl(cdnUrl, chromedriverVersion, platform);
    if (!url) {
      console.error(`Download url could not be found for version ${chromedriverVersion} and platform '${platform}'`);
      process.exit(1);
    }
    console.log('Downloading from file: ', url);
    await this.requestBinary(this.getRequestOptions(url), downloadedFile);
  }

  /**
   * @param {string} cdnUrl
   * @param {string} downloadedFile
   * @param {string} chromedriverVersion
   */
  async downloadFileLegacy(cdnUrl, downloadedFile, chromedriverVersion) {
    const url = `${cdnUrl}/${chromedriverVersion}/${path.basename(downloadedFile)}`;
    console.log('Downloading from file: ', url);
    await this.requestBinary(this.getRequestOptions(url), downloadedFile);
  }

  /**
   * @param {any} useLegacyPath
   * @param {string} dirToLoadTo
   * @param {string} platform
   */
  getDownloadFilePath(useLegacyPath, dirToLoadTo, platform) {
    const fileName = useLegacyPath ? `chromedriver_${platform}.zip` : `chromedriver-${platform}.zip`;
    const downloadedFile = path.resolve(dirToLoadTo, fileName);
    console.log('Saving to file:', downloadedFile);
    return downloadedFile;
  }

  /**
   * @param {string} chromedriverVersion
   * @param {string} chromedriverBinaryFilePath
   */
  verifyIfChromedriverIsAvailableAndHasCorrectVersion(chromedriverVersion, chromedriverBinaryFilePath) {
    if (!fs.existsSync(chromedriverBinaryFilePath))
      return Promise.resolve(false);
    const forceDownload = getNpmEnvVar('chromedriver_force_download') === 'true';
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
        if (parts[1].startsWith(chromedriverVersion)) {
          console.log(`ChromeDriver is already available at '${chromedriverBinaryFilePath}'.`);
          return deferred.resolve(true);
        }
        deferred.resolve(false);
      });
    }
    catch {
      deferred.resolve(false);
    }
    return deferred.promise;
  }

  /**
   * @param {string} chromedriverVersion
   */
  findSuitableTempDirectory(chromedriverVersion) {
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
      const namespace = chromedriverVersion;
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

  getRequestOptions(downloadPath) {
    /** @type import('axios').AxiosRequestConfig */
    const options = { url: downloadPath, method: "GET" };
    const urlParts = new URL(downloadPath);
    const isHttps = urlParts.protocol === 'https:';

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
      options.httpsAgent = new ProxyAgent({
        rejectUnauthorized: !!process.env.npm_config_strict_ssl,
        ca: ca
      });
      options.proxy = false;
    } else {
      const { getProxyForUrl } = require("proxy-from-env");
      const proxyUrl = getProxyForUrl(downloadPath);
      if (proxyUrl) {
        const proxyUrlParts = new URL(proxyUrl);
        if (proxyUrlParts.hostname && proxyUrlParts.protocol)
          options.proxy = {
            host: proxyUrlParts.hostname,
            port: proxyUrlParts.port ? parseInt(proxyUrlParts.port) : 80,
            protocol: proxyUrlParts.protocol
          };
      }
    }

    // Use specific User-Agent
    if (process.env.npm_config_user_agent) {
      options.headers = { 'User-Agent': process.env.npm_config_user_agent };
    }

    return options;
  }

  /**
   * @param {string} cdnUrl
   * @param {string} legacyCdnUrl
   * @param {number} [majorVersion]
   * @returns {Promise<string>}
   */
  async getChromeDriverVersion(cdnUrl, legacyCdnUrl, majorVersion) {
    if (majorVersion == null || majorVersion > 114) {
      console.log('Finding Chromedriver version.');
      let chromedriverVersion;
      if (majorVersion) {
        const requestOptions = this.getRequestOptions(`${cdnUrl}/chrome-for-testing/latest-versions-per-milestone.json`);
        const response = await axios.request(requestOptions);
        chromedriverVersion = response.data?.milestones[majorVersion.toString()]?.version;
      } else {
        const requestOptions = this.getRequestOptions(`${cdnUrl}/chrome-for-testing/last-known-good-versions.json`);
        const response = await axios.request(requestOptions);
        chromedriverVersion = response.data?.channels?.Stable?.version;
      }
      console.log(`Chromedriver version is ${chromedriverVersion}.`);
      return chromedriverVersion;
    } else {
      console.log('Finding Chromedriver version using legacy method.');
      const urlPath = majorVersion ? `LATEST_RELEASE_${majorVersion}` : 'LATEST_RELEASE';
      const requestOptions = this.getRequestOptions(`${legacyCdnUrl}/${urlPath}`);
      const response = await axios.request(requestOptions);
      const chromedriverVersion = response.data.trim();
      console.log(`Chromedriver version is ${chromedriverVersion}.`);
      return chromedriverVersion;
    }
  }

  /**
   * @param {string} cdnUrl
   * @param {string} version
   * @param {string} platform
   * @returns {Promise<[string]>}
   */
  async getDownloadUrl(cdnUrl, version, platform) {
    const getUrlUrl = `${cdnUrl}/chrome-for-testing/${version}.json`;
    const requestOptions = this.getRequestOptions(getUrlUrl);
    const response = await axios.request(requestOptions);
    const url = response.data?.downloads?.chromedriver?.find((/** @type {{ platform: string; }} */ c) => c.platform == platform)?.url;
    return url;
  }

  /**
   *
   * @param {import('axios').AxiosRequestConfig} requestOptions
   * @param {string} filePath
   */
  async requestBinary(requestOptions, filePath) {
    const outFile = fs.createWriteStream(filePath);
    let response;
    try {
      response = await axios.request({ responseType: 'stream', ...requestOptions });
    } catch (error) {
      let errorData = '';
      if (error && error.response) {
        if (error.response.status)
          console.error('Error status code:', error.response.status);
        if (error.response.data) {
          error.response.data.on('data', data => errorData += data.toString('utf8'));
          try {
            await finishedAsync(error.response.data);
          } catch (error) {
            console.error('Error downloading entire response:', error);
          }
        }
      }
      console.error(`Error with http(s) request:\n${error}\nError data:\n${errorData}`);
      process.exit(1);
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

  /**
   * @param {string} dirToExtractTo
   * @param {string} chromedriverBinaryFilePath
   * @param {string} downloadedFile
   */
  async extractDownload(dirToExtractTo, chromedriverBinaryFilePath, downloadedFile) {
    if (path.extname(downloadedFile) !== '.zip') {
      fs.mkdirSync(path.dirname(chromedriverBinaryFilePath), { recursive: true });
      fs.copyFileSync(downloadedFile, chromedriverBinaryFilePath);
      console.log('Skipping zip extraction - binary file found.');
      return;
    }
    console.log(`Extracting zip contents to ${dirToExtractTo}.`);
    try {
      await extractZip(path.resolve(downloadedFile), { dir: dirToExtractTo });
    } catch (error) {
      console.error('Error extracting archive: ' + error);
      process.exit(1);
    }
  }

  /**
   * @param {string} originPath
   * @param {string} targetPath
   */
  async copyIntoPlace(originPath, targetPath) {
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


  fixFilePermissions() {
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

  /**
   * @param {string} chromedriverVersion
   */
  getMacOsRealArch(chromedriverVersion) {
    if (process.arch === 'arm64' || this.isEmulatedRosettaEnvironment()) {
      return compareVersions(chromedriverVersion, '106.0.5249.61') < 0
        ? 'mac64_m1'
        : compareVersions(chromedriverVersion, '115') < 0 ? 'mac_arm64' : 'mac-arm64';
    }

    if (process.arch === 'x64') {
      return compareVersions(chromedriverVersion, '115') < 0 ? 'mac64' : 'mac-x64';
    }

    return null;
  }

  isEmulatedRosettaEnvironment() {
    const archName = child_process.spawnSync('uname', ['-m']).stdout.toString().trim();

    if (archName === 'x86_64') {
      const proc = child_process.spawnSync('sysctl', ['-in', 'sysctl.proc_translated']);

      // When run with `-in`, the return code is 0 even if there is no `sysctl.proc_translated`
      if (proc.status) {
        console.error('Unexpected return code from sysctl: ' + proc.status);
        process.exit(1);
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

if (require.main === module)
  new Installer().install();
else if (process.env.NODE_ENV === 'test')
  module.exports = Installer;
