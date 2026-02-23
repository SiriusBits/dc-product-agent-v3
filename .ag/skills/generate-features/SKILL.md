---
name: generate-features
description: Scaffold feature directories with standardized trd.md, implementation-strategy.md, and progress.md files. Use when creating new features from a milestone or roadmap, or when the user asks to generate feature scaffolding for planned work.
metadata:
  author: dc-product-agent-v3
  version: "1.0"
---

# Generate Feature Directories

This skill creates standardized feature directories under `.ag/planning/features/` following the project's feature template convention.

## Feature Directory Structure

Each feature gets a directory with three files:

```
.ag/planning/features/{feature-name}/
├── trd.md                  # Task Requirement Document
├── implementation-strategy.md
└── progress.md
```

## When to Use

- A new milestone or roadmap has been planned and needs feature scaffolding
- The user asks to "create a feature" or "scaffold a feature"
- A planning session produces a list of features that need documentation

## How to Generate Features

### Single Feature

Run the bundled script to create one feature directory:

```bash
bash .ag/skills/generate-features/scripts/generate_feature.sh \
  --name "feature-name" \
  --milestone "M1 — Milestone Name" \
  --requirements "Description of what this feature must do." \
  --base-dir ".ag/planning/features"
```

### Batch Generation

For multiple features, call the script in a loop or write a wrapper script. See `references/batch-example.md` for a pattern.

### Manual Generation

If the script doesn't fit the use case, create the three files manually using the templates below.

## File Templates

### trd.md

```markdown
# Feature: {feature-name}

## Milestone
{milestone-id} — {milestone-name}

## Requirements
{description of what this feature must accomplish}

## Acceptance Criteria
- [ ] {criterion 1}
- [ ] {criterion 2}

## Dependencies
- {dependency 1}

## Notes
- {any additional context}
```

### implementation-strategy.md

```markdown
# Implementation Strategy: {feature-name}

## Database Changes
{describe schema changes, migrations, or "None"}

## API Modifications
{describe new/changed endpoints, services, or "None"}

## UI Components
{describe frontend changes, or "None"}

## Testing Approach
{describe unit tests, integration tests, benchmarks}
```

### progress.md

```markdown
# Progress: {feature-name}

## Subtasks
- [ ] {subtask 1}
- [ ] {subtask 2}
```

## Edge Cases

- **Feature name with spaces**: The script converts spaces to hyphens and lowercases the name.
- **Existing directory**: The script will NOT overwrite existing files. Use `--force` to overwrite.
- **Custom base directory**: Default is `.ag/planning/features/`, override with `--base-dir`.
- **Empty fields**: If `--requirements` is omitted, the TRD will contain a placeholder for you to fill in.
