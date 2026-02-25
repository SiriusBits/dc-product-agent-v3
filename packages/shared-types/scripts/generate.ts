/**
 * generate.ts — Generates TypeScript interfaces from JSON Schema files.
 *
 * Handles two quirks of the project schemas:
 *   1. Snake_case JSON Schema keywords (additional_properties → additionalProperties)
 *   2. $ref URIs using https://example.com/schemas/… → local filenames
 *
 * Usage:  pnpm generate
 */
import { compile } from 'json-schema-to-typescript';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── Paths ──────────────────────────────────────────────────────────────
const SCHEMA_DIR = path.resolve(__dirname, '../../shared-schemas/src/schemas');
const OUTPUT_FILE = path.resolve(__dirname, '../src/types/generated.ts');

const SCHEMA_FILES = [
  'common-defs.described.schema.json',
  'base-technical-bulletin-with-defs.described.schema.json',
  'base-technical-bulletin-llm.schema.json',
  'derived-info-with-knowledge-graph-with-defs.described.schema.json',
  'kg-entity.schema.json',
  'kg-triple.schema.json',
  'chunk.schema.json',
];

// Schemas to generate top-level types from (skip common-defs — it only has $defs)
const TOP_LEVEL_SCHEMAS = SCHEMA_FILES.filter(
  (f) => f !== 'common-defs.described.schema.json',
);

// ── Keyword normalisation ──────────────────────────────────────────────
const KEY_MAP: Record<string, string> = {
  additional_properties: 'additionalProperties',
  one_of: 'oneOf',
  all_of: 'allOf',
  any_of: 'anyOf',
  unique_items: 'uniqueItems',
  min_items: 'minItems',
  max_items: 'maxItems',
  min_length: 'minLength',
  max_length: 'maxLength',
  pattern_properties: 'patternProperties',
};

function normalizeKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(normalizeKeys);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[KEY_MAP[key] ?? key] = normalizeKeys(value);
  }
  return result;
}

// ── $ref rewriting ─────────────────────────────────────────────────────
/** Build a map from schema $id → local filename */
function buildIdToFileMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const file of SCHEMA_FILES) {
    const raw = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf-8'));
    if (raw.$id) {
      map[raw.$id] = file;
    }
  }
  return map;
}

/** Replace https://example.com/… $ref URIs with relative filenames */
function rewriteRefs(
  obj: unknown,
  idMap: Record<string, string>,
): unknown {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => rewriteRefs(v, idMap));

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (key === '$ref' && typeof value === 'string') {
      let rewritten = value;
      for (const [id, filename] of Object.entries(idMap)) {
        if (value.startsWith(id)) {
          rewritten = value.replace(id, filename);
          break;
        }
      }
      result[key] = rewritten;
    } else {
      result[key] = rewriteRefs(value, idMap);
    }
  }
  return result;
}

// ── Main ───────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const idMap = buildIdToFileMap();

  // Write normalised + ref-rewritten schemas to a temp dir so
  // json-schema-to-typescript can resolve $ref via the filesystem.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-gen-'));

  for (const file of SCHEMA_FILES) {
    const raw = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf-8'));
    const normalized = rewriteRefs(normalizeKeys(raw), idMap);
    fs.writeFileSync(
      path.join(tmpDir, file),
      JSON.stringify(normalized, null, 2),
    );
  }

  let output = [
    '/* eslint-disable */',
    '/**',
    ' * AUTO-GENERATED — DO NOT EDIT',
    ' * Source: packages/shared-schemas/src/schemas/*.schema.json',
    ' * Run `pnpm generate` in packages/shared-types/ to regenerate.',
    ' */',
    '',
  ].join('\n');

  for (const file of TOP_LEVEL_SCHEMAS) {
    const schema = JSON.parse(
      fs.readFileSync(path.join(tmpDir, file), 'utf-8'),
    );
    const ts = await compile(schema, schema.title ?? file, {
      bannerComment: '',
      cwd: tmpDir,
      additionalProperties: false,
      strictIndexSignatures: true,
      enableConstEnums: false,
      format: true,
    });
    output += `// ── ${file} ${'─'.repeat(Math.max(0, 60 - file.length))}\n`;
    output += ts + '\n';
  }

  // Clean up temp dir
  fs.rmSync(tmpDir, { recursive: true, force: true });

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`✓ Generated TypeScript types → ${path.relative(process.cwd(), OUTPUT_FILE)}`);
}

main().catch((err) => {
  console.error('Type generation failed:', err);
  process.exit(1);
});
