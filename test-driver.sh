#!/usr/bin/env bash

set -xeuo pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BIN="$DIR/lib/chromedriver/chromedriver"
if ! [ -e $BIN ]; then
  echo "Binary not found at $BIN"
  exit 1
fi
# Start ChromeDriver and make it non-blocking
$DIR/bin/chromedriver &

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
