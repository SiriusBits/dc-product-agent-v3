# KG Entity Naming Convention

This document defines the canonical mapping from `product_info` fields in **base_extraction** files to **knowledge_graph entity** fields in **derived_info** files.

## PRODUCT_NAME Entity (Required for Every Product)

Every derived_info file **must** contain at least one entity with `type: PRODUCT_NAME`. Its fields are populated as follows:

| Entity Field      | Source Field                           | Example (DCA 221)              |
|-------------------|----------------------------------------|--------------------------------|
| `text`            | `product_info.product_short_name`      | `DCA 221`                      |
| `type`            | (always `PRODUCT_NAME`)                | `PRODUCT_NAME`                 |
| `canonical_name`  | `product_info.product_name`            | `Dixie Chemical Amine 221`     |
| `aliases`         | Union of all known names (see below)   | See alias rules                |

### Alias Rules

The `aliases` array on a `PRODUCT_NAME` entity must contain the **complete union** of:

1. `product_info.product_short_name`
2. `product_info.product_name`
3. `product_info.chemical_name` (when non-null and different from the above)
4. All entries in `product_info.synonyms`

**Exception:** If a value is identical to the entity's `canonical_name`, it should still appear in `aliases` for searchability. The alias list is the exhaustive lookup set.

### Example

Given this base_extraction `product_info`:

```yaml
product_info:
  product_name: Dixie Chemical Amine 221
  product_short_name: DCA 221
  product_family: Polyglycoldiamine
  cas_number: 4246-51-9
  chemical_name: Polyglycoldiamine
  synonyms:
  - DCA 221
  - Dixie Chemical Amine 221
  - Polyglycoldiamine
```

The `PRODUCT_NAME` entity should be:

```yaml
- id: <uuid>
  text: DCA 221
  type: PRODUCT_NAME
  canonical_name: Dixie Chemical Amine 221
  aliases:
  - DCA 221
  - Dixie Chemical Amine 221
  - Polyglycoldiamine
```

## CHEMICAL Entity (Primary Compound)

When the product's chemical identity is distinct from the product name (i.e., `chemical_name` differs from `product_short_name`), a separate `CHEMICAL` entity should exist. Its aliases must include **both** the product short name and the full product name for cross-reference:

| Entity Field      | Source Field                           | Example (DCA 221)              |
|-------------------|----------------------------------------|--------------------------------|
| `text`            | `product_info.chemical_name`           | `Polyglycoldiamine`            |
| `type`            | (always `CHEMICAL`)                    | `CHEMICAL`                     |
| `canonical_name`  | `product_info.chemical_name`           | `Polyglycoldiamine`            |
| `aliases`         | Must include short name + full name    | See below                      |

### CHEMICAL Alias Rules

The `CHEMICAL` entity aliases must include:

1. `product_info.product_short_name` (e.g., "DCA 221")
2. `product_info.product_name` (e.g., "Dixie Chemical Amine 221")
3. Any other synonyms from `product_info.synonyms` that refer to this chemical

### Example

```yaml
- id: <uuid>
  text: Polyglycoldiamine
  type: CHEMICAL
  canonical_name: Polyglycoldiamine
  aliases:
  - DCA 221
  - Dixie Chemical Amine 221
  metadata:
    cas_number: 4246-51-9
```

## CAS_NUMBER Entity

CAS numbers must use entity type `CAS_NUMBER` (not `IDENTIFIER`).

```yaml
- id: <uuid>
  text: 4246-51-9
  type: CAS_NUMBER
  canonical_name: 4246-51-9
```

## Triple Reference Format

All `kg_triples` subject and object references that point to entities must use **raw UUID strings**, not `{id, name}` objects.

**Correct:**
```yaml
- subject: 5902da40-2e1c-56db-942d-24fcb2109582
  predicate: has_cas_number
  object: fa25fe8e-de28-5b86-84b9-e83871bd43af
```

**Incorrect:**
```yaml
- subject:
    id: 5902da40-2e1c-56db-942d-24fcb2109582
    name: DCA 221
  predicate: has_cas_number
  object:
    id: fa25fe8e-de28-5b86-84b9-e83871bd43af
    name: 4246-51-9
```

## Allowed Entity Types

See `reference/schema/common-defs.described.schema.json` for the authoritative enum. The allowed types are:

- `CHEMICAL` — Chemical compounds and substances
- `PRODUCT_NAME` — Dixie Chemical product names
- `ORGANIZATION` — Companies, institutions
- `APPLICATION` — Use cases and applications
- `PROPERTY` — Physical/chemical properties
- `CAS_NUMBER` — CAS Registry Numbers
- `CHEMICAL_CLASS` — Chemical families/categories
- `CHEMICAL_FUNCTION` — Functional roles (e.g., curing agent)
- `TEST_METHOD` — ASTM and internal test methods
- `UNIT` — Units of measurement
- `HAZARD` — Safety/hazard classifications
- `REGISTRATION` — Regulatory registrations (e.g., REACh)
- `BENEFIT` — Product benefits/advantages
- `MATERIAL` — Physical materials (e.g., stainless steel)
- `DOCUMENT` — Referenced documents/standards
- `LOCATION` — Geographic locations
