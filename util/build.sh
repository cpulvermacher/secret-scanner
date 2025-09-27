#!/usr/bin/env bash
set -eu

MODE=$1

if [ "$MODE" != "production" ] && [ "$MODE" != "dev" ]; then
  echo "Usage: $0 production|dev"
  exit 1
fi

ROOT=$(dirname -- "$0")/..
APP_NAME="secret-scanner"
VERSION=$(git describe --tags --abbrev=0 | sed '')
LONG_VERSION=$(git describe --tags | sed 's/^v//')
if [ "$MODE" = "dev" ]; then
  LONG_VERSION="$LONG_VERSION-dev"
  # embed version in development build
  export VITE_VERSION="$LONG_VERSION"
fi

cd "$ROOT"

rm -rf dist

################## Chrome build ###################

mkdir -p dist/chrome
vite build -m "${MODE}"

# copy extra assets
# mkdir dist/chrome/images/
# cp -a images/icon*.png dist/chrome/images/
# cp -a src/_locales dist/chrome/_locales

cat src/manifest.json |
  sed "s/__VERSION_NAME__/$LONG_VERSION/g" |
  sed "s/__VERSION__/$VERSION/g" \
    >dist/chrome/manifest.json

create_zip() {
  ZIP_PATH="$1"
  TARGET_DIR="$2"

  rm -f "$ZIP_PATH"
  cd "$TARGET_DIR"
  zip -r "$ZIP_PATH" ./*
  cd -

  echo ""
  echo "Created zip file: $ZIP_PATH"
}

if [ "$MODE" = "production" ]; then
  create_zip "$PWD/$APP_NAME-$LONG_VERSION-chrome.zip" dist/chrome
  create_zip "$PWD/$APP_NAME-$LONG_VERSION-firefox.zip" dist/firefox

  # create a source code bundle by cloning the repo and zipping it
  TMP_DIR=$(mktemp -d)
  git clone . "$TMP_DIR/$APP_NAME-$LONG_VERSION"
  create_zip "$PWD/$APP_NAME-$LONG_VERSION-src.zip" "$TMP_DIR/$APP_NAME-$LONG_VERSION"
  rm -rf "$TMP_DIR"
fi

echo "========================================"
echo "current version is $VERSION (version_name: $LONG_VERSION)."
if [ "$MODE" = "production" ] && [ "$VERSION" != "$LONG_VERSION" ]; then
  echo "WARNING: For a production build, you probably want to set a new git tag."
fi
echo "========================================"
