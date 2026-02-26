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

  app_executable_path="$APP_PATH/Contents/MacOS/Crunchy Watchlist Curator"
  extension_bundle_path="$APP_PATH/Contents/PlugIns/Crunchy Watchlist Curator Extension.appex"
  extension_executable_path="$extension_bundle_path/Contents/MacOS/Crunchy Watchlist Curator Extension"
  resign_tmp_dir="$(mktemp -d)"

  cleanup_resign_tmp_dir() {
    rm -rf "$resign_tmp_dir"
  }

  extract_sanitized_entitlements() {
    local code_path="$1"
    local entitlements_out="$2"
    if ! /usr/bin/codesign -d --entitlements :- "$code_path" >"$entitlements_out" 2>/dev/null; then
      return 1
    fi
    if [[ ! -s "$entitlements_out" ]]; then
      return 1
    fi

    # get-task-allow must never be present in notarized distribution signatures.
    /usr/libexec/PlistBuddy -c "Delete :com.apple.security.get-task-allow" "$entitlements_out" >/dev/null 2>&1 || true
    return 0
  }

  sign_with_timestamp() {
    local code_path="$1"
    local runtime_mode="$2"
    local entitlements_path="$resign_tmp_dir/$(basename "$code_path").entitlements.plist"
    local sign_args=(
      --force
      --sign "$SAFARI_CODE_SIGN_IDENTITY"
      --timestamp
    )
    if [[ -n "$SAFARI_KEYCHAIN_PATH" ]]; then
      sign_args+=(--keychain "$SAFARI_KEYCHAIN_PATH")
    fi
    if [[ "$runtime_mode" == "runtime" ]]; then
      sign_args+=(--options runtime)
    fi
    if extract_sanitized_entitlements "$code_path" "$entitlements_path"; then
      sign_args+=(--entitlements "$entitlements_path")
    fi

    /usr/bin/codesign "${sign_args[@]}" "$code_path"
  }

  assert_secure_timestamp() {
    local code_path="$1"
    local signature_details
    signature_details="$(/usr/bin/codesign -d --verbose=4 "$code_path" 2>&1 || true)"
    if printf '%s\n' "$signature_details" | grep -q "Timestamp=none"; then
      echo "Signature timestamp is missing for: $code_path"
      return 1
    fi
    if ! printf '%s\n' "$signature_details" | grep -q "Timestamp="; then
      echo "Unable to read signature timestamp for: $code_path"
      return 1
    fi
    return 0
  }

  # Re-sign nested binaries/bundles to ensure secure timestamps and sanitized entitlements.
  if [[ -d "$APP_PATH/Contents/Frameworks" ]]; then
    while IFS= read -r -d '' framework_binary; do
      sign_with_timestamp "$framework_binary" "none"
    done < <(find "$APP_PATH/Contents/Frameworks" -type f \( -name "*.dylib" -o -name "*.so" \) -print0)
  fi

  if [[ -d "$extension_bundle_path/Contents/Frameworks" ]]; then
    while IFS= read -r -d '' framework_binary; do
      sign_with_timestamp "$framework_binary" "none"
    done < <(find "$extension_bundle_path/Contents/Frameworks" -type f \( -name "*.dylib" -o -name "*.so" \) -print0)
  fi

  if [[ -f "$extension_executable_path" ]]; then
    sign_with_timestamp "$extension_executable_path" "none"
  fi
  if [[ -d "$extension_bundle_path" ]]; then
    sign_with_timestamp "$extension_bundle_path" "none"
  fi
  if [[ -f "$app_executable_path" ]]; then
    sign_with_timestamp "$app_executable_path" "none"
  fi
  sign_with_timestamp "$APP_PATH" "runtime"

  /usr/bin/codesign --verify --deep --strict --verbose=2 "$APP_PATH"
  assert_secure_timestamp "$app_executable_path"
  if [[ -f "$extension_executable_path" ]]; then
    assert_secure_timestamp "$extension_executable_path"
  fi

  notarize_zip_path="$OUTPUT_DIR/crunchy-watchlist-curator-safari-macos-notary-upload.zip"
  rm -f "$notarize_zip_path"
  /usr/bin/ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$notarize_zip_path"

  notary_submit_json="$(
    xcrun notarytool submit "$notarize_zip_path" \
      --key "$SAFARI_NOTARY_KEY_PATH" \
      --key-id "$SAFARI_NOTARY_KEY_ID" \
      --issuer "$SAFARI_NOTARY_ISSUER_ID" \
      --wait \
      --output-format json
  )"
  printf '%s\n' "$notary_submit_json"

  notary_submission_id="$(printf '%s\n' "$notary_submit_json" | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
  notary_status="$(printf '%s\n' "$notary_submit_json" | sed -n 's/.*"status"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
  if [[ "$notary_status" != "Accepted" ]]; then
    echo "Notary submission status is '$notary_status' (expected 'Accepted')."
    if [[ -n "$notary_submission_id" ]]; then
      xcrun notarytool log "$notary_submission_id" \
        --key "$SAFARI_NOTARY_KEY_PATH" \
        --key-id "$SAFARI_NOTARY_KEY_ID" \
        --issuer "$SAFARI_NOTARY_ISSUER_ID" || true
    fi
    exit 1
  fi

  xcrun stapler staple "$APP_PATH"
  xcrun stapler validate "$APP_PATH"

  cleanup_resign_tmp_dir
  rm -f "$notarize_zip_path"
fi

/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$APP_ZIP_PATH"
(cd "$EXTENSION_SOURCE_PATH" && zip -qrX "$SOURCE_ZIP_PATH" .)

echo "Built Safari artifacts:"
echo "- $APP_ZIP_PATH"
echo "- $SOURCE_ZIP_PATH"
