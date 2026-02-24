#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_PATH="$ROOT_DIR/Crunchy Watchlist Curator/Crunchy Watchlist Curator.xcodeproj"
SCHEME_NAME="Crunchy Watchlist Curator (macOS)"
DERIVED_DATA_DIR="$ROOT_DIR/.tmp/DerivedData"
OUTPUT_DIR="$ROOT_DIR/dist/safari"
EXTENSION_SOURCE_DIR="${EXTENSION_SOURCE_DIR:-extension}"
APP_NAME="Crunchy Watchlist Curator.app"
APP_PATH="$DERIVED_DATA_DIR/Build/Products/Release/$APP_NAME"
APP_ZIP_PATH="$OUTPUT_DIR/crunchy-watchlist-curator-safari-macos-app.zip"
SOURCE_ZIP_PATH="$OUTPUT_DIR/crunchy-watchlist-curator-safari-webextension-source.zip"
EXTENSION_SOURCE_PATH="$ROOT_DIR/$EXTENSION_SOURCE_DIR"
SAFARI_BUILD_ARCH="${SAFARI_BUILD_ARCH:-$(uname -m)}"
XCODE_DESTINATION="platform=macOS"

if [[ "$SAFARI_BUILD_ARCH" == "arm64" || "$SAFARI_BUILD_ARCH" == "x86_64" ]]; then
  XCODE_DESTINATION="platform=macOS,arch=$SAFARI_BUILD_ARCH"
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild is required to build Safari artifacts."
  exit 1
fi

rm -rf "$DERIVED_DATA_DIR"
mkdir -p "$OUTPUT_DIR"

xcodebuild \
  -project "$PROJECT_PATH" \
  -scheme "$SCHEME_NAME" \
  -configuration Release \
  -destination "$XCODE_DESTINATION" \
  -derivedDataPath "$DERIVED_DATA_DIR" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  build

if [[ ! -d "$APP_PATH" ]]; then
  echo "Expected build output not found: $APP_PATH"
  exit 1
fi

if [[ ! -d "$EXTENSION_SOURCE_PATH" ]]; then
  echo "Expected extension source directory not found: $EXTENSION_SOURCE_PATH"
  exit 1
fi

rm -f "$APP_ZIP_PATH" "$SOURCE_ZIP_PATH"
/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$APP_ZIP_PATH"
(cd "$EXTENSION_SOURCE_PATH" && zip -qrX "$SOURCE_ZIP_PATH" .)

echo "Built Safari artifacts:"
echo "- $APP_ZIP_PATH"
echo "- $SOURCE_ZIP_PATH"
