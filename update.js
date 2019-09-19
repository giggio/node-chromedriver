const request = require("request");
const fs = require("fs");
const execSync = require("child_process").execSync;
const CURRENT_VERSION = require("./lib/msedgedriver").version;

// fetch the latest msedgedriver version
const getLatest = cb => {
	request(
		"https://msedgewebdriverstorage.z22.web.core.windows.net/LATEST_RELEASE_77",
		(err, response, body) => {
			if (err) {
				process.exit(1);
			}
			return cb(body);
		}
	);
};

/* Provided a new msedgedriver version such as 77.0.3865.40:
   - update the version inside the ./lib/msedgedriver helper file e.g. exports.version = '77.0.3865.40';
   - bumps package.json version number
   - add a git tag using the new node-msedgedriver version
   - add a git commit, e.g. Bump version to 77.0.0
*/
const writeUpdate = version => {
	const helper = fs.readFileSync("./lib/msedgedriver.js", "utf8");
	const versionExport = "exports.version";
	const regex = new RegExp(`^.*${versionExport}.*$`, "gm");
	const updated = helper.replace(regex, `${versionExport} = '${version}';`);
	fs.writeFileSync("./lib/msedgedriver.js", updated, "utf8");
	const packageVersion = `${version.slice(0, 2)}.0.0`;
	execSync(
		`npm version ${packageVersion} --git-tag-version=false && git add . && git commit -m "Bump version to ${packageVersion}" && git tag ${packageVersion}`
	);
};

getLatest(version => {
	if (CURRENT_VERSION === version) {
		console.log("msedgedriver version is up to date.");
	} else {
		writeUpdate(version);
		console.log(`msedgedriver version updated to ${version}`);
	}
});
