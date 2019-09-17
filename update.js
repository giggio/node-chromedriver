const request = require('request');
const fs = require('fs');
const execSync = require('child_process').execSync;
const CURRENT_VERSION = require('./lib/chromedriver').version;

// fetch the latest chromedriver version
const getLatest = (cb) => {
  request('https://chromedriver.storage.googleapis.com/LATEST_RELEASE', function (err, response, body) {
    if (err) {
      process.exit(1);
    }
    return cb(body);
  });
};

/* Provided a new Chromedriver version such as 77.0.3865.40:
   - update the version inside the ./lib/chromedriver helper file e.g. exports.version = '77.0.3865.40';
   - add a git commit and tag of npm version, e.g. Bump version to 77.0.0
   - bumps npm package version
*/
const writeUpdate = (version) => {
  const helper = fs.readFileSync('./lib/chromedriver.js', 'utf8');
  const versionExport = 'exports.version';
  const regex = new RegExp(`^.*${versionExport}.*$`, 'gm');
  const updated = helper.replace(regex, `${versionExport} = '${version}';`);
  fs.writeFileSync('./lib/chromedriver.js', updated, 'utf8');
  execSync(`git add . && git commit -m "Bump version to ${version.slice(0, 2)}.0.0" && npm version ${version.slice(0, 2)}.0.0`);
};

getLatest(function (version) {
  if (CURRENT_VERSION === version) {
    console.log('Chromedriver version is up to date.');
  } else {
    writeUpdate(version);
    console.log(`Chromedriver version updated to ${version}`);
  }
});
