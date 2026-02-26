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
SAFARI_SIGNED_BUILD="${SAFARI_SIGNED_BUILD:-0}"
SAFARI_DEVELOPMENT_TEAM="${SAFARI_DEVELOPMENT_TEAM:-}"
SAFARI_CODE_SIGN_IDENTITY="${SAFARI_CODE_SIGN_IDENTITY:-Developer ID Application}"
SAFARI_KEYCHAIN_PATH="${SAFARI_KEYCHAIN_PATH:-}"
SAFARI_NOTARIZE="${SAFARI_NOTARIZE:-0}"
SAFARI_NOTARY_KEY_PATH="${SAFARI_NOTARY_KEY_PATH:-}"
SAFARI_NOTARY_KEY_ID="${SAFARI_NOTARY_KEY_ID:-}"
SAFARI_NOTARY_ISSUER_ID="${SAFARI_NOTARY_ISSUER_ID:-}"
XCODE_DESTINATION="platform=macOS"

if [[ "$SAFARI_BUILD_ARCH" == "arm64" || "$SAFARI_BUILD_ARCH" == "x86_64" ]]; then
  XCODE_DESTINATION="platform=macOS,arch=$SAFARI_BUILD_ARCH"
fi

identity_team_from_name="$(printf '%s\n' "$SAFARI_CODE_SIGN_IDENTITY" | sed -n 's/.*(\([A-Z0-9]\{10\}\)).*/\1/p')"
if [[ -n "$identity_team_from_name" ]]; then
  if [[ -n "$SAFARI_DEVELOPMENT_TEAM" && "$SAFARI_DEVELOPMENT_TEAM" != "$identity_team_from_name" ]]; then
    echo "SAFARI_DEVELOPMENT_TEAM ($SAFARI_DEVELOPMENT_TEAM) does not match certificate team ($identity_team_from_name); using certificate team."
  fi
  SAFARI_DEVELOPMENT_TEAM="$identity_team_from_name"
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild is required to build Safari artifacts."
  exit 1
fi

rm -rf "$DERIVED_DATA_DIR"
mkdir -p "$OUTPUT_DIR"

xcodebuild_args=(
  -project "$PROJECT_PATH"
  -scheme "$SCHEME_NAME"
  -configuration Release
  -destination "$XCODE_DESTINATION"
  -derivedDataPath "$DERIVED_DATA_DIR"
)

if [[ "$SAFARI_SIGNED_BUILD" == "1" ]]; then
  if [[ -z "$SAFARI_DEVELOPMENT_TEAM" ]]; then
    echo "SAFARI_DEVELOPMENT_TEAM is required when SAFARI_SIGNED_BUILD=1."
    exit 1
  fi

  xcodebuild_args+=(
    DEVELOPMENT_TEAM="$SAFARI_DEVELOPMENT_TEAM"
    CODE_SIGN_STYLE=Manual
    CODE_SIGN_IDENTITY="$SAFARI_CODE_SIGN_IDENTITY"
  )

  if [[ -n "$SAFARI_KEYCHAIN_PATH" ]]; then
    xcodebuild_args+=(
      OTHER_CODE_SIGN_FLAGS="--keychain $SAFARI_KEYCHAIN_PATH"
    )
  fi
else
  xcodebuild_args+=(
    CODE_SIGNING_ALLOWED=NO
    CODE_SIGNING_REQUIRED=NO
  )
fi

xcodebuild "${xcodebuild_args[@]}" build

if [[ ! -d "$APP_PATH" ]]; then
  echo "Expected build output not found: $APP_PATH"
  exit 1
fi

if [[ ! -d "$EXTENSION_SOURCE_PATH" ]]; then
  echo "Expected extension source directory not found: $EXTENSION_SOURCE_PATH"
  exit 1
fi

rm -f "$APP_ZIP_PATH" "$SOURCE_ZIP_PATH"

if [[ "$SAFARI_SIGNED_BUILD" == "1" ]]; then
  codesign --verify --deep --strict --verbose=2 "$APP_PATH"
fi

if [[ "$SAFARI_NOTARIZE" == "1" ]]; then
  if [[ -z "$SAFARI_NOTARY_KEY_PATH" || -z "$SAFARI_NOTARY_KEY_ID" || -z "$SAFARI_NOTARY_ISSUER_ID" ]]; then
    echo "SAFARI_NOTARY_KEY_PATH, SAFARI_NOTARY_KEY_ID, and SAFARI_NOTARY_ISSUER_ID are required when SAFARI_NOTARIZE=1."
    exit 1
  fi

  if [[ ! -f "$SAFARI_NOTARY_KEY_PATH" ]]; then
    echo "Notary API key file not found: $SAFARI_NOTARY_KEY_PATH"
    exit 1
  fi

  notarize_zip_path="$OUTPUT_DIR/crunchy-watchlist-curator-safari-macos-notary-upload.zip"
  rm -f "$notarize_zip_path"
  /usr/bin/ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$notarize_zip_path"

  xcrun notarytool submit "$notarize_zip_path" \
    --key "$SAFARI_NOTARY_KEY_PATH" \
    --key-id "$SAFARI_NOTARY_KEY_ID" \
    --issuer "$SAFARI_NOTARY_ISSUER_ID" \
    --wait

  xcrun stapler staple "$APP_PATH"
  xcrun stapler validate "$APP_PATH"

  rm -f "$notarize_zip_path"
fi

/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$APP_ZIP_PATH"
(cd "$EXTENSION_SOURCE_PATH" && zip -qrX "$SOURCE_ZIP_PATH" .)

echo "Built Safari artifacts:"
echo "- $APP_ZIP_PATH"
echo "- $SOURCE_ZIP_PATH"
