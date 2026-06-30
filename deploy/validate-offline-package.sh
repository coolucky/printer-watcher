#!/bin/bash

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <offline-package-dir> [zip-file]"
  exit 1
fi

PACKAGE_DIR="$1"
ZIP_FILE="${2:-}"
REPORT_FILE="$PACKAGE_DIR/OFFLINE-PACKAGE-VALIDATION.txt"

fail() {
  echo "[FAIL] $1"
  exit 1
}

pass() {
  echo "[PASS] $1"
}

assert_file() {
  local f="$1"
  [ -f "$f" ] || fail "Missing file: $f"
  pass "File exists: $f"
}

assert_dir() {
  local d="$1"
  [ -d "$d" ] || fail "Missing dir: $d"
  pass "Dir exists: $d"
}

assert_contains() {
  local f="$1"
  local pattern="$2"
  grep -q "$pattern" "$f" || fail "Expected pattern '$pattern' in $f"
  pass "Pattern '$pattern' found in $f"
}

{
  echo "Printer Status Report Offline Package Validation"
  echo "Generated at: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "Package: $PACKAGE_DIR"
  echo

  assert_dir "$PACKAGE_DIR"
  assert_dir "$PACKAGE_DIR/dist"
  assert_file "$PACKAGE_DIR/dist/index.html"
  assert_dir "$PACKAGE_DIR/dist/asset-inventory"
  assert_file "$PACKAGE_DIR/dist/asset-inventory/scripts/lib/exceljs.min.js"

  assert_dir "$PACKAGE_DIR/backend"
  assert_file "$PACKAGE_DIR/backend/server.js"
  assert_dir "$PACKAGE_DIR/backend/node_modules"

  assert_file "$PACKAGE_DIR/frontend-server.js"
  assert_file "$PACKAGE_DIR/install-service.bat"
  assert_file "$PACKAGE_DIR/start-service.bat"
  assert_file "$PACKAGE_DIR/nssm.exe"

  assert_file "$PACKAGE_DIR/DEPLOY-README.md"
  assert_file "$PACKAGE_DIR/DESKTOP-SUPPORT-RUNBOOK.md"
  assert_file "$PACKAGE_DIR/BACKUP-DRILL-RUNBOOK.md"

  assert_contains "$PACKAGE_DIR/frontend-server.js" "9191"
  assert_contains "$PACKAGE_DIR/frontend-server.js" "3001"

  # Validate install-service.bat has correct NSSM service persistence config
  assert_contains "$PACKAGE_DIR/install-service.bat" "SERVICE_AUTO_START"
  assert_contains "$PACKAGE_DIR/install-service.bat" "ObjectName LocalSystem"
  assert_contains "$PACKAGE_DIR/install-service.bat" "nssm.exe"
  # Verify nodejs paths are not corrupted (no line break between nodejs\ and node.exe)
  if grep -P 'nodejs\r?\n' "$PACKAGE_DIR/install-service.bat" >/dev/null 2>&1; then
    fail "install-service.bat has corrupted nodejs path (backslash split across lines)"
  fi
  pass "install-service.bat NSSM persistence config verified (SERVICE_AUTO_START + LocalSystem)"

  # Validate uninstall-service.bat kills nssm.exe process to release file lock
  assert_file "$PACKAGE_DIR/uninstall-service.bat"
  assert_contains "$PACKAGE_DIR/uninstall-service.bat" "taskkill /F /IM nssm.exe"
  pass "uninstall-service.bat has taskkill for nssm.exe (prevents file lock issue)"

  if [ -n "$ZIP_FILE" ]; then
    assert_file "$ZIP_FILE"
    if command -v unzip >/dev/null 2>&1; then
      ZIP_LIST_FILE="$(mktemp)"
      unzip -l "$ZIP_FILE" > "$ZIP_LIST_FILE"
      grep -q "offline-package/install-service.bat" "$ZIP_LIST_FILE" || fail "Zip missing install-service.bat"
      grep -q "offline-package/dist/asset-inventory/scripts/lib/exceljs.min.js" "$ZIP_LIST_FILE" || fail "Zip missing local exceljs"
      rm -f "$ZIP_LIST_FILE"
      pass "Zip content checks passed"
    else
      echo "[WARN] unzip not available, zip content checks skipped"
    fi
  fi

  echo
  echo "Result: PASS"
} | tee "$REPORT_FILE"
