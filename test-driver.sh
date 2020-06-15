#!/usr/bin/env bash

set -xeuo pipefail

# Start ChromeDriver and make it non-blocking
./bin/chromedriver &

TASK_PID=$!

# Wait for a few seconds to give the ChromeDriver a chance to fail if there is an issue.
sleep 5

if [ "`(ps -p $TASK_PID || echo '') | tail -1`" == "" ]; then
  TASK_RUNNING=false
else
  TASK_RUNNING=true
fi

if ! $TASK_RUNNING; then
  exit 1
fi

kill $TASK_PID || true
