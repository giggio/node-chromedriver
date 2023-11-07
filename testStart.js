#!/usr/bin/env node

"use strict";
const chromedriver = require('./lib/chromedriver');

async function run() {
  console.log(`Starting chromedriver. Instance: ${JSON.stringify(chromedriver)}`);
  await chromedriver.start(null, true);
  console.log(`Started Chromedriver. Instance is null: ${chromedriver.defaultInstance === null}.`);
  chromedriver.stop();
  console.log(`Stopped Chromedriver. Instance is null: ${chromedriver.defaultInstance === null}.`);
}

run();
