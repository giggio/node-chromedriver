#!/usr/bin/env node

const fs = require('fs');
const semver = require('semver');
const execSync = require('child_process').execSync;
const currentChromedriverVersion = require('./lib/chromedriver').version;
// @ts-expect-error
const currentVersionInPackageJson = require('./package.json').version;

// fetch the latest chromedriver version
async function getLatest() {
  const url = 'https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json';
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data?.channels?.Stable?.version;
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

/* Provided a new Chromedriver version such as 77.0.3865.40:
   - update the version inside the ./lib/chromedriver helper file e.g. exports.version = '77.0.3865.40';
   - bumps package.json version number
   - add a git tag using the new node-chromedriver version
   - add a git commit, e.g. Bump version to 77.0.0
*/
async function writeUpdate(newVersion, shouldCommit) {
  const helper = fs.readFileSync('./lib/chromedriver.js', 'utf8');
  const versionExport = 'exports.version';
  const regex = new RegExp(`^.*${versionExport}.*$`, 'gm');
  const updated = helper.replace(regex, `${versionExport} = '${newVersion}';`);
  const currentMajor = semver.major(currentVersionInPackageJson);
  const newMajor = semver.major(semver.coerce(newVersion));
  const version = currentMajor !== newMajor ? `${newMajor}.0.0` : semver.inc(currentVersionInPackageJson, 'patch');
  execSync(`npm version ${version} --git-tag-version=false`);
  fs.writeFileSync('./lib/chromedriver.js', updated, 'utf8');
  if (!shouldCommit) return;
  execSync('git add :/');
  execSync(`git commit -m "Bump version to ${version}"`);
  execSync(`git tag -s ${version} -m ${version}`);
}

async function run(shouldCommit) {
  try {
    const latestVersion = await getLatest();
    if (currentChromedriverVersion === latestVersion) {
      console.log('Chromedriver version is up to date.');
    } else {
      writeUpdate(latestVersion, shouldCommit);
      console.log(`Chromedriver version updated to ${latestVersion}`);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

const shouldCommit = process.argv.indexOf('--no-commit') == -1;
run(shouldCommit);
