# Neo4j Knowledge Graph Schema

**Version**: 1.0
**Status**: Design
**Corpus**: 17 derived YAML files → 241 entities, 764 triples

---

## 1. Design Principles

1. **Predicate normalization** — 294 raw YAML predicates → 25 canonical relationship types. Measurement conditions (temperature, frequency, specimen type, cure state) move from predicate names to relationship properties.
2. **MERGE-on-id** — All nodes keyed on `id` (UUID from YAML). Relationships keyed on `(subject_id, predicate, object_id/object_hash)`.
3. **Provenance first** — Every node and relationship carries `source_document_id` and `source_page` for traceability.
4. **Entity types preserved** — YAML entity types map 1:1 to Neo4j labels (15 → 13 after consolidating CAS_NUMBER + IDENTIFIER + REGISTRATION → `Identifier`).

---

## 2. Node Labels

### 2.1 Core Chemistry

| Label | Source YAML Type | Count | Description |
|-------|-----------------|-------|-------------|
| `Chemical` | CHEMICAL | 103 | Individual chemical compounds |
| `ChemicalClass` | CHEMICAL_CLASS | 22 | Chemical families / categories |
| `Product` | PRODUCT_NAME | 21 | Commercial products (Dixie catalog) |
| `ChemicalFunction` | CHEMICAL_FUNCTION | 2 | Functional roles (curing agent, diluent) |

### 2.2 Descriptive

| Label | Source YAML Type | Count | Description |
|-------|-----------------|-------|-------------|
| `Application` | APPLICATION | 20 | Use cases / end markets |
| `Property` | PROPERTY | 7 | Named measurable properties |
| `Benefit` | BENEFIT | 9 | Qualitative product benefits |
| `Hazard` | HAZARD | 1 | Safety hazards |

### 2.3 Reference

| Label | Source YAML Type | Count | Description |
|-------|-----------------|-------|-------------|
| `Organization` | ORGANIZATION | 19 | Companies, manufacturers |
| `Location` | LOCATION | 5 | Physical locations |
| `Document` | DOCUMENT | 7 | Source technical bulletins |
| `Identifier` | CAS_NUMBER, IDENTIFIER, REGISTRATION | 22 | CAS numbers, REACH registrations, other IDs |
| `Material` | MATERIAL | 3 | Physical materials (steels, packaging) |

### 2.4 Common Node Properties

All nodes carry these properties:

```cypher
{
  id:              STRING     -- UUID from YAML (unique per label)
  canonical_name:  STRING     -- primary display name
  aliases:         [STRING]   -- alternate names
  source_text:     STRING     -- original extraction text
  document_id:     STRING     -- provenance: source document UUID
  page:            INTEGER    -- provenance: source page number
  entity_type:     STRING     -- original YAML type (for round-trip)
  created_at:      DATETIME
  updated_at:      DATETIME
}
```

**Identifier nodes** additionally carry:

```cypher
{
  identifier_type: STRING  -- "CAS", "REACH", "EINECS", etc.
  value:           STRING  -- the identifier value itself
}
```

---

## 3. Relationship Types (Normalized)

294 raw predicates → 25 canonical types, organized by domain.

### 3.1 Taxonomy

#### IS_A
Classification / type hierarchy.

- **Direction**: `(Chemical)-[:IS_A]->(ChemicalClass)`
- **Raw predicates**: `is_a`, `is_type_of`, `is_chemical_type`
- **Properties**: none

#### DERIVED_FROM
Chemical derivation chain.

- **Direction**: `(Chemical)-[:DERIVED_FROM]->(Chemical)`
- **Raw predicates**: `derived_from`, `is_derived_from`
- **Properties**: none

#### FUNCTIONS_AS
Functional role assignment.

- **Direction**: `(Chemical)-[:FUNCTIONS_AS]->(ChemicalFunction)`
- **Raw predicates**: `functions_as`
- **Properties**: `{ context: STRING }` — optional formulation context

### 3.2 Provenance

#### PRODUCED_BY
Manufacturing relationship.

- **Direction**: `(Chemical|Product)-[:PRODUCED_BY]->(Organization)`
- **Raw predicates**: `is_produced_by`, `manufactured_by`, `is_manufactured_by`, `is_available_from`, `has_manufacturer`
- **Properties**: `{ role: STRING }` — "manufacturer", "distributor", etc.

#### PUBLISHES
Document authorship.

- **Direction**: `(Organization)-[:PUBLISHES]->(Document)`
- **Raw predicates**: `publishes`, `published`
- **Properties**: none

#### LOCATED_AT
Geographic presence.

- **Direction**: `(Organization)-[:LOCATED_AT]->(Location)`
- **Raw predicates**: `located_at`, `located_in`
- **Properties**: none

### 3.3 Identification

#### HAS_IDENTIFIER
Links entities to external identifiers.

- **Direction**: `(Chemical|Product)-[:HAS_IDENTIFIER]->(Identifier)`
- **Raw predicates**: `has_cas_number`, `has_reach_number`, `has_reach_registration`, `has_registration`, `has_identifier`, `has_chemical_name`
- **Properties**: none (type info lives on Identifier node)

### 3.4 Properties & Measurements

#### HAS_PROPERTY
**The primary workhorse relationship.** Absorbs ~135 raw predicates by moving conditions to relationship properties.

- **Direction**: `(Chemical|Product)-[:HAS_PROPERTY]->(Chemical|Property)` or self-referencing with property data on the relationship
- **Raw predicates** (grouped):
  - **Static properties**: `has_typical_property`, `has_property`, `has_appearance`, `has_color`, `has_odor`, `has_molecular_weight`, `has_flash_point`, `has_pour_point`, `has_specific_gravity`, `has_viscosity`, `has_refractive_index`, `has_melting_point`, `has_freezing_point`, `has_equivalent_weight`, `has_epoxy_equivalent_weight`, `has_neutralization_number`, `has_neutralization_equivalent`, `has_purity`, `has_purity_min`, `has_assay`, `has_physical_appearance`, `has_relative_density`, `has_saybolt_color`, `has_gardner_color`, `has_color_max`, `has_free_acid`, `has_free_acid_max`, `has_maleic_anhydride`, `has_maleic_anhydride_max`, `has_total_anhydride`, `has_anhydride_content`, `has_acid_value`, `has_hdsa_content`, `has_odsa_content`, `has_amine_equivalent_min`, `has_amine_equivalent_max`, `has_apha_color_max`, `has_water_content_max`, `has_viscosity_min_at_25c`, `has_viscosity_max_at_25c`, `has_specific_gravity_min`, `has_specific_gravity_max`, `has_functional_groups`, `has_onset_temperature`, `has_heat_of_combustion`, `has_stability`, `has_chemical_composition`, `has_residual_olefin`, `has_impurity`, `has_impurity_level`, `has_residual`, `has_residual_level`, `has_volatiles`, `has_value`
  - **Specification properties**: `has_specification_viscosity`, `has_specification_propyleneimine`, `has_specification_solids`, `has_specification_color`
  - **Conditioned measurements**: `has_viscosity_at_temperature`, `has_specific_gravity_at_temperature`, `has_vapor_pressure_at_temperature`, `viscosity_at_temperature`, `has_viscosity_at_minus_18C`, `has_viscosity_at_minus_54C`
  - **Electrical measurements**: all `has_dielectric_constant_*`, `has_dielectric_strength_*`, `has_dissipation_factor_*`, `has_arc_resistance`, `has_volume_resistivity_*`, `has_surface_resistivity_*`
  - **Mechanical measurements**: `has_izod_impact`, `has_flexural_strength`, `has_weight_loss_200c`
  - **Postcure / aging**: `has_tg_at_*_phr`, `has_hdt_at_*_postcure`, `has_water_boil_gain_*`, `has_acetone_boil_gain_*`, `has_tensile_strength_*`, `has_tensile_modulus_*`, `has_elongation_*`, `has_value_at_*`, `has_power_factor_*`

- **Property schema**:

```cypher
{
  property_name:    STRING    -- e.g. "Viscosity", "Dielectric Constant"
  value:            STRING    -- the measured/typical value (always stored as string)
  numeric_value:    FLOAT     -- parsed numeric value (NULL if non-numeric)
  unit:             STRING    -- e.g. "cPs", "°C", "psi", "ohm·cm"
  min_value:        STRING    -- spec minimum (NULL if not a spec)
  max_value:        STRING    -- spec maximum (NULL if not a spec)
  temperature:      STRING    -- measurement temperature (NULL if ambient)
  temperature_c:    FLOAT     -- parsed temperature in Celsius (NULL if N/A)
  frequency:        STRING    -- electrical measurement frequency (NULL if N/A)
  specimen_type:    STRING    -- "short_time", "step_by_step", etc. (NULL if N/A)
  cure_condition:   STRING    -- "room_cure", "postcured", "4h", "24h", "200h"
  phr:              FLOAT     -- parts per hundred resin (for Tg curves)
  is_specification: BOOLEAN   -- true if this is a spec limit, not a typical value
  comparison_value: STRING    -- baseline comparison value (for *_comparison predicates)
  method:           STRING    -- test method (e.g. "ASTM D150")
  source_predicate: STRING    -- original YAML predicate (for traceability)
}
```

**Normalization example — DCA 221 electrical properties**:

Before (58 predicates):
```
has_dielectric_constant_23c_60hz
has_dielectric_constant_23c_1khz
has_dielectric_constant_60c_1mhz
has_dielectric_constant_60c_1mhz_comparison
```

After (1 relationship type):
```cypher
(dca221)-[:HAS_PROPERTY {
  property_name: "Dielectric Constant",
  value: "3.6",
  numeric_value: 3.6,
  temperature: "23°C",
  temperature_c: 23.0,
  frequency: "60Hz",
  source_predicate: "has_dielectric_constant_23c_60hz"
}]->(p:Property {canonical_name: "Dielectric Constant"})
```

### 3.5 Applications & Benefits

#### HAS_APPLICATION
Product/chemical use cases.

- **Direction**: `(Chemical|Product)-[:HAS_APPLICATION]->(Application)` or inline string
- **Raw predicates**: `has_application`, `used_in`, `used_in_application`, `used_as`, `used_as_intermediate_for`
- **Properties**: `{ role: STRING }` — "primary", "intermediate", etc.
- **Note**: When the object is a plain string, create an `Application` node on the fly.

#### HAS_BENEFIT
Qualitative advantages.

- **Direction**: `(Chemical|Product)-[:HAS_BENEFIT]->(Benefit)` or inline string
- **Raw predicates**: `has_benefit`, `has_key_benefit`, `provides`, `provides_property`
- **Properties**: `{ is_key: BOOLEAN }`
- **Note**: When the object is a plain string, create a `Benefit` node on the fly.

### 3.6 Safety

#### HAS_HAZARD
Safety risks.

- **Direction**: `(Chemical)-[:HAS_HAZARD]->(Hazard)` or inline string
- **Raw predicates**: `has_hazard`, `has_safety_hazard`, `may_cause`, `is_irritant_to`, `is_corrosive_to`
- **Properties**: `{ hazard_type: STRING, severity: STRING, target: STRING }`
- **Note**: String objects become `Hazard` nodes.

#### REQUIRES_PPE
Personal protective equipment requirements.

- **Direction**: `(Chemical)-[:REQUIRES_PPE {ppe_type: STRING}]->(Chemical)` (self-referencing, or to a synthetic PPE node)
- **Raw predicates**: `requires_ppe`
- **Properties**: `{ ppe_type: STRING, description: STRING }`
- **Modeling note**: Since PPE entries are plain strings in the YAML, store as self-referencing relationships with `ppe_type` property. Alternative: create lightweight `PPE` nodes.

#### HAS_FIRST_AID
Emergency response instructions.

- **Direction**: `(Chemical)-[:HAS_FIRST_AID]->(Chemical)` (self-referencing)
- **Raw predicates**: `has_first_aid`
- **Properties**: `{ instruction: STRING, route: STRING }` — route = "inhalation", "skin", "eye", "ingestion"

#### HAS_STORAGE
Storage and handling requirements.

- **Direction**: `(Chemical|Product)-[:HAS_STORAGE]->(Material)` or self-referencing
- **Raw predicates**: `has_storage_requirement`, `requires_storage_condition`, `has_storage_guidance_in`, `has_shelf_life`, `storage_recommendation`, `has_special_handling`, `can_be_stored_in`
- **Properties**: `{ requirement_type: STRING, value: STRING, shelf_life: STRING }`

#### HAS_TOXICITY
Quantitative toxicology data.

- **Direction**: `(Chemical)-[:HAS_TOXICITY]->(Chemical)` (self-referencing)
- **Raw predicates**: `has_ld50`, `has_skin_irritation_value`, `is_eye_irritant`, `has_mutagenicity_value`, `has_mutagenic_activity`, `has_toxicity_comparison`
- **Properties**: `{ test_type: STRING, value: STRING, route: STRING, species: STRING }`

### 3.7 Chemistry

#### COMPATIBLE_WITH
Chemical compatibility (bidirectional semantics, stored as directed).

- **Direction**: `(Chemical)-[:COMPATIBLE_WITH]->(Chemical)`
- **Raw predicates**: `is_compatible_with`, `compatible_with`, `can_be_formulated_with`, `can_be_combined_with`
- **Properties**: `{ context: STRING }`

#### INCOMPATIBLE_WITH
Chemical incompatibility.

- **Direction**: `(Chemical)-[:INCOMPATIBLE_WITH]->(Chemical)`
- **Raw predicates**: `is_incompatible_with`
- **Properties**: `{ reason: STRING }`

#### REACTS_WITH
Chemical reactions.

- **Direction**: `(Chemical)-[:REACTS_WITH]->(Chemical)`
- **Raw predicates**: `reacts_with`, `crosslinks_with`, `cures`, `is_cured_with`, `catalyzes`, `catalyzed_by`, `reacts_with_to_form`, `can_be_converted_to`, `has_chemical_reaction`, `used_with_catalyst`
- **Properties**: `{ reaction_type: STRING, product_name: STRING, product_id: STRING }`

#### CONTAINS
Composition / components.

- **Direction**: `(Chemical|Product)-[:CONTAINS]->(Chemical)`
- **Raw predicates**: `contains_component`, `contains_additive`, `contains`, `has_variant`, `has_solvent`
- **Properties**: `{ role: STRING, amount: STRING }`

### 3.8 Formulation & Performance

#### FORMULATED_WITH
Formulation ingredient relationships. Absorbs the DCA 221 "formulated_with_*" explosion.

- **Direction**: `(Chemical)-[:FORMULATED_WITH]->(Chemical)`
- **Raw predicates**: all `formulated_with_*` predicates, `has_formulation_with`, `has_formulation_property`, `has_formulation_data_with`
- **Properties**:

```cypher
{
  formulation_name: STRING  -- e.g. "High Impact", "Flexible", "Troweling Part A"
  amount:           STRING  -- weight/volume amount
  amount_unit:      STRING  -- "phr", "g", "%", etc.
  role:             STRING  -- "resin", "filler", "solvent", "accelerator"
  source_predicate: STRING  -- original YAML predicate
}
```

**Normalization example — DCA 221 formulations**:

Before (20+ predicates):
```
formulated_with_bis_a_type_ii_high_impact
formulated_with_polyglycoldiamine_high_impact
formulated_with_bis_a_type_ii_flexible
formulated_with_butyl_glycidyl_ether_flexible
```

After:
```cypher
(dca221)-[:FORMULATED_WITH {
  formulation_name: "High Impact",
  role: "resin",
  source_predicate: "formulated_with_bis_a_type_ii_high_impact"
}]->(bisA:Chemical {canonical_name: "Bis-A Type II"})
```

#### ACHIEVES
Performance test results from formulations.

- **Direction**: `(Chemical)-[:ACHIEVES]->(Chemical|Property)`
- **Raw predicates**: all `achieves_*` predicates, `achieves_tg_with`
- **Properties**:

```cypher
{
  property_name:      STRING  -- "Flexural Strength", "Tg", "Izod Impact", etc.
  value:              STRING
  numeric_value:      FLOAT
  unit:               STRING
  formulation_name:   STRING  -- "High Impact", "Room Cure", "Postcured"
  cure_condition:     STRING  -- "room_cure", "postcured_2h_150c"
  test_temperature:   STRING
  source_predicate:   STRING
}
```

#### HAS_CURE_DATA
Curing schedules and cured-state properties.

- **Direction**: `(Chemical)-[:HAS_CURE_DATA]->(Chemical)` (self-referencing or to curing agent)
- **Raw predicates**: `has_cure_schedule`, `has_cure_cycle`, `has_property_when_cured`, `has_gel_time`, `has_cured_tg`
- **Properties**: `{ schedule: STRING, temperature: STRING, duration: STRING, property_name: STRING, value: STRING }`

#### HAS_DOSAGE
Recommended usage levels.

- **Direction**: `(Chemical)-[:HAS_DOSAGE]->(Chemical)` (curing agent → resin, etc.)
- **Raw predicates**: `has_dosage_with`, `recommended_addition_level`, `recommended_equivalents`, `typical_usage_range`, `high_performance_usage`, `has_theoretical_level_with`
- **Properties**: `{ dosage_value: STRING, unit: STRING, context: STRING }`

### 3.9 Other

#### COMPARED_TO
Competitive / benchmark comparisons.

- **Direction**: `(Chemical)-[:COMPARED_TO]->(Chemical)`
- **Raw predicates**: `compared_to`, all `*_comparison` predicates
- **Properties**: `{ property_name: STRING, this_value: STRING, other_value: STRING }`
- **Note**: For `*_comparison` predicates, the comparison data can also be stored as `comparison_value` on `HAS_PROPERTY` relationships instead of creating separate `COMPARED_TO` edges.

#### MODIFIES
One chemical modifies/reduces behavior of another.

- **Direction**: `(Chemical)-[:MODIFIES]->(Chemical)`
- **Raw predicates**: `modifies`, `reduces`
- **Properties**: `{ effect: STRING }`

#### AVAILABLE_IN
Packaging / form availability.

- **Direction**: `(Chemical|Product)-[:AVAILABLE_IN]->(Material)`
- **Raw predicates**: `is_available_in`
- **Properties**: `{ packaging_type: STRING }`

#### LOWERS_FREEZING_POINT_OF
Specialized anti-freeze relationship.

- **Direction**: `(Chemical)-[:LOWERS_FREEZING_POINT_OF]->(Chemical)`
- **Raw predicates**: `lowers_freezing_point_of`
- **Properties**: none

#### TESTED_WITH
Testing methodology associations.

- **Direction**: `(Chemical)-[:TESTED_WITH]->(Chemical)`
- **Raw predicates**: `is_tested_with`
- **Properties**: `{ test_context: STRING }`

---

## 4. Polymorphic Object Handling

YAML triple objects come in 11 shapes. The ingestion pipeline maps them as follows:

### 4.1 String objects (481 occurrences)

**Pattern**: `{ subject: {id, name}, predicate: "has_application", object: "alkaline paper sizing" }`

**Strategy**: Create a target node from the string value.

```cypher
MERGE (app:Application {canonical_name: $object_string})
ON CREATE SET app.id = randomUUID(), app.created_at = datetime()
MERGE (subj)-[:HAS_APPLICATION]->(app)
```

For safety strings (PPE, first aid, storage), store as relationship properties on self-referencing edges:

```cypher
MERGE (subj)-[:REQUIRES_PPE {ppe_type: $object_string, source_predicate: $predicate}]->(subj)
```

### 4.2 Entity reference objects (57 occurrences)

**Pattern**: `{ subject: {id, name}, predicate: "is_a", object: {id: "...", name: "Anhydrides"} }`

**Strategy**: Direct node-to-node relationship via MERGE on both node IDs.

```cypher
MATCH (a {id: $subject_id}), (b {id: $object_id})
MERGE (a)-[:IS_A]->(b)
```

### 4.3 Property-value objects (160 occurrences)

**Pattern**: `{ subject: {id, name}, predicate: "has_typical_property", object: {property: "Molecular Weight", value: "170"} }`

**Strategy**: Create Property node + HAS_PROPERTY relationship with value on the edge.

```cypher
MERGE (p:Property {canonical_name: $property_name})
ON CREATE SET p.id = randomUUID()
MERGE (subj)-[r:HAS_PROPERTY]->(p)
SET r.value = $value, r.source_predicate = $predicate
```

### 4.4 Temperature-conditioned objects (6 occurrences)

**Pattern**: `{ object: {temperature: "0°C", value: "680 cPs"} }`

**Strategy**: Map to HAS_PROPERTY with temperature metadata.

```cypher
MERGE (p:Property {canonical_name: "Viscosity"})
MERGE (subj)-[r:HAS_PROPERTY]->(p)
SET r.value = $value, r.temperature = $temperature,
    r.source_predicate = $predicate
```

### 4.5 Complex measurement objects (25 occurrences)

**Shapes**: `{temperature_c, vapor_pressure_mmhg}`, `{temperature_c, viscosity_cps}`, `{specific_gravity_lbs_gal, temperature_c}`, `{epoxy_type, mhhpa_301_phr, viscosity_25c_cp, gel_time_min, tg_c}`, `{anhydride_amount, cure_schedule, resin, resin_amount}`

**Strategy**: Flatten all keys into relationship properties.

```cypher
MERGE (subj)-[r:HAS_PROPERTY]->(p:Property {canonical_name: $derived_property_name})
SET r += $flattened_object_map, r.source_predicate = $predicate
```

For formulation data objects:
```cypher
MERGE (resin:Chemical {canonical_name: $epoxy_type})
MERGE (subj)-[r:FORMULATED_WITH]->(resin)
SET r.amount = $mhhpa_301_phr, r.amount_unit = "phr",
    r.viscosity_25c_cp = $viscosity_25c_cp, r.gel_time_min = $gel_time_min,
    r.tg_c = $tg_c, r.source_predicate = $predicate
```

### 4.6 Null objects (34 occurrences)

**Strategy**: Log warning during ingestion. Skip relationship creation. Track in `data/kg/ingestion_warnings.jsonl`.

---

## 5. Constraints & Indexes

### 5.1 Uniqueness Constraints (one per label)

```cypher
CREATE CONSTRAINT chemical_id IF NOT EXISTS
  FOR (n:Chemical) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT chemical_class_id IF NOT EXISTS
  FOR (n:ChemicalClass) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT product_id IF NOT EXISTS
  FOR (n:Product) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT organization_id IF NOT EXISTS
  FOR (n:Organization) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT application_id IF NOT EXISTS
  FOR (n:Application) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT document_id IF NOT EXISTS
  FOR (n:Document) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT identifier_id IF NOT EXISTS
  FOR (n:Identifier) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT material_id IF NOT EXISTS
  FOR (n:Material) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT property_id IF NOT EXISTS
  FOR (n:Property) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT benefit_id IF NOT EXISTS
  FOR (n:Benefit) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT hazard_id IF NOT EXISTS
  FOR (n:Hazard) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT location_id IF NOT EXISTS
  FOR (n:Location) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT chemical_function_id IF NOT EXISTS
  FOR (n:ChemicalFunction) REQUIRE n.id IS UNIQUE;
```

### 5.2 Lookup Indexes

```cypher
-- Name lookups (most common query pattern)
CREATE INDEX chemical_name IF NOT EXISTS
  FOR (n:Chemical) ON (n.canonical_name);

CREATE INDEX product_name IF NOT EXISTS
  FOR (n:Product) ON (n.canonical_name);

CREATE INDEX chemical_class_name IF NOT EXISTS
  FOR (n:ChemicalClass) ON (n.canonical_name);

CREATE INDEX organization_name IF NOT EXISTS
  FOR (n:Organization) ON (n.canonical_name);

CREATE INDEX application_name IF NOT EXISTS
  FOR (n:Application) ON (n.canonical_name);

CREATE INDEX property_name IF NOT EXISTS
  FOR (n:Property) ON (n.canonical_name);

-- Identifier lookups (CAS number search)
CREATE INDEX identifier_value IF NOT EXISTS
  FOR (n:Identifier) ON (n.value);

CREATE INDEX identifier_type IF NOT EXISTS
  FOR (n:Identifier) ON (n.identifier_type);

-- Provenance lookups
CREATE INDEX chemical_document IF NOT EXISTS
  FOR (n:Chemical) ON (n.document_id);

CREATE INDEX product_document IF NOT EXISTS
  FOR (n:Product) ON (n.document_id);
```

### 5.3 Full-Text Search Index

```cypher
CREATE FULLTEXT INDEX entity_names IF NOT EXISTS
  FOR (n:Chemical|ChemicalClass|Product|Application|Benefit|Hazard)
  ON EACH [n.canonical_name, n.source_text];
```

---

## 6. Predicate Normalization Mapping

Complete mapping from raw YAML predicates to canonical relationship types.

### Lookup table for ingestion pipeline

```python
PREDICATE_MAP: dict[str, str] = {
    # Taxonomy
    "is_a": "IS_A",
    "is_type_of": "IS_A",
    "is_chemical_type": "IS_A",
    "derived_from": "DERIVED_FROM",
    "is_derived_from": "DERIVED_FROM",
    "functions_as": "FUNCTIONS_AS",

    # Provenance
    "is_produced_by": "PRODUCED_BY",
    "manufactured_by": "PRODUCED_BY",
    "is_manufactured_by": "PRODUCED_BY",
    "is_available_from": "PRODUCED_BY",
    "has_manufacturer": "PRODUCED_BY",
    "publishes": "PUBLISHES",
    "published": "PUBLISHES",
    "located_at": "LOCATED_AT",
    "located_in": "LOCATED_AT",

    # Identification
    "has_cas_number": "HAS_IDENTIFIER",
    "has_reach_number": "HAS_IDENTIFIER",
    "has_reach_registration": "HAS_IDENTIFIER",
    "has_registration": "HAS_IDENTIFIER",
    "has_identifier": "HAS_IDENTIFIER",
    "has_chemical_name": "HAS_IDENTIFIER",

    # Applications
    "has_application": "HAS_APPLICATION",
    "used_in": "HAS_APPLICATION",
    "used_in_application": "HAS_APPLICATION",
    "used_as": "HAS_APPLICATION",
    "used_as_intermediate_for": "HAS_APPLICATION",

    # Benefits
    "has_benefit": "HAS_BENEFIT",
    "has_key_benefit": "HAS_BENEFIT",
    "provides": "HAS_BENEFIT",
    "provides_property": "HAS_BENEFIT",

    # Safety
    "has_hazard": "HAS_HAZARD",
    "has_safety_hazard": "HAS_HAZARD",
    "may_cause": "HAS_HAZARD",
    "is_irritant_to": "HAS_HAZARD",
    "is_corrosive_to": "HAS_HAZARD",
    "requires_ppe": "REQUIRES_PPE",
    "has_first_aid": "HAS_FIRST_AID",
    "has_storage_requirement": "HAS_STORAGE",
    "requires_storage_condition": "HAS_STORAGE",
    "has_storage_guidance_in": "HAS_STORAGE",
    "has_shelf_life": "HAS_STORAGE",
    "storage_recommendation": "HAS_STORAGE",
    "has_special_handling": "HAS_STORAGE",
    "can_be_stored_in": "HAS_STORAGE",

    # Toxicity
    "has_ld50": "HAS_TOXICITY",
    "has_skin_irritation_value": "HAS_TOXICITY",
    "is_eye_irritant": "HAS_TOXICITY",
    "has_mutagenicity_value": "HAS_TOXICITY",
    "has_mutagenic_activity": "HAS_TOXICITY",
    "has_toxicity_comparison": "HAS_TOXICITY",

    # Chemistry
    "is_compatible_with": "COMPATIBLE_WITH",
    "compatible_with": "COMPATIBLE_WITH",
    "can_be_formulated_with": "COMPATIBLE_WITH",
    "can_be_combined_with": "COMPATIBLE_WITH",
    "is_incompatible_with": "INCOMPATIBLE_WITH",
    "reacts_with": "REACTS_WITH",
    "crosslinks_with": "REACTS_WITH",
    "cures": "REACTS_WITH",
    "is_cured_with": "REACTS_WITH",
    "catalyzes": "REACTS_WITH",
    "catalyzed_by": "REACTS_WITH",
    "reacts_with_to_form": "REACTS_WITH",
    "can_be_converted_to": "REACTS_WITH",
    "has_chemical_reaction": "REACTS_WITH",
    "used_with_catalyst": "REACTS_WITH",
    "contains_component": "CONTAINS",
    "contains_additive": "CONTAINS",
    "contains": "CONTAINS",
    "has_variant": "CONTAINS",
    "has_solvent": "CONTAINS",

    # Formulation & Performance
    "has_formulation_with": "FORMULATED_WITH",
    "has_formulation_property": "FORMULATED_WITH",
    "has_formulation_data_with": "FORMULATED_WITH",
    "has_cure_schedule": "HAS_CURE_DATA",
    "has_cure_cycle": "HAS_CURE_DATA",
    "has_property_when_cured": "HAS_CURE_DATA",
    "has_gel_time": "HAS_CURE_DATA",
    "has_cured_tg": "HAS_CURE_DATA",
    "has_dosage_with": "HAS_DOSAGE",
    "recommended_addition_level": "HAS_DOSAGE",
    "recommended_equivalents": "HAS_DOSAGE",
    "typical_usage_range": "HAS_DOSAGE",
    "high_performance_usage": "HAS_DOSAGE",
    "has_theoretical_level_with": "HAS_DOSAGE",

    # Other
    "compared_to": "COMPARED_TO",
    "modifies": "MODIFIES",
    "reduces": "MODIFIES",
    "is_available_in": "AVAILABLE_IN",
    "lowers_freezing_point_of": "LOWERS_FREEZING_POINT_OF",
    "is_tested_with": "TESTED_WITH",
    "is_equivalent_to": "COMPATIBLE_WITH",
    "are_considered": "HAS_HAZARD",
    "requires": "REQUIRES_PPE",
    "with_resin": "FORMULATED_WITH",
    "used_with": "COMPATIBLE_WITH",
}
```

### Wildcard rules for remaining predicates

Predicates not in the explicit map are classified by prefix pattern:

```python
PREDICATE_PREFIX_RULES: list[tuple[str, str]] = [
    ("formulated_with_", "FORMULATED_WITH"),
    ("achieves_", "ACHIEVES"),
    ("has_dielectric_", "HAS_PROPERTY"),
    ("has_dissipation_", "HAS_PROPERTY"),
    ("has_volume_resistivity_", "HAS_PROPERTY"),
    ("has_surface_resistivity_", "HAS_PROPERTY"),
    ("has_arc_resistance", "HAS_PROPERTY"),
    ("has_tensile_strength_", "HAS_PROPERTY"),
    ("has_tensile_modulus_", "HAS_PROPERTY"),
    ("has_elongation_", "HAS_PROPERTY"),
    ("has_water_boil_gain_", "HAS_PROPERTY"),
    ("has_acetone_boil_gain_", "HAS_PROPERTY"),
    ("has_hdt_at_", "HAS_PROPERTY"),
    ("has_tg_at_", "HAS_PROPERTY"),
    ("has_viscosity_", "HAS_PROPERTY"),
    ("has_specific_gravity_", "HAS_PROPERTY"),
    ("has_vapor_pressure_", "HAS_PROPERTY"),
    ("has_", "HAS_PROPERTY"),  # catch-all for remaining has_* predicates
]
```

---

## 7. Data Quality Notes

### 7.1 Known issues from audit

1. **34 null objects** — Triples where `object` is `None`. Skip during ingestion, log to warnings file.
2. **Template variables** — Entity `${manufacturer.name}` found in ORGANIZATION type. Filter during ingestion.
3. **Duplicate entities across files** — "Dixie Chemical" / "Dixie Chemical Company" appear in multiple files with different UUIDs. Deduplication by `canonical_name` within the same label needed during ingestion.
4. **CAS_NUMBER vs IDENTIFIER overlap** — Some CAS numbers appear under both entity types. The schema consolidates both under `Identifier` with `identifier_type` discriminator.

### 7.2 Ingestion validation rules

1. Skip triples with null objects (log warning).
2. Skip entities with template variable names (log warning).
3. Deduplicate entities by `(label, canonical_name)` — keep first occurrence, merge aliases.
4. Validate all subject/object `id` references resolve to known entities.
5. Log unmapped predicates (those not in `PREDICATE_MAP` or prefix rules) as warnings — map to `HAS_PROPERTY` as fallback.

---

## 8. Query Patterns

Common Cypher queries this schema optimizes for:

### Product lookup
```cypher
MATCH (p:Product {canonical_name: $name})-[:IS_A]->(c:ChemicalClass)
OPTIONAL MATCH (p)-[:HAS_APPLICATION]->(a:Application)
OPTIONAL MATCH (p)-[:HAS_PROPERTY]->(prop:Property)
RETURN p, c, collect(DISTINCT a) as applications, collect(DISTINCT prop) as properties
```

### Chemical safety profile
```cypher
MATCH (ch:Chemical {canonical_name: $name})
OPTIONAL MATCH (ch)-[h:HAS_HAZARD]->()
OPTIONAL MATCH (ch)-[ppe:REQUIRES_PPE]->(ch)
OPTIONAL MATCH (ch)-[fa:HAS_FIRST_AID]->(ch)
OPTIONAL MATCH (ch)-[s:HAS_STORAGE]->()
OPTIONAL MATCH (ch)-[t:HAS_TOXICITY]->(ch)
RETURN ch, collect(h) as hazards, collect(ppe) as ppe,
       collect(fa) as first_aid, collect(s) as storage, collect(t) as toxicity
```

### Property comparison across products
```cypher
MATCH (ch)-[r:HAS_PROPERTY]->(p:Property {canonical_name: $property_name})
WHERE r.temperature = $temperature
RETURN ch.canonical_name, r.value, r.numeric_value, r.unit
ORDER BY r.numeric_value
```

### Formulation exploration
```cypher
MATCH (ch:Chemical {canonical_name: $name})-[f:FORMULATED_WITH]->(component:Chemical)
WHERE f.formulation_name = $formulation
RETURN component.canonical_name, f.amount, f.role
```

### Knowledge graph traversal (for n8n routing)
```cypher
MATCH path = (start:Chemical {canonical_name: $name})-[*1..3]-(related)
RETURN path
```
