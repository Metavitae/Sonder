#!/usr/bin/env bash
# Signs a CI-built release APK with Sonder's own release key.
# Founder/Faro, 2026-10-01: the key never goes to GitHub, so CI keeps
# building with the debug key and this re-signs the APK here, where the key
# lives (~/.sonder-release, outside the repo). Losing that key means Sonder
# can never be updated on phones that installed a build signed with it.
#   usage: scripts/sign-release.sh app-release.apk [out.apk]
set -euo pipefail
in="$1"
out="${2:-${in%.apk}-signed.apk}"
key_dir="${SONDER_KEY_DIR:-$HOME/.sonder-release}"
bt="$(ls -d "$HOME"/Android/Sdk/build-tools/* | sort -V | tail -1)"

aligned="$(mktemp --suffix=.apk)"
trap 'rm -f "$aligned"' EXIT
"$bt/zipalign" -p -f 4 "$in" "$aligned"
"$bt/apksigner" sign \
  --ks "$key_dir/sonder-release.p12" --ks-key-alias sonder \
  --ks-pass "file:$key_dir/password.txt" \
  --out "$out" "$aligned"
"$bt/apksigner" verify --print-certs "$out" | grep -E "Signer #|certificate DN|SHA-256"
echo "signed: $out"
