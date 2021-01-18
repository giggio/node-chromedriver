#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const execSync = require('child_process').execSync;
const CURRENT_VERSION = require('./lib/chromedriver').version;

// fetch the latest chromedriver version
async function getLatest() {
  const requestOptions = { url: 'https://chromedriver.storage.googleapis.com/LATEST_RELEASE', method: "GET" };
  try {
    const response = await axios(requestOptions);
    return response.data.trim();
  } catch (err) {
    console.log(err)
    process.exit(1);
  }
};

/* Provided a new Chromedriver version such as 77.0.3865.40:
   - update the version inside the ./lib/chromedriver helper file e.g. exports.version = '77.0.3865.40';
   - bumps package.json version number
   - add a git tag using the new node-chromedriver version
   - add a git commit, e.g. Bump version to 77.0.0
*/
const writeUpdate = (version) => {
  const helper = fs.readFileSync('./lib/chromedriver.js', 'utf8');
  const versionExport = 'exports.version';
  const regex = new RegExp(`^.*${versionExport}.*$`, 'gm');
  const updated = helper.replace(regex, `${versionExport} = '${version}';`);
  fs.writeFileSync('./lib/chromedriver.js', updated, 'utf8');
  const packageVersion = `${version.slice(0, 2)}.0.0`;
  execSync(`npm version ${packageVersion} --git-tag-version=false && git add . && git commit -m "Bump version to ${packageVersion}" && git tag -s ${packageVersion} -m ${packageVersion}`);
};

getLatest().then(version => {
  if (CURRENT_VERSION === version) {
    console.log('Chromedriver version is up to date.');
  } else {
    writeUpdate(version);
    console.log(`Chromedriver version updated to ${version}`);
  }
}, err => {
  console.log(err)
});
