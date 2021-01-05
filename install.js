"use strict";

const extractZip = require("extract-zip");
const fs = require("fs");
const helper = require("./lib/msedgedriver");
const request = require("request");
const mkdirp = require("mkdirp");
const path = require("path");
const del = require("del");
const child_process = require("child_process");
const os = require("os");

const libFileName = "libc++.dylib";

const skipDownload =
  process.env.npm_config_edgechromiumdriver_skip_download ||
  process.env.EDGECHROMIUMDRIVER_SKIP_DOWNLOAD;
if (skipDownload === "true") {
  console.log("Found EDGECHROMIUMDRIVER_SKIP_DOWNLOAD variable, skipping installation.");
  process.exit(0);
}

const libPath = path.join(__dirname, "lib", "msedgedriver");
let cdnUrl =
  process.env.npm_config_edgechromiumdriver_cdnurl ||
  process.env.EDGECHROMIUMDRIVER_CDNURL ||
  "https://msedgedriver.azureedge.net/";
const configuredfilePath =
  process.env.npm_config_EDGECHROMIUMDRIVER_FILEPATH || process.env.EDGECHROMIUMDRIVER_FILEPATH;

cdnUrl = cdnUrl.replace(/\/+$/, "");
let platform = process.platform;

let edgechromiumdriver_version =
  process.env.npm_config_edgechromiumdriver_version ||
  process.env.EDGECHROMIUMDRIVER_VERSION ||
  helper.version;
if (platform === "linux") {
  console.log("Linux not supported.");
  process.exit(0);
} else if (platform === "darwin" || platform === "freebsd") {
  if (process.arch === "x64") {
    // @ts-ignore
    platform = "mac64";
  } else {
    console.log("Only Mac 64 bits supported.");
    process.exit(1);
  }
} else if (platform !== "win32") {
  console.log("Unexpected platform or architecture:", process.platform, process.arch);
  process.exit(1);
}
let tmpPath;
const edgechromiumdriverBinaryFileName =
  process.platform === "win32" ? "msedgedriver.exe" : "msedgedriver";
let edgechromiumdriverBinaryFilePath;
let downloadedFile = "";

Promise.resolve()
  .then(function() {
    if (edgechromiumdriver_version === "LATEST")
      return getLatestVersion(getRequestOptions(cdnUrl + "/LATEST_STABLE"));
  })
  .then(() => {
    tmpPath = findSuitableTempDirectory();
    edgechromiumdriverBinaryFilePath = path.resolve(tmpPath, edgechromiumdriverBinaryFileName);
  })
  .then(verifyIfChromedriverIsAvailableAndHasCorrectVersion)
  .then(edgechromiumdriverIsAvailable => {
    if (edgechromiumdriverIsAvailable) return;
    console.log(
      "Current existing msedgedriver binary is unavailable, proceding with download and extraction."
    );
    return downloadFile().then(extractDownload);
  })
  .then(() => fixFilePermissions(tmpPath + "/" + libFileName))
  .then(() => copyIntoPlace(tmpPath, libPath))
  .then(() => fixFilePermissions(helper.path))
  .then(() => console.log("Done. msedgedriver binary available at", helper.path))
  .catch(function(err) {
    console.error("msedgedriver installation failed", err);
    process.exit(1);
  });

function downloadFile() {
  if (configuredfilePath) {
    downloadedFile = configuredfilePath;
    console.log("Using file: ", downloadedFile);
    return Promise.resolve();
  } else {
    const fileName = `edgedriver_${platform}.zip`;
    const tempDownloadedFile = path.resolve(tmpPath, fileName);
    downloadedFile = tempDownloadedFile;
    const formattedDownloadUrl = `${cdnUrl}/${edgechromiumdriver_version}/${fileName}`;
    console.log("Downloading from file: ", formattedDownloadUrl);
    console.log("Saving to file:", downloadedFile);
    return requestBinary(getRequestOptions(formattedDownloadUrl), downloadedFile);
  }
}

function verifyIfChromedriverIsAvailableAndHasCorrectVersion() {
  if (!fs.existsSync(edgechromiumdriverBinaryFilePath)) return false;
  const forceDownload =
    process.env.npm_config_edgechromiumdriver_force_download === "true" ||
    process.env.EDGECHROMIUMDRIVER_FORCE_DOWNLOAD === "true";
  if (forceDownload) {
    fixFilePermissions(tmpPath + "/" + libFileName);
    return false;
  }
  console.log("msedgedriver binary exists. Validating...");
  const deferred = new Deferred();
  try {
    fs.accessSync(edgechromiumdriverBinaryFilePath, fs.constants.X_OK);
    const cp = child_process.spawn(edgechromiumdriverBinaryFilePath, ["--version"]);
    let str = "";
    cp.stdout.on("data", function(data) {
      str += data;
    });
    cp.on("error", function() {
      deferred.resolve(false);
    });
    cp.on("close", function(code) {
      if (code !== 0) return deferred.resolve(false);
      const parts = str.split(" ");
      if (parts.length < 3) return deferred.resolve(false);
      if (parts[1].startsWith(edgechromiumdriver_version)) {
        console.log(str);
        console.log(`msedgedriver is already available at '${edgechromiumdriverBinaryFilePath}'.`);
        return deferred.resolve(true);
      }
      deferred.resolve(false);
    });
  } catch (error) {
    deferred.resolve(false);
  }
  return deferred.promise;
}

function findSuitableTempDirectory() {
  const now = Date.now();
  const candidateTmpDirs = [
    process.env.TMPDIR || process.env.TMP || process.env.npm_config_tmp,
    os.tmpdir(),
    "/tmp",
    path.join(process.cwd(), "tmp")
  ];

  for (let i = 0; i < candidateTmpDirs.length; i++) {
    if (!candidateTmpDirs[i]) continue;
    // Prevent collision with other versions in the dependency tree
    const namespace = edgechromiumdriver_version;
    const candidatePath = path.join(candidateTmpDirs[i], namespace, "msedgedriver");
    try {
      mkdirp.sync(candidatePath, "0777");
      const testFile = path.join(candidatePath, now + ".tmp");
      fs.writeFileSync(testFile, "test");
      fs.unlinkSync(testFile);
      return candidatePath;
    } catch (e) {
      console.log(candidatePath, "is not writable:", e.message);
    }
  }

  console.error(
    "Can not find a writable tmp directory, please report issue on https://github.com/uex-io/node-msedgedriver/issues/ with as much information as possible."
  );
  process.exit(1);
}

function getRequestOptions(downloadPath) {
  const options = { uri: downloadPath, method: "GET" };
  const protocol = options.uri.substring(0, options.uri.indexOf("//"));
  const proxyUrl =
    protocol === "https:"
      ? process.env.npm_config_https_proxy
      : process.env.npm_config_proxy || process.env.npm_config_http_proxy;
  if (proxyUrl) {
    options.proxy = proxyUrl;
  }

  options.strictSSL = !!process.env.npm_config_strict_ssl;

  // Use certificate authority settings from npm
  let ca = process.env.npm_config_ca;

  // Parse ca string like npm does
  if (ca && ca.match(/^".*"$/)) {
    try {
      ca = JSON.parse(ca.trim());
    } catch (e) {
      console.error("Could not parse ca string", process.env.npm_config_ca, e);
    }
  }

  if (!ca && process.env.npm_config_cafile) {
    try {
      ca = fs
        .readFileSync(process.env.npm_config_cafile, { encoding: "utf8" })
        .split(/\n(?=-----BEGIN CERTIFICATE-----)/g);

      // Comments at the beginning of the file result in the first
      // item not containing a certificate - in this case the
      // download will fail
      if (ca.length > 0 && !/-----BEGIN CERTIFICATE-----/.test(ca[0])) {
        ca.shift();
      }
    } catch (e) {
      console.error("Could not read cafile", process.env.npm_config_cafile, e);
    }
  }

  if (ca) {
    console.log("Using npmconf ca");
    options.agentOptions = {
      ca: ca
    };
    options.ca = ca;
  }

  // Use specific User-Agent
  if (process.env.npm_config_user_agent) {
    options.headers = { "User-Agent": process.env.npm_config_user_agent };
  }

  return options;
}

function getLatestVersion(requestOptions) {
  const deferred = new Deferred();
  request(requestOptions, function(err, response, data) {
    if (err) {
      deferred.reject("Error with http(s) request: " + err);
    } else {
      edgechromiumdriver_version = data.trim();
      deferred.resolve(true);
    }
  });
  return deferred.promise;
}

function requestBinary(requestOptions, filePath) {
  const deferred = new Deferred();

  let count = 0;
  let notifiedCount = 0;
  const outFile = fs.openSync(filePath, "w");

  const client = request(requestOptions);

  client.on("error", function(err) {
    deferred.reject("Error with http(s) request: " + err);
  });

  client.on("data", function(data) {
    fs.writeSync(outFile, data, 0, data.length, null);
    count += data.length;
    if (count - notifiedCount > 800000) {
      console.log("Received " + Math.floor(count / 1024) + "K...");
      notifiedCount = count;
    }
  });

  client.on("end", function() {
    console.log("Received " + Math.floor(count / 1024) + "K total.");
    fs.closeSync(outFile);
    deferred.resolve(true);
  });

  return deferred.promise;
}

function extractDownload() {
  if (path.extname(downloadedFile) !== ".zip") {
    fs.copyFileSync(downloadedFile, edgechromiumdriverBinaryFilePath);
    console.log("Skipping zip extraction - binary file found.");
    return Promise.resolve();
  }
  const deferred = new Deferred();
  console.log("Extracting zip contents");
  extractZip(path.resolve(downloadedFile), { dir: tmpPath }, function(err) {
    if (err) {
      if (err.message.includes(libFileName)) {
        console.log("Ignoring complaint: " + err);
        deferred.resolve(true);
      } else {
        deferred.reject("Error extracting archive: " + err);
      }
    } else {
      deferred.resolve(true);
    }
  });
  return deferred.promise;
}

function copyIntoPlace(originPath, targetPath) {
  return del(targetPath).then(function() {
    console.log("Copying to target path", targetPath);

    mkdirp.sync(targetPath, "0777");

    // Look for the extracted directory, so we can rename it.
    console.log("reading orig folder ", originPath);
    const files = fs.readdirSync(originPath);
    let justFiles = [];
    files.map(function(name) {
      var stat = fs.statSync(path.join(originPath, name));
      if (!stat.isDirectory() && (name.startsWith("msedgedriver") || name === libFileName)) {
        console.log("handling file ", name);
        justFiles.push(name);
      } else {
        console.log("Ignoring ", name);
      }
    });

    const promises = justFiles.map(function(name) {
      const deferred = new Deferred();

      const file = path.join(originPath, name);
      console.log("handling file ", file);
      const reader = fs.createReadStream(file);
      const targetFile = path.join(targetPath, name);
      console.log("writing file ", targetFile);
      const writer = fs.createWriteStream(targetFile);

      writer.on("close", function() {
        deferred.resolve(true);
      });

      reader.pipe(writer);
      return deferred.promise;
    });
    return Promise.all(promises);
  });
}

function fixFilePermissions(path) {
  // Check that the binary is user-executable and fix it if it isn't (problems with unzip library)
  if (process.platform != "win32") {
    try {
      const stat = fs.statSync(path);
      // 64 == 0100 (no octal literal in strict mode)
      if (!(stat.mode & 64)) {
        console.log("Fixing file permissions for ", path);
        fs.chmodSync(path, "755");
      }
    } catch (e) {
      console.log(path, "Ignoring chmod failure", e.message);
    }
  }
}

function Deferred() {
  this.resolve = null;
  this.reject = null;
  this.promise = new Promise(
    function(resolve, reject) {
      this.resolve = resolve;
      this.reject = reject;
    }.bind(this)
  );
  Object.freeze(this);
}
