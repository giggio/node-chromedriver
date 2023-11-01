#!/usr/bin/env node

"use strict";

const os = require('os');
const path = require('path');
const fs = require('fs');
const spawnSync = require('child_process').spawnSync;
const versions = ['18', '20', '21'];
const tempInstallPath = path.resolve(os.tmpdir(), 'chromedriver-test');
const packedFile = path.resolve(tempInstallPath, 'chromedriver.tgz');

run();

function directoryExists(file) {
  try {
    const stat = fs.lstatSync(file);
    return stat.isDirectory();
  } catch (err) {
    return false;
  }
}

function fileExists(file) {
  try {
    const stat = fs.lstatSync(file);
    return stat.isFile();
  } catch (err) {
    return false;
  }
}

function removeFolder(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach((file) => {
    const curPath = dir + path.sep + file;
    if (fs.lstatSync(curPath).isDirectory())
      removeFolder(curPath);
    else
      fs.unlinkSync(curPath);
  });
  fs.rmdirSync(dir);
}

function checkSpawn(spawnInfo) {
  if (spawnInfo.stdout) {
    if (typeof (spawnInfo.stdout) !== 'string')
      console.log(spawnInfo.stdout.toString('utf8'));
    else
      console.log(spawnInfo.stdout);
  }
  if (spawnInfo.stderr) {
    if (typeof (spawnInfo.error) !== 'string')
      console.error(spawnInfo.stderr.toString('utf8'));
    else
      console.error(spawnInfo.stderr);
  }
  if (spawnInfo.status !== 0 || spawnInfo.error) {
    console.error('Failed when spawning.');
    process.exit(1);
  }
  if (typeof (spawnInfo.stdout) !== 'string')
    return spawnInfo.stdout.toString('utf8');
  else
    return spawnInfo.stdout;
}

function nvmUse(version) {
  const versionsText = os.platform() === 'win32'
    ? checkSpawn(spawnSync('nvm', ['list']))
    : checkSpawn(spawnSync('/bin/bash', ['-c', `source $HOME/.nvm/nvm.sh && nvm version ${version}`]));
  const versionsAvailable = versionsText.split('\n').map(v => v.match(/\d+\.\d+\.\d+/)).filter(v => v).map(v => v[0]);
  const largestMatch = versionsAvailable.filter(v => v.match(`^${version}\\.`)).map(v => v.match(/\d+\.(\d+)\.\d+/)).reduce(((max, v) => max[1] > v[1] ? max : v), [null, 0]);
  if (largestMatch.length === 0) {
    console.error(`Version '${version}' not found.`);
    process.exit(3);
  }
  const largestMatchingVersion = largestMatch.input;
  console.log(`Found version '${largestMatchingVersion}'.`);
  if (os.platform() === 'win32')
    checkSpawn(spawnSync('nvm', ['use', largestMatchingVersion]));
  else
    checkSpawn(spawnSync('/bin/bash', ['-c', `source $HOME/.nvm/nvm.sh && nvm use ${largestMatchingVersion}`]));
}

async function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function pack() {
  for (const file of fs.readdirSync(__dirname).filter(fn => fn.endsWith('.tgz'))) {
    console.log(`Removing '${file}'.`);
    fs.rmSync(file, { recursive: true });
  }
  if (os.platform() === 'win32') {
    checkSpawn(spawnSync('cmd.exe', ['/c', `npm pack`], { cwd: __dirname }));
  } else {
    checkSpawn(spawnSync('npm', ['pack'], { cwd: __dirname }));
  }
  const fileNames = fs.readdirSync(__dirname).filter(f => f.endsWith(".tgz"));
  if (fileNames.length !== 1) {
    console.error("Could not find packed file.");
    process.exit(3);
  }
  fs.copyFileSync(fileNames[0], packedFile);
  fs.unlinkSync(fileNames[0]);
}

function checkFile(tempInstallPathForVersion, version) {
  const executable = path.resolve(tempInstallPathForVersion, 'node_modules', 'chromedriver', 'lib', 'chromedriver', `chromedriver${os.platform() === 'win32' ? '.exe' : ''}`);
  if (fileExists(executable)) {
    console.log(`Version ${version} installed fine.`);
  }
  else {
    console.error(`Version ${version} did not install correctly, file '${executable}' was not found.`);
    process.exit(2);
  }
}

async function run() {
  if (directoryExists(tempInstallPath)) {
    console.log(`Deleting directory '${tempInstallPath}'.`);
    removeFolder(tempInstallPath);
  }
  fs.mkdirSync(tempInstallPath);
  await pack();

  for (const version of versions) {
    console.log(`Testing version ${version}...`);
    const tempInstallPathForVersion = path.resolve(tempInstallPath, version);
    fs.mkdirSync(tempInstallPathForVersion);
    nvmUse(version);
    if (os.platform() === 'win32') {
      await sleep(2000); // wait 2 seconds until everything is in place
      checkSpawn(spawnSync('cmd.exe', ['/c', `npm i --no-progress --chromedriver-force-download --no-save --no-audit --no-package-lock ${packedFile}`], { cwd: tempInstallPathForVersion }));
      checkFile(tempInstallPathForVersion, version);
      fs.rmSync(tempInstallPathForVersion, { recursive: true, force: true });
      fs.mkdirSync(tempInstallPathForVersion);
      checkSpawn(spawnSync('cmd.exe', ['/c', `npm i --no-progress --no-save --no-audit --no-package-lock ${packedFile}`], { cwd: tempInstallPathForVersion }));
      checkFile(tempInstallPathForVersion, version);
    } else {
      checkSpawn(spawnSync('npm', ['i', '--no-progress', '--chromedriver-force-download', '--no-save', '--no-audit', '--no-package-lock', `${packedFile}`], { cwd: tempInstallPathForVersion }));
      checkFile(tempInstallPathForVersion, version);
      fs.rmSync(tempInstallPathForVersion, { recursive: true, force: true });
      fs.mkdirSync(tempInstallPathForVersion);
      checkSpawn(spawnSync('npm', ['i', '--no-progress', '--no-save', '--no-audit', '--no-package-lock', `${packedFile}`], { cwd: tempInstallPathForVersion }));
      checkFile(tempInstallPathForVersion, version);
    }
  }

  try {
    removeFolder(tempInstallPath);
  } catch (err) {
    console.error(`Could not delete folder '${tempInstallPath}'.`);
  }
}
