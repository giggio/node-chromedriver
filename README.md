ChromeDriver
=======

An NPM wrapper for Selenium [ChromeDriver](https://sites.google.com/a/chromium.org/chromedriver/).

Building and Installing
-----------------------

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
Linux based platforms (as identified by nodejs), and Windows.  If you
spot any platform weirdnesses, let us know or send a patch.

### Custom binaries url

To use a mirror of the ChromeDriver binaries use npm config property `chromedriver_cdnurl`.
Default is `http://chromedriver.storage.googleapis.com`.

```shell
npm install chromedriver --chromedriver_cdnurl=http://npm.taobao.org/mirrors/chromedriver
```

Or add property into your [`.npmrc`](https://docs.npmjs.com/files/npmrc) file.

```
chromedriver_cdnurl=http://npm.taobao.org/mirrors/chromedriver
```

Another option is to use PATH variable `CHROMEDRIVER_CDNURL`.

```shell
CHROMEDRIVER_CDNURL=http://npm.taobao.org/mirrors/chromedriver npm install chromedriver
```

Running
-------

```shell
bin/chromedriver [arguments]
```

And npm will install a link to the binary in `node_modules/.bin` as
it is wont to do.

Running via node
----------------

The package exports a `path` string that contains the path to the
chromdriver binary/executable.

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

chromedriver.start();
//run your tests
chromedriver.stop();

```

Versioning
----------

The NPM package version tracks the version of chromedriver that will be installed,
with an additional build number that is used for revisions to the installer.

A Note on chromedriver
-------------------

Chromedriver is not a library for NodeJS.

This is an _NPM wrapper_ and can be used to conveniently make ChromeDriver available
It is not a Node JS wrapper.

Contributing
------------

Questions, comments, bug reports, and pull requests are all welcome.  Submit them at
[the project on GitHub](https://github.com/giggio/node-chromedriver/).

Bug reports that include steps-to-reproduce (including code) are the
best. Even better, make them in the form of pull requests.

Author
------

[Giovanni Bassi](https://github.com/giggio)

Thanks for Obvious and their PhantomJS project for heavy inspiration! Check their project on [Github](https://github.com/Obvious/phantomjs/tree/master/bin).

License
-------

Licensed under the Apache License, Version 2.0.
