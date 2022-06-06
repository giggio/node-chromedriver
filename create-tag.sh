#!/usr/bin/env bash

git pull origin main
VERSION=`jq -r .version package.json`
git log -n 1
git tag -s $VERSION -m $VERSION
git tag -v $VERSION
git push origin --tags
