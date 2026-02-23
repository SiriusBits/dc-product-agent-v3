#!/usr/bin/env bash
# generate_feature.sh — Scaffold a feature directory with trd.md, implementation-strategy.md, progress.md
#
# Usage:
#   bash generate_feature.sh --name "feature-name" [options]
#
# Options:
#   --name NAME          Feature name (required). Will be lowercased and hyphenated.
#   --milestone TEXT      Milestone identifier and name (e.g., "M1 — Neo4j Foundation")
#   --requirements TEXT   Feature requirements description
#   --acceptance TEXT     Comma-separated acceptance criteria
#   --dependencies TEXT   Comma-separated dependencies
#   --subtasks TEXT       Comma-separated subtasks for progress.md
#   --db-changes TEXT     Database changes description
#   --api-changes TEXT    API modifications description
#   --testing TEXT        Testing approach description
#   --base-dir DIR       Base directory (default: features)
#   --force              Overwrite existing files
#   --dry-run            Print what would be created without writing

set -euo pipefail

# Defaults
BASE_DIR=".ag/planning/features"
MILESTONE=""
REQUIREMENTS=""
ACCEPTANCE=""
DEPENDENCIES=""
SUBTASKS=""
DB_CHANGES="None."
API_CHANGES="None."
TESTING=""
FORCE=false
DRY_RUN=false
NAME=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --name)        NAME="$2"; shift 2 ;;
    --milestone)   MILESTONE="$2"; shift 2 ;;
    --requirements) REQUIREMENTS="$2"; shift 2 ;;
    --acceptance)  ACCEPTANCE="$2"; shift 2 ;;
    --dependencies) DEPENDENCIES="$2"; shift 2 ;;
    --subtasks)    SUBTASKS="$2"; shift 2 ;;
    --db-changes)  DB_CHANGES="$2"; shift 2 ;;
    --api-changes) API_CHANGES="$2"; shift 2 ;;
    --testing)     TESTING="$2"; shift 2 ;;
    --base-dir)    BASE_DIR="$2"; shift 2 ;;
    --force)       FORCE=true; shift ;;
    --dry-run)     DRY_RUN=true; shift ;;
    *)             echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$NAME" ]]; then
  echo "Error: --name is required"
  echo "Usage: bash generate_feature.sh --name \"feature-name\" [options]"
  exit 1
fi

# Normalize name: lowercase, replace spaces with hyphens
FEATURE_NAME=$(echo "$NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -s '-')
FEATURE_DIR="$BASE_DIR/$FEATURE_NAME"

# Check for existing directory
if [[ -d "$FEATURE_DIR" ]] && [[ "$FORCE" == false ]]; then
  echo "Error: Directory '$FEATURE_DIR' already exists. Use --force to overwrite."
  exit 1
fi

# Dry run mode
if [[ "$DRY_RUN" == true ]]; then
  echo "Would create:"
  echo "  $FEATURE_DIR/trd.md"
  echo "  $FEATURE_DIR/implementation-strategy.md"
  echo "  $FEATURE_DIR/progress.md"
  exit 0
fi

# Create directory
mkdir -p "$FEATURE_DIR"

# --- trd.md ---
{
  echo "# Feature: $FEATURE_NAME"
  echo ""
  if [[ -n "$MILESTONE" ]]; then
    echo "## Milestone"
    echo "$MILESTONE"
    echo ""
  fi
  echo "## Requirements"
  if [[ -n "$REQUIREMENTS" ]]; then
    echo "$REQUIREMENTS"
  else
    echo "<!-- TODO: Describe what this feature must accomplish -->"
  fi
  echo ""
  echo "## Acceptance Criteria"
  if [[ -n "$ACCEPTANCE" ]]; then
    IFS=',' read -ra CRITERIA <<< "$ACCEPTANCE"
    for criterion in "${CRITERIA[@]}"; do
      echo "- [ ] $(echo "$criterion" | sed 's/^ *//')"
    done
  else
    echo "- [ ] <!-- TODO: Add acceptance criteria -->"
  fi
  echo ""
  echo "## Dependencies"
  if [[ -n "$DEPENDENCIES" ]]; then
    IFS=',' read -ra DEPS <<< "$DEPENDENCIES"
    for dep in "${DEPS[@]}"; do
      echo "- $(echo "$dep" | sed 's/^ *//')"
    done
  else
    echo "- None"
  fi
  echo ""
  echo "## Notes"
  echo "- <!-- TODO: Add any additional context -->"
} > "$FEATURE_DIR/trd.md"

# --- implementation-strategy.md ---
{
  echo "# Implementation Strategy: $FEATURE_NAME"
  echo ""
  echo "## Database Changes"
  echo "$DB_CHANGES"
  echo ""
  echo "## API Modifications"
  echo "$API_CHANGES"
  echo ""
  echo "## UI Components"
  echo "None."
  echo ""
  echo "## Testing Approach"
  if [[ -n "$TESTING" ]]; then
    echo "$TESTING"
  else
    echo "<!-- TODO: Describe testing approach -->"
  fi
} > "$FEATURE_DIR/implementation-strategy.md"

# --- progress.md ---
{
  echo "# Progress: $FEATURE_NAME"
  echo ""
  echo "## Subtasks"
  if [[ -n "$SUBTASKS" ]]; then
    IFS=',' read -ra TASKS <<< "$SUBTASKS"
    for task in "${TASKS[@]}"; do
      echo "- [ ] $(echo "$task" | sed 's/^ *//')"
    done
  else
    echo "- [ ] <!-- TODO: Break down into subtasks -->"
  fi
} > "$FEATURE_DIR/progress.md"

echo "✅ Created feature: $FEATURE_DIR/"
echo "   - trd.md"
echo "   - implementation-strategy.md"
echo "   - progress.md"
