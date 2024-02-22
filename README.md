# ChromeDriver

[![Build app](https://github.com/giggio/node-chromedriver/actions/workflows/build.yml/badge.svg)](https://github.com/giggio/node-chromedriver/actions/workflows/build.yml)
[![npm](https://img.shields.io/npm/dt/chromedriver.svg)](https://www.npmjs.com/package/chromedriver)

An NPM wrapper for Selenium [ChromeDriver](https://sites.google.com/chromium.org/driver/).

## Building and Installing

```shell
npm install chromedriver
```

Or grab the source and

```shell
node ./install.js
```

What this is really doing is just grabbing a particular "blessed" (by
this module) version of ChromeDriver. As new versions are released
and vetted, this module will be updated accordingly.

The package has been set up to fetch and run ChromeDriver for MacOS (darwin),
Linux based platforms (as identified by Node.js), and Windows.  If you
spot any platform weirdness, let us know or send a patch.

## Force download

By default this package, when installed, will search for an existing
Chromedriver binary in your configured temp directory. If found, and it is the
correct version, it will simply copy it to your node_modules directory. You can
force it always download by configuring it:

```shell
npm install chromedriver --chromedriver-force-download
```

Or add property to your [`.npmrc`](https://docs.npmjs.com/files/npmrc) file.

```ini
chromedriver_force_download=true
```

Another option is to use PATH variable `CHROMEDRIVER_FORCE_DOWNLOAD`.

```shell
CHROMEDRIVER_FORCE_DOWNLOAD=true npm install chromedriver
```

## Custom binaries url

This allows you to use your own endpoints for metadata and binaries. It is useful in air gapped
scenarios or if you have download restrictions, such as firewalls.

This was changed for version 115 and greater
([see details](https://groups.google.com/g/chromedriver-users/c/clpipqvOGjE)),
but implemented in this package starting with version
`114.0.2`. To see the configuration to prior versions check out this
[README.md](https://github.com/giggio/node-chromedriver/tree/114.0.1#custom-binaries-url)
at the latest tag where it was using the legacy urls (`114.0.1`).

### For versions >= 115

There are two urls that need to be configured, one for metadata and one for binaries.
The one for metadata is the "CDN url", and the one for binaries is the "CDN binaries url".
See [Chrome for Testing](https://googlechromelabs.github.io/chrome-for-testing/) to understand
how these urls work.

Npm config:

For metadata use `chromedriver_cdnurl`. The default is `https://googlechromelabs.github.io`. You need to either supply the binary download endpoint, or the binaries url config, see bellow.

For binaries use `chromedriver_cdnbinariesurl`. The default is to search for the download url using
`$chromedriver_cdnurl/chrome-for-testing/[version].json`, which forms a URL like:
https://googlechromelabs.github.io/chrome-for-testing/122.0.6261.57.json.

The resulting url will be something like:
https://storage.googleapis.com/chrome-for-testing-public/122.0.6261.57/linux64/chromedriver-linux64.zip.

Keep in mind that this last url is just an example and it might change (as it has happened in the past).

```shell
npm install chromedriver --chromedriver_cdnurl=https://npmmirror.com/metadata --chromedriver_cdnbinariesurl=https://npmmirror.com/binaries
```

Or add these properties to your [`.npmrc`](https://docs.npmjs.com/cli/configuring-npm/npmrc) file:

```ini
chromedriver_cdnurl=https://npmmirror.com/metadata
chromedriver_cdnbinariesurl=https://npmmirror.com/binaries
```

Another option is to use the environment variables `CHROMEDRIVER_CDNURL` and `CHROMEDRIVER_CDNBINARIESURL`.

```shell
CHROMEDRIVER_CDNURL=https://npmmirror.com/metadata CHROMEDRIVER_CDNBINARIESURL=https://npmmirror.com/binaries npm install chromedriver
```

### For versions < 115

There is one url to both metadata and binaries.

To use a mirror of the ChromeDriver binaries use npm config property `chromedriver_legacy_cdnurl`.
Default is `https://chromedriver.storage.googleapis.com`.

```shell
npm install chromedriver --chromedriver_legacy_cdnurl=https://npmmirror.com/mirrors/chromedriver --chromedriver_version=LATEST_114
```

Or add a property to your [`.npmrc`](https://docs.npmjs.com/files/npmrc) file:

```ini
chromedriver_legacy_cdnurl=https://npmmirror.com/mirrors/chromedriver
```

Another option is to use the environment variable `CHROMEDRIVER_LEGACY_CDNURL`.

```shell
CHROMEDRIVER_LEGACY_CDNURL=https://npmmirror.com/mirrors/chromedriver npm install chromedriver --chromedriver_version=LATEST_114
```

## Custom binaries file

To get the chromedriver from the filesystem instead of a web request use the npm config property `chromedriver_filepath`.

```shell
npm install chromedriver --chromedriver_filepath=/path/to/chromedriver_mac64.zip
```

Or add property to your [`.npmrc`](https://docs.npmjs.com/files/npmrc) file.

```ini
chromedriver_filepath=/path/to/chromedriver_mac64.zip
```

Another option is to use the PATH variable `CHROMEDRIVER_FILEPATH`

```shell
CHROMEDRIVER_FILEPATH=/path/to/chromedriver_mac64.zip
```

This variable can be used to set either a `.zip` file or the binary itself, eg:

```shell
CHROMEDRIVER_FILEPATH=/bin/chromedriver
```

## Custom download options

Install through a proxy.

```shell
npm config set proxy http://[user:pwd]@domain.tld:port
npm config set https-proxy http://[user:pwd]@domain.tld:port
```

Use different User-Agent.

```shell
npm config set user-agent "Mozilla/5.0 (X11; Linux x86_64; rv:52.0) Gecko/20100101 Firefox/52.0"
```

## Skipping chromedriver download

You may wish to skip the downloading of the chromedriver binary file, for example if you know for certain that it is already there or if you want to use a system binary and just use this module as an interface to interact with it.

To achieve this you can use the npm config property `chromedriver_skip_download`.

```shell
npm install chromedriver --chromedriver_skip_download=true
```

Or add property to your [`.npmrc`](https://docs.npmjs.com/files/npmrc) file.

```ini
chromedriver_skip_download=true
```

Another option is to use the PATH variable `CHROMEDRIVER_SKIP_DOWNLOAD`

```shell
CHROMEDRIVER_SKIP_DOWNLOAD=true
```

## Running

```shell
bin/chromedriver [arguments]
```

And npm will install a link to the binary in `node_modules/.bin` as
it is wont to do.

## Running with Selenium WebDriver

```javascript
require('chromedriver');
var webdriver = require('selenium-webdriver');
var driver = new webdriver.Builder()
  .forBrowser('chrome')
  .build();
```

(Tested for selenium-webdriver version `2.48.2`)

The path will be added to the process automatically, you don't need to configure it.
But you can get it from `require('chromedriver').path` if you want it.

## Running via node

The package exports a `path` string that contains the path to the
chromedriver binary/executable.

Below is an example of using this package via node.

```javascript
var childProcess = require('child_process');
var chromedriver = require('chromedriver');
var binPath = chromedriver.path;

var childArgs = [
  'some argument'
];

childProcess.execFile(binPath, childArgs, function(err, stdout, stderr) {
  // handle results
});

```

You can also use the start and stop methods:

```javascript
var chromedriver = require('chromedriver');

args = [
 // optional arguments
];
chromedriver.start(args);
// run your tests
chromedriver.stop();

```

With the latest version, you can optionally receive a Promise from the `chromedriver.start` function:

```javascript
var returnPromise = true;
chromedriver
  .start(args, returnPromise)
  .then(() => {
    console.log('chromedriver is ready');
  });
```

Note: if your tests are ran asynchronously, chromedriver.stop() will have to be
executed as a callback at the end of your tests

## Versioning

The NPM package version tracks the version of chromedriver that will be installed,
with an additional build number that is used for revisions to the installer.
You can use the package version number to install a specific version, or use the
setting to a specific version. If there is a new Chromedriver version available which is not yet available as a version of `node-chromedriver`, the npm command `npm run update-chromedriver` in this repository can be used to make the required updates to this module, please submit the change as a PR. To always install the latest version of Chromedriver,
use `LATEST` as the version number:

```shell
npm install chromedriver --chromedriver_version=LATEST
```

Or add property to your [`.npmrc`](https://docs.npmjs.com/files/npmrc) file.

```ini
chromedriver_version=LATEST
```

Another option is to use env variable `CHROMEDRIVER_VERSION`.

```shell
CHROMEDRIVER_VERSION=LATEST npm install chromedriver
```

You can force the latest release for a specific major version by specifying `LATEST_{VERSION_NUMBER}`:

```shell
CHROMEDRIVER_VERSION=LATEST_80 npm install chromedriver
```

You can also force a different version of chromedriver by replacing `LATEST` with a version number:

```shell
CHROMEDRIVER_VERSION=75.0.3770.140 npm install chromedriver
```

## Detect ChromeDriver Version

The NPM package version may not be always compatible to your Chrome version.
To get the chromedriver that corresponds to the version of Chrome installed,
you can use the npm config property `detect_chromedriver_version`.

```shell
npm install chromedriver --detect_chromedriver_version
```

Or add property to your [`.npmrc`](https://docs.npmjs.com/files/npmrc) file.

```ini
detect_chromedriver_version=true
```

Another option is to use environment variable `DETECT_CHROMEDRIVER_VERSION`.

```shell
DETECT_CHROMEDRIVER_VERSION=true npm install chromedriver
```

**Note:** When the property `detect_chromedriver_version` is provided,
`chromedriver_version` and `chromedriver_filepath` properties are ignored.

## Include Chromium

If you don't have Chrome installed, you can check for Chromium version instead by setting the argument `include_chromium` to `true`.

```shell
npm install chromedriver --include_chromium
```

Or add property to your [`.npmrc`](https://docs.npmjs.com/files/npmrc) file.

```ini
include_chromium=true
```

Another option is to use environment variable `INCLUDE_CHROMIUM`.

```shell
INCLUDE_CHROMIUM=true npm install chromedriver
```

**Note:** The property `INCLUDE_CHROMIUM` is ignored if the property `DETECT_CHROMEDRIVER_VERSION` is not used.

## A Note on chromedriver

Chromedriver is not a library for NodeJS.

This is an _NPM wrapper_ and can be used to conveniently make ChromeDriver available.
It is not a Node.js wrapper.

## Supported Node.js versions

We will do our best to support every supported Node.js versions.
See [nodejs/Release](https://github.com/nodejs/Release) for
the current supported versions. You can also view our
[build scripts](https://github.com/giggio/node-chromedriver/blob/main/.github/workflows/build.yml#L41) and check the versions there.

## Contributing

Questions, comments, bug reports, and pull requests are all welcome.  Submit them at
[the project on GitHub](https://github.com/giggio/node-chromedriver/).

Bug reports that include steps-to-reproduce (including code) are the
best. Even better, make them in the form of pull requests.

We have added
[VS Code Remote support with containers](https://code.visualstudio.com/docs/remote/containers).
If you are on Windows, set `git config core.autocrlf input` so you don't get git errors.

## Author

[Giovanni Bassi](https://github.com/giggio), with collaboration from
[lots of good people](https://github.com/giggio/node-chromedriver/graphs/contributors).

Thanks for Obvious and their PhantomJS project for heavy inspiration! Check their project on [Github](https://github.com/Obvious/phantomjs/).

## License

Licensed under the Apache License, Version 2.0.
