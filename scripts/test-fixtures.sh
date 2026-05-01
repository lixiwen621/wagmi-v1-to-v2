#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW_FILE="$ROOT_DIR/workflow.yaml"
CODEMOD_VERSION="${CODEMOD_VERSION:-1.8.2}"

FIXTURES=(
  "switch_network_destructuring"
  "hook_renames"
  "connector_renames"
  "component_renames"
  "import_renames"
  "config_renames"
  "removed_hooks"
  "api_changes"
  "removed_hooks_default_import"
  "use_account_effect"
  "use_network_chains"
  "removed_properties"
  "config_api_changes"
  "removed_hooks_signer_provider"
  "use_contract_infinite_reads"
)

if [[ ! -f "$WORKFLOW_FILE" ]]; then
  echo "ERROR: workflow file not found: $WORKFLOW_FILE"
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "ERROR: npx is required to run this script."
  exit 1
fi

CODEMOD_CMD=(npx "codemod@${CODEMOD_VERSION}")

echo "Running fixture regression for ${#FIXTURES[@]} directories..."
echo

failed=0
keep_tmp="${KEEP_TMP:-0}"

for fixture in "${FIXTURES[@]}"; do
  fixture_root="$ROOT_DIR/tests/$fixture"
  input_dir="$fixture_root/input"
  expected_dir="$fixture_root/expected"

  if [[ ! -d "$input_dir" || ! -d "$expected_dir" ]]; then
    echo "ERROR: missing fixture directories for '$fixture'"
    echo "  input: $input_dir"
    echo "  expected: $expected_dir"
    failed=1
    continue
  fi

  tmp_dir="$(mktemp -d)"
  work_input="$tmp_dir/input"
  mkdir -p "$work_input"
  cp -R "$input_dir/." "$work_input"

  echo "==> [$fixture] apply codemod"
  if ! "${CODEMOD_CMD[@]}" workflow run -w "$WORKFLOW_FILE" -t "$work_input" --allow-dirty --no-interactive >/dev/null; then
    echo "FAIL [$fixture] codemod execution failed"
    failed=1
    if [[ "$keep_tmp" != "1" ]]; then
      rm -rf "$tmp_dir"
    else
      echo "   temp kept at: $tmp_dir"
    fi
    continue
  fi

  echo "==> [$fixture] compare with expected"
  if ! diff -ru "$expected_dir" "$work_input"; then
    echo "FAIL [$fixture] mismatch detected"
    failed=1
    if [[ "$keep_tmp" != "1" ]]; then
      rm -rf "$tmp_dir"
    else
      echo "   temp kept at: $tmp_dir"
    fi
    continue
  fi

  echo "PASS [$fixture] pass"
  echo

  if [[ "$keep_tmp" != "1" ]]; then
    rm -rf "$tmp_dir"
  fi
done

if [[ "$failed" -ne 0 ]]; then
  echo "Fixture regression failed."
  exit 1
fi

echo "All fixture regressions passed."
