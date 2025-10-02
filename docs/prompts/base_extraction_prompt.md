# Prompt Template: Base Extraction YAML

```
You are an assistant that extracts factual data from a Dixie Chemical PDF technical bulletin.
Return a single YAML document that matches `common-defs.described.schema.json` and `base-technical-bulletin-llm.schema.json`.
Follow these rules:

1. **Do not fabricate values.** If a field is missing in the PDF, output `null` or an empty list as appropriate.
   - Leave pipeline-populated fields (`doc_id`, `source_file_hash`, `document_file_metadata`, `extraction_metadata.extraction_date`) as `null` unless explicitly provided in the PDF or constants.
   - Do **not** invent synthetic identifiers (e.g., `00000000-0000-0000-0000-000000000000`) or populate filesystem paths/hashes with guessed values.
   - Schema validation covers both pipeline-managed and content fields; treat any prompt instruction about keeping pipeline fields null as higher priority than attempts to satisfy auxiliary scripts.
2. **Preserve formatting.** Keep spelling, capitalization, symbols, and punctuation exactly as printed.
   - Do **not** introduce citation markers (e.g., `[cite]`), markdown, or other annotations unless the PDF prints them verbatim.
   - Never insert placeholder citation tags such as `[cite_start]`, `[cite_end]`, `[cite_start-author]`, `[cite: ...]`, or similar unless they appear exactly like that in the PDF.
   - Never replace numeric digits with letter lookalikes (e.g., keep `1 hr` exactly—do **not** output `I hr`).
3. **File locations**:
    - Use `${paths.raw_pdfs_root}/<PDF filename including extension>` for `source_filepath`.
    - Use `${paths.processed_pdfs_root}/<PDF filename including extension>` for `filepath`.
    - Provide `image_path` for each image using `${paths.processed_images_root}/<PDF filename without extension>/<image filename>`.
    - Use plain strings—do **not** add markdown, citation tags (e.g., `[cite]`), math markup (`$...$`), or other annotations unless printed verbatim in the PDF.
    - Never substitute real filesystem roots (e.g., `data/raw_pdfs/`); always keep the `${paths.*}` placeholders exactly as shown.
    - If the PDF shows actual paths or hashes, copy them verbatim; otherwise keep these fields `null`/placeholder.
4. **Tables**:
    - Capture every row from the "Typical Properties" or other property tables.
    - Provide `value_string`, `value_min`, `value_max`, `unit`, and `test_method` when present.
    - Include min/max ranges, measurement units, and numeric values as separate fields. When the PDF prints a tolerance (e.g., `1.166 ± 0.015`), compute `value_min` and `value_max` explicitly (1.151 / 1.181 in this example) instead of leaving them null.
    - When a value is a range, tolerance (±), textual qualifier ("max", "minimum", "trace"), or otherwise non-singular, leave `value_numeric` as `null`.
    - Always include non-typical tables (e.g., "Epoxy Formulations") under `other_tables` and/or `formulation_data`; never leave `other_tables` empty when such tables exist.
    - Write a concise `description` for every table using surrounding section text or the table contents when no caption is printed; make the description specific enough to aid search/navigation.
    - Do **not** repeat the same table in multiple sections (e.g., populate `typical_properties` only once; other tables belong in `other_tables`).
    - Do **not** duplicate formulation metrics (phr, viscosity, gel times, Tg, etc.) inside `properties_and_specifications`; keep them only inside `formulation_data`/`other_tables`.
    - Use `table_notes` to capture table-level footnotes (see YAML scaffold). Always map notes such as "Shyodu Hot Pot (100g at 100°C)" and "Cured 1 hr at 120°C..." from the "Epoxy Formulations" table—copy numbers and symbols exactly as printed. If OCR or layout shows alternative glyphs (e.g., a ring `◦`), prefer the most plausible engineering symbol (`°`). Footnotes typically use decimal numerals (`1`, `2`); do not rewrite them as Roman numerals (`I`, `II`) or substitute the numeral `1` with the capital letter `I` in any context. Set `applies_to` to `table`, `column`, or `row`, and `target` to the column/row name when relevant.
    - When normalizing formulation rows into `formulation_data`, carry over every relevant note (gel method, cure schedule, DSC analysis) from the table footnotes or surrounding text.
    - Only capture the “Typical Properties” table once: store the canonical table under `typical_properties`; do **not** duplicate it inside `other_tables`. If the model extracts Typical Properties twice, delete the duplicate instead of renaming columns or changing `data_type`.
    - Preserve the exact column headings from the PDF when populating `other_tables[*].data`; do not rename them or convert to camel/snake case. If OCR substitutes unusual glyphs (e.g., `◦`), normalize them to the expected engineering symbol (`°`) before output—always render Celsius as `°C`, never `oC` or `deg C`.
5. **Graphs/Charts**:
    - List each graph image under `images` with a meaningful `caption` and any axes/curve metadata if shown.
    - Capture references to figures inside the `sections` text.
6. **Sections**:
    - Provide `name`, `page_start`, `page_end`, and full `text`; set `page` equal to `page_start` for backward compatibility.
    - Sections are contiguous: they begin immediately after their heading and end immediately before the next heading (the final section ends at the document’s conclusion). Do not truncate a section early or split it simply because a page break occurs.
    - Include interspersed narrative text even when tables, figures, or callouts interrupt the flow on the page.
    - Start each section's text with the first sentence/paragraph immediately after the heading and stop right before the next heading (or end of document). Carry text across page breaks when the section continues.
    - Keep section boundaries clean: do **not** borrow bullet items, paragraphs, or closing statements from the previous or next section.
    - Rewrite bullet lists as full declarative sentences with terminal punctuation and separate them with newlines; leave them in place inside the section narrative. Do **not** drop or paraphrase these sentences, and do **not** retain leading bullet glyphs (no `-`/`•` prefixes).
    - Preserve the original order of sentences; include concluding guidance or cross-references that follow the bullet list before the next heading.
    - Set `page_end` to the last page on which the section appears; ensure `page_end` > `page_start` when the section spans multiple pages.
    - Exclude repeating headers/footers, page numbers, and contact blocks that reoccur on every page.
    - When a heading introduces a figure or table, include only the accompanying narrative sentences; do not inject the table rows themselves into the section text.
7. **Registrations, Key Benefits, Applications, Formulation Data, Toxicity Data**:
    - Convert bullet lists into arrays of plain strings or structured objects per the schema.
    - Remove bullet symbols, numbering, and citation placeholders when copying text.
    - When copying bullet-derived text into narrative fields (e.g., `applications_text`, `sections[*].text`), rewrite them as full sentences with terminal punctuation and keep them contiguous with the surrounding prose.
    - Do **not** drop supporting narrative sentences that appear after the bullet list (e.g., handling guidance or callouts that remain in the same section).
    - Populate `toxicity_data` whenever the PDF states skin/eye irritation, corrosivity, inhalation hazards, etc.; never leave it empty when such statements are present, and preserve the routes exactly as printed (e.g., `Dermal`, `Ocular`).
    - Copy toxicity `metric` and `value` strings verbatim (e.g., "Skin irritation" / "Primary skin irritant"); avoid paraphrasing or generic placeholders.
    - Only create toxicity rows for hazards explicitly stated in the PDF; do **not** infer additional rows from generic safety advice (e.g., "use adequate ventilation").
    - Keep `properties_and_specifications[*].category` within the allowed schema enum (e.g., "Typical", "Specification", "Other", "Regulatory", etc.); do not invent new category labels.
    - Ensure `applications_text` mirrors the full Applications section: retain every bullet item rewritten as sentences inside the same paragraph block (no truncation after the introductory paragraph, no bullet glyphs), and include the concluding sentences that follow the list even if the section spans multiple pages.
    - Ensure `applications` lists every application mentioned in the PDF (each bullet or sentence becomes its own array item). Do **not** omit entries like pipe applications, and do **not** invent additional applications beyond what is printed.
    - When copying toxicity statements, keep separate records for each route (e.g., Skin vs Eye) and copy the exact metric/value text from the PDF. Do **not** merge routes into a single entry or paraphrase the hazard wording.
8. **Images**:
    - For each relevant diagram (chemical structures, flow charts, charts/graphs, etc.), add an entry with `type`, `caption`, `page`, and `image_path`.
    - Reuse the exact processed path pattern `${paths.processed_images_root}/<PDF filename without extension>/<image filename>`.
    - Provide a descriptive `filename` using the pattern `<PDF filename without extension>_<short_slug>.png` (replace spaces with underscores, keep alphanumeric/underscore only). Choose a slug that reflects the content (e.g., `Tg_vs_phr`).
    - Preserve axis labels and units exactly as shown in the PDF; if a unit appears in the label (e.g., `phr ECA 100KA`), keep it both in `label` and `unit` when appropriate.
9. **Document Footnotes**:
   - Map only document-level footnotes (e.g., general references or disclaimers).
   - Table-specific footnotes should be captured in the relevant table row `notes` field.
10. **Toxicology rows**:
    - Provide one entry per species/route combination; avoid combining multiple routes in a single record.
    - If the PDF mentions skin/eye irritation, corrosivity, inhalation hazards, etc., create corresponding rows rather than leaving the list empty.
11. **Extraction Metadata**:
    - Set `extractor_version` to `${extraction.extractor_version}` if provided in constants.
    - Leave `extraction_date` null (the post-processing pipeline will fill this).
12. **Confidence scores**:
   - Provide numeric confidence (0–100) for each major section in `extraction_metadata.confidence_scores` (see scaffold). Use `null` only if the section is not present in the PDF.
13. **Placeholders**:
   - Use `${paths.raw_pdfs_root}`, `${paths.processed_pdfs_root}`, and `${paths.processed_images_root}` for path fields so the ingest utility can resolve them.
14. **Product Info Specifics**:
    - Only list true alternate names (trade names, chemical aliases) in `product_info.synonyms`; omit marketing slogans or descriptive phrases.
    - If the PDF provides chemical abbreviations (e.g., `MHHPA`), include them in `synonyms`.
15. **Schema Discipline**:
    - Always conform to the provided JSON schema. Do not add fields that the schema does not allow, and do not alter the expected data shapes or key names.
    - Leave pipeline-owned fields (`doc_id`, `document_file_metadata`, `source_file_hash`, `filepath`, `source_filepath`, `extraction_metadata.extraction_date`) as `null` or schema-specified placeholders unless the PDF itself supplies a value. Do **not** fabricate placeholder UUIDs or filesystem paths to satisfy post-processing scripts—the pipeline will populate these later.

Output structure (YAML):
```yaml
doc_id: null  # leave null; ingest step supplies UUID
filename: <exact PDF filename>
source_filepath: ${paths.raw_pdfs_root}/<filename>  # keep placeholder; pipeline resolves actual path
filepath: ${paths.processed_pdfs_root}/<filename>  # keep placeholder; pipeline resolves actual path
document_file_metadata: null  # remain null; metadata is injected downstream
source_file_hash: null  # remain null; hashing occurs in post-processing
document_type: ${defaults.document_type}
manufacturer: <string>
contact_info:
  address: <string or null>
  phone: <string or null>
  fax: <string or null>
  email: <string or null>
has_images: false
product_info:
  product_name: <string>
  product_short_name: <string or null>
  product_family: <string or null>
  cas_number: <string or null>
  chemical_name: <string or null>
  synonyms:
    - <string>  # true alternate names only
registrations:
  - authority: <string>
    jurisdiction: <string or null>
    registration_number: <string or null>
    registration_name: <string or null>
    cas_number: <string or null>
    status: <string or null>
    effective_date: <string or null>
    notes: <string or null>
key_benefits:
  - <string>
applications_text: |
  ...  # include the complete narrative for the Applications section, start to end and across page breaks if necessary, including sentences following any bullet list
applications:
  - <string>
properties_and_specifications:
  - category: <string>
    name: <string>
    unit: <string or null>
    value_string: <string or null>
    value_min: <number or null>
    value_max: <number or null>
    value_numeric: <number or null>  # set to null for ranges, tolerances, or textual qualifiers
    test_method: <string or null>
    notes: <string or null>
typical_properties:
  table_name: "Typical Properties"
  page: <int>
  data_type: typical_properties
  description: <string>  # summarize the table purpose using nearby text when no caption is printed
  row_count: <int>
  data:
    - name: <string>
      unit: <string or null>
      value_string: <string or null>
      value_min: <number or null>
      value_max: <number or null>
      value_numeric: <number or null>
      test_method: <string or null>
  table_notes:
    - label: "1"
      text: <string>  # capture table-level notes like "Shyodu Hot Pot (100g at 100°C)"
      applies_to: column
      target: <column name or null>
epoxy_resin_properties: null  # or structured object if present
other_tables:
  - table_name: <string>
    page: <int>
    data_type: <string>
    description: <string>  # write a brief, context-driven caption even if the PDF omits one
    row_count: <int>
    data:
      - key_1: value
        key_2: value
        notes: <string or null>
    table_notes:
      - label: "1"
        text: <string>  # include every printed footnote for formulations and other tables
        applies_to: table
        target: null
    # do not include the "Typical Properties" table here
formulation_data:
  - formulation_name: <string or null>
    epoxy_type: <string or null>
    curing_agent: <string or null>
    phr: <number or null>
    properties:
      - name: <string>
        unit: <string or null>
        value: <string or number or null>
    notes: <string or null>  # carry over gel method, cure schedule, DSC analysis, etc.
toxicity_data:
  - metric: <string>
    species: <string or null>
    route: <string or null>
    value: <number or string or null>
    unit: <string or null>
    test_method: <string or null>
    conditions: <string or null>
    page: <int or null>
    source_text: <string or null>  # capture the exact sentence supporting the toxicity claim; never leave this array empty when the PDF mentions hazards
sections:
  - name: <string>
    page: <int>  # mirror page_start for backward compatibility
    page_start: <int>
    page_end: <int>
    text: |
      ...
images:
  - filename: <string>
    image_path: ${paths.processed_images_root}/<PDF filename without extension>/<filename>  # keep this placeholder-based path; do not invent new directories
    page: <int>
    type: graph
    description: <string>
    title: <string or null>
    x_axis:
      label: <string>
      unit: <string or null>
    y_axis:
      label: <string>
      unit: <string or null>
    graph_data:
      - x: <number>
        y: <number>
    notes: <string or null>
document_footnotes:
  "(1)": <string>
extraction_metadata:
  extractor_version: ${extraction.extractor_version}
  extraction_date: null  # leave null; pipeline stamps run time
  extraction_report: null  # optional short summary of what was extracted and any issues to review
  confidence_scores:
    product_info: <number or null>
    key_benefits: <number or null>
    applications_text: <number or null>
    applications: <number or null>
    properties_and_specifications: <number or null>
    typical_properties: <number or null>
    epoxy_resin_properties: <number or null>
    other_tables: <number or null>
    formulation_data: <number or null>
    toxicity_data: <number or null>
    sections: <number or null>
    images: <number or null>
    registrations: <number or null>
    document_footnotes: <number or null>
    overall: <number or null>
```

Return **only** the YAML block with no additional commentary.
```
