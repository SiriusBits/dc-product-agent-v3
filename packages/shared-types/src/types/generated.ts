/* eslint-disable */
/**
 * AUTO-GENERATED — DO NOT EDIT
 * Source: packages/shared-schemas/src/schemas/*.schema.json
 * Run `pnpm generate` in packages/shared-types/ to regenerate.
 */
// ── base-technical-bulletin-with-defs.described.schema.json ─────
/**
 * Structured address/phone/fax/email block for the manufacturer.
 */
export type ContactInfo = {
  address?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
} & ({
  address?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
} | null);
/**
 * Named text block with page metadata and content.
 */
export type Section = {
  [k: string]: unknown | undefined;
} & {
  name: string;
  /**
   * First page containing the section (legacy field; prefer page_start/page_end).
   */
  page?: number | null;
  /**
   * First page number (inclusive) where the section appears.
   */
  page_start?: number | null;
  /**
   * Last page number (inclusive) where the section appears. Use the same value as page_start when single-page.
   */
  page_end?: number | null;
  text: string;
};
/**
 * Cropped image metadata; when type=graph, x_axis, y_axis, and graph_data are required.
 */
export type Image = {
  [k: string]: unknown | undefined;
} & {
  filename: string;
  page: number;
  type: "graph" | "structure" | "image";
  description: string;
  /**
   * Relative or absolute path to the extracted image asset.
   */
  image_path?: string | null;
  title?: string | null;
  x_axis?: Axis;
  y_axis?: Axis;
  graph_data?: GraphPoint[] | null;
  /**
   * Optional notes field for additional information about the image.
   */
  notes?: string | {} | null;
};

/**
 * Source-of-truth extraction from the technical bulletin PDF.
 */
export interface BaseTechnicalBulletinExtractionSchema {
  /**
   * UUID that uniquely identifies this bulletin; also used to join to derived/KG data.
   */
  doc_id: string;
  /**
   * The name of the source PDF file.
   */
  filename: string;
  /**
   * Original filesystem or object-store path (if available).
   */
  source_filepath: string | null;
  /**
   * Processed/canonical path within your pipeline (if available).
   */
  filepath: string | null;
  /**
   * Metadata extracted directly from the source PDF file.
   */
  document_file_metadata: {
    /**
     * Title of the document; fall back to the raw PDF filename when blank.
     */
    document_title: string;
    /**
     * Author names parsed from metadata (comma separated in source).
     */
    author?: string[];
    /**
     * Author titles parsed from metadata (aligned by index with authors).
     */
    author_title?: string[];
    /**
     * Narrative description of the document from metadata.
     */
    description?: string;
    /**
     * Names of description writers parsed from metadata (comma separated in source).
     */
    description_writer?: string[];
    /**
     * Keywords or phrases from the document metadata.
     */
    keywords?: string[];
    /**
     * Copyright status pulled from metadata; defaults to 'Unknown' when absent.
     */
    copyright_status: "Unknown" | "Copyrighted" | "Public Domain";
    /**
     * Copyright notice text captured from the document metadata.
     */
    copyright_notice?: string;
    /**
     * URL pointing to copyright information for the document.
     */
    copyright_info?: string;
    /**
     * Creation date/time of the document (e.g., '4/24/25, 3:18:06 PM UTC').
     */
    created?: string;
    /**
     * Last modified date/time of the document (e.g., '4/24/25, 3:18:06 PM UTC').
     */
    modified?: string;
    /**
     * Application used to author the document (e.g., 'Microsoft® Word for Microsoft 365').
     */
    application?: string;
    /**
     * Advanced PDF attributes including page counts and optimization flags.
     */
    advanced: {
      /**
       * Application noted as the PDF producer (e.g., Acrobat Distiller).
       */
      pdf_producer?: string;
      /**
       * PDF version string (e.g., '1.7 (Acrobat 8.x)').
       */
      pdf_version?: string;
      /**
       * Absolute path to the source PDF on disk.
       */
      location?: string;
      /**
       * Human-readable file size including bytes (e.g., '454.42 KB (465,327 Bytes)').
       */
      file_size?: string;
      /**
       * Document page size description (e.g., '8.50 x 11.00 in').
       */
      page_size?: string;
      /**
       * Total number of pages in the PDF.
       */
      number_of_pages: number;
      /**
       * Indicates whether the PDF is tagged.
       */
      tagged_pdf: "Yes" | "No";
      /**
       * Indicates if the PDF is optimized for fast web view.
       */
      fast_web_view: "Yes" | "No";
    };
  };
  /**
   * Integrity hashes (e.g., sha256) for the source artifact.
   */
  source_file_hash?: {
    sha256: string;
    [k: string]: string | undefined;
  } | null;
  /**
   * Document classification label, e.g., 'Product Technical Bulletin'.
   */
  document_type: string;
  /**
   * Company name as printed on the document.
   */
  manufacturer: string;
  contact_info: ContactInfo;
  /**
   * Indicates whether the source PDF contains any extracted images.
   */
  has_images?: boolean;
  /**
   * Product identity and naming details (name, family, CAS, etc.).
   */
  product_info: {
    /**
     * Canonical product name as used in the bulletin.
     */
    product_name: string;
    /**
     * Abbreviated name or code, if any.
     */
    product_short_name: string | null;
    /**
     * Higher-level family/category for grouping.
     */
    product_family?: string | null;
    /**
     * CAS Registry Number for the product/active ingredient.
     */
    cas_number?: string | null;
    /**
     * IUPAC or formal chemical name for the product.
     */
    chemical_name: string | null;
    /**
     * Alternate names/aliases to improve recall in search.
     */
    synonyms: string[];
  };
  /**
   * Regulatory registrations or compliance identifiers for the product.
   */
  registrations: Registration[];
  /**
   * Bulleted selling points captured as an array of strings.
   */
  key_benefits: string[];
  /**
   * Raw narrative text for the Applications section.
   */
  applications_text: string | null;
  /**
   * Normalized list of applications/uses for search and filtering.
   */
  applications: string[];
  /**
   * Flattened, sortable rows spanning Typical/Specification/Other categories.
   */
  properties_and_specifications: PropertySpecRow[];
  /**
   * Transposed data from the 'Properties of Liquid Epoxy Resins' table, with one property per row.
   */
  epoxy_resin_properties: {
    table_name: string;
    page: number;
    data_type: string;
    description: string;
    row_count: number;
    data: EpoxyResinRow[];
    /**
     * Optional notes field for additional information about the epoxy resin properties.
     */
    notes?: string | {} | null;
    table_notes?: TableNote[];
  } | null;
  /**
   * The original 'Typical Properties' table preserved in table form.
   */
  typical_properties: {
    table_name: string;
    page: number;
    data_type: string;
    description: string;
    row_count: number;
    data: {
      name: string;
      unit?: string | null;
      value_string?: string | null;
      value_min?: number | null;
      value_max?: number | null;
      value_numeric?: number | null;
      test_method?: string | null;
    }[];
    /**
     * Optional notes field for additional information about the typical properties.
     */
    notes?: string | {} | null;
    table_notes?: TableNote[];
  };
  /**
   * Any additional tables (e.g., Specifications, variants, studies) not covered by typical properties or epoxy resin properties, preserved in table form.
   */
  other_tables: {
    table_name: string;
    page: number;
    data_type: string;
    description: string;
    row_count: number;
    data: {}[];
    /**
     * Optional notes or footnote map for additional information about this table.
     */
    notes?: string | {} | null;
    table_notes?: TableNote[];
  }[];
  /**
   * Normalized formulation/performance rows (phr, viscosity, gel time, Tg, etc.).
   */
  formulation_data: FormulationRow[];
  /**
   * Structured toxicology metrics (LD50, irritation, Ames, etc.) with provenance.
   */
  toxicity_data: ToxicityRecord[];
  /**
   * Raw text sections by name with page anchors.
   */
  sections: {
    [k: string]: unknown | undefined;
  } & Section[];
  /**
   * Cropped graphics (graphs/structures/photos) with optional axis/points for graphs.
   */
  images: Image[];
  /**
   * Map of footnote keys to text as printed in the PDF.
   */
  document_footnotes: {
    [k: string]: string | undefined;
  };
  /**
   * Extractor version, date, and confidence scores by area.
   */
  extraction_metadata: {
    /**
     * Per-area confidence (e.g., tables, sections, graphs).
     */
    confidence_scores?: {
      product_info?: number | null;
      key_benefits?: number | null;
      applications_text?: number | null;
      applications?: number | null;
      properties_and_specifications?: number | null;
      typical_properties?: number | null;
      epoxy_resin_properties?: number | null;
      other_tables?: number | null;
      formulation_data?: number | null;
      toxicity_data?: number | null;
      sections?: number | null;
      images?: number | null;
      registrations?: number | null;
      document_footnotes?: number | null;
      /**
       * Confidence in the properties and specifications extraction.
       */
      properties?: number | null;
      overall?: number | null;
    };
    /**
     * Semantic/string version of the extractor used.
     */
    extractor_version: string;
    /**
     * RFC 3339 timestamp of when extraction occurred.
     */
    extraction_date: string;
    /**
     * Optional analyst/model notes summarizing what was extracted and any items requiring manual review.
     */
    extraction_report?: string | null;
  };
}
/**
 * Regulatory/compliance record with authority, jurisdiction, and optional ID.
 */
export interface Registration {
  authority: string;
  jurisdiction?: string | null;
  registration_number?: string | null;
  registration_name?: string | null;
  cas_number?: string | null;
  status?: string | null;
  effective_date?: string | null;
  notes?: string | null;
}
/**
 * Flattened property/spec row used for sorting/filtering across tables.
 */
export interface PropertySpecRow {
  category:
    | "Typical"
    | "Specification"
    | "Regulatory"
    | "Other"
    | "Physical"
    | "Chemical"
    | "Electrical"
    | "Thermal"
    | "Mechanical";
  name: string;
  unit?: string | null;
  value_string?: string | null;
  value_numeric?: number | null;
  value_min?: number | null;
  value_max?: number | null;
  test_method?: string | null;
  page?: number | null;
  notes?: string | null;
}
/**
 * A transposed row representing a single property for a specific epoxy resin under certain conditions.
 */
export interface EpoxyResinRow {
  /**
   * The name of the Dow Epoxy Resin (e.g., 'D.E.R. 332').
   */
  resin_name: string;
  /**
   * The name of the measured property (e.g., 'Average Epoxy Viscosity').
   */
  property_name: string;
  /**
   * The unit of measurement for the property (e.g., 'P', 'psi').
   */
  property_unit?: string | null;
  /**
   * The condition under which the property was measured (e.g., '@ 60 Hz', 'Condition A').
   */
  condition?: string | null;
  /**
   * The original value as a string, preserving original formatting.
   */
  value_string?: string | null;
  /**
   * The value as a parsed number, if applicable.
   */
  value_numeric?: number | null;
  /**
   * The minimum value if the original value represents a range.
   */
  value_min?: number | null;
  /**
   * The maximum value if the original value represents a range.
   */
  value_max?: number | null;
  /**
   * Flag indicating if this value is the minimum across all resins for this specific property and condition.
   */
  is_min?: boolean | null;
  /**
   * Flag indicating if this value is the maximum across all resins for this specific property and condition.
   */
  is_max?: boolean | null;
  /**
   * The ASTM or other test method used to determine the value.
   */
  test_method?: string | null;
}
export interface TableNote {
  /**
   * Identifier as printed in the table (e.g., '1', '*').
   */
  label: string;
  /**
   * Footnote text exactly as printed.
   */
  text: string;
  /**
   * Scope of the footnote.
   */
  applies_to?: "table" | "column" | "row";
  /**
   * Column name, row identifier, or null if it applies to the entire table.
   */
  target?: string | null;
}
/**
 * Normalized formulation/performance row (phr, viscosity, gel time, Tg, etc.).
 */
export interface FormulationRow {
  epoxy_type?: string | null;
  phr?: number | string | null;
  viscosity_at_25c_cp?: number | null;
  gel_time_min?: number | null;
  tg_c?: number | null;
  cure_schedule?: string | null;
  page?: number | null;
  source_table?: string | null;
  notes?: string | null;
  [k: string]: unknown | undefined;
}
/**
 * Toxicology datum with metric, value, units, route, and provenance.
 */
export interface ToxicityRecord {
  metric: string;
  species?: string | null;
  route?: string | null;
  value?: number | string | null;
  unit?: string | null;
  test_method?: string | null;
  conditions?: string | null;
  page?: number | null;
  source_text?: string | null;
}
/**
 * Axis label and optional unit for graph metadata.
 */
export interface Axis {
  label: string;
  unit?: string | null;
}
/**
 * Single (x, y) point for a graph series with optional series identification.
 */
export interface GraphPoint {
  x: number;
  y: number;
  /**
   * Optional series name for multi-series graphs
   */
  series?: string | null;
}

// ── base-technical-bulletin-llm.schema.json ─────────────────────
/**
 * Structured address/phone/fax/email block for the manufacturer.
 */
export type ContactInfo = {
  address?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
} & ({
  address?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
} | null);
/**
 * Named text block with page metadata and content.
 */
export type Section = {
  [k: string]: unknown | undefined;
} & {
  name: string;
  /**
   * First page containing the section (legacy field; prefer page_start/page_end).
   */
  page?: number | null;
  /**
   * First page number (inclusive) where the section appears.
   */
  page_start?: number | null;
  /**
   * Last page number (inclusive) where the section appears. Use the same value as page_start when single-page.
   */
  page_end?: number | null;
  text: string;
};
/**
 * Cropped image metadata; when type=graph, x_axis, y_axis, and graph_data are required.
 */
export type Image = {
  [k: string]: unknown | undefined;
} & {
  filename: string;
  page: number;
  type: "graph" | "structure" | "image";
  description: string;
  /**
   * Relative or absolute path to the extracted image asset.
   */
  image_path?: string | null;
  title?: string | null;
  x_axis?: Axis;
  y_axis?: Axis;
  graph_data?: GraphPoint[] | null;
  /**
   * Optional notes field for additional information about the image.
   */
  notes?: string | {} | null;
};

/**
 * Source-of-truth extraction from the technical bulletin PDF.
 */
export interface BaseTechnicalBulletinExtractionSchema {
  /**
   * UUID that uniquely identifies this bulletin; also used to join to derived/KG data.
   */
  doc_id?: string | null;
  /**
   * The name of the source PDF file.
   */
  filename: string;
  /**
   * Original filesystem or object-store path (if available).
   */
  source_filepath?: string | null;
  /**
   * Processed/canonical path within your pipeline (if available).
   */
  filepath?: string | null;
  /**
   * Metadata extracted directly from the source PDF file.
   */
  document_file_metadata?: {
    /**
     * Title of the document; fall back to the raw PDF filename when blank.
     */
    document_title: string;
    /**
     * Author names parsed from metadata (comma separated in source).
     */
    author?: string[];
    /**
     * Author titles parsed from metadata (aligned by index with authors).
     */
    author_title?: string[];
    /**
     * Narrative description of the document from metadata.
     */
    description?: string;
    /**
     * Names of description writers parsed from metadata (comma separated in source).
     */
    description_writer?: string[];
    /**
     * Keywords or phrases from the document metadata.
     */
    keywords?: string[];
    /**
     * Copyright status pulled from metadata; defaults to 'Unknown' when absent.
     */
    copyright_status: "Unknown" | "Copyrighted" | "Public Domain";
    /**
     * Copyright notice text captured from the document metadata.
     */
    copyright_notice?: string;
    /**
     * URL pointing to copyright information for the document.
     */
    copyright_info?: string;
    /**
     * Creation date/time of the document (e.g., '4/24/25, 3:18:06 PM UTC').
     */
    created?: string;
    /**
     * Last modified date/time of the document (e.g., '4/24/25, 3:18:06 PM UTC').
     */
    modified?: string;
    /**
     * Application used to author the document (e.g., 'Microsoft® Word for Microsoft 365').
     */
    application?: string;
    /**
     * Advanced PDF attributes including page counts and optimization flags.
     */
    advanced: {
      /**
       * Application noted as the PDF producer (e.g., Acrobat Distiller).
       */
      pdf_producer?: string;
      /**
       * PDF version string (e.g., '1.7 (Acrobat 8.x)').
       */
      pdf_version?: string;
      /**
       * Absolute path to the source PDF on disk.
       */
      location?: string;
      /**
       * Human-readable file size including bytes (e.g., '454.42 KB (465,327 Bytes)').
       */
      file_size?: string;
      /**
       * Document page size description (e.g., '8.50 x 11.00 in').
       */
      page_size?: string;
      /**
       * Total number of pages in the PDF.
       */
      number_of_pages: number;
      /**
       * Indicates whether the PDF is tagged.
       */
      tagged_pdf: "Yes" | "No";
      /**
       * Indicates if the PDF is optimized for fast web view.
       */
      fast_web_view: "Yes" | "No";
    };
  } | null;
  /**
   * Integrity hashes (e.g., sha256) for the source artifact.
   */
  source_file_hash?: {
    sha256: string;
    [k: string]: string | undefined;
  } | null;
  /**
   * Document classification label, e.g., 'Product Technical Bulletin'.
   */
  document_type: string;
  /**
   * Company name as printed on the document.
   */
  manufacturer: string;
  contact_info: ContactInfo;
  /**
   * Indicates whether the source PDF contains any extracted images.
   */
  has_images?: boolean;
  /**
   * Product identity and naming details (name, family, CAS, etc.).
   */
  product_info: {
    /**
     * Canonical product name as used in the bulletin.
     */
    product_name: string;
    /**
     * Abbreviated name or code, if any.
     */
    product_short_name: string | null;
    /**
     * Higher-level family/category for grouping.
     */
    product_family?: string | null;
    /**
     * CAS Registry Number for the product/active ingredient.
     */
    cas_number?: string | null;
    /**
     * IUPAC or formal chemical name for the product.
     */
    chemical_name: string | null;
    /**
     * Alternate names/aliases to improve recall in search.
     */
    synonyms: string[];
  };
  /**
   * Regulatory registrations or compliance identifiers for the product.
   */
  registrations: Registration[];
  /**
   * Bulleted selling points captured as an array of strings.
   */
  key_benefits: string[];
  /**
   * Raw narrative text for the Applications section.
   */
  applications_text: string | null;
  /**
   * Normalized list of applications/uses for search and filtering.
   */
  applications: string[];
  /**
   * Flattened, sortable rows spanning Typical/Specification/Other categories.
   */
  properties_and_specifications: PropertySpecRow[];
  /**
   * Transposed data from the 'Properties of Liquid Epoxy Resins' table, with one property per row.
   */
  epoxy_resin_properties: {
    table_name: string;
    page: number;
    data_type: string;
    description: string;
    row_count: number;
    data: EpoxyResinRow[];
    /**
     * Optional notes field for additional information about the epoxy resin properties.
     */
    notes?: string | {} | null;
    table_notes?: TableNote[];
  } | null;
  /**
   * The original 'Typical Properties' table preserved in table form.
   */
  typical_properties: {
    table_name: string;
    page: number;
    data_type: string;
    description: string;
    row_count: number;
    data: {
      name: string;
      unit?: string | null;
      value_string?: string | null;
      value_min?: number | null;
      value_max?: number | null;
      value_numeric?: number | null;
      test_method?: string | null;
    }[];
    /**
     * Optional notes field for additional information about the typical properties.
     */
    notes?: string | {} | null;
    table_notes?: TableNote[];
  };
  /**
   * Any additional tables (e.g., Specifications, variants, studies) not covered by typical properties or epoxy resin properties, preserved in table form.
   */
  other_tables: {
    table_name: string;
    page: number;
    data_type: string;
    description: string;
    row_count: number;
    data: {}[];
    /**
     * Optional notes or footnote map for additional information about this table.
     */
    notes?: string | {} | null;
    table_notes?: TableNote[];
  }[];
  /**
   * Normalized formulation/performance rows (phr, viscosity, gel time, Tg, etc.).
   */
  formulation_data: FormulationRow[];
  /**
   * Structured toxicology metrics (LD50, irritation, Ames, etc.) with provenance.
   */
  toxicity_data: ToxicityRecord[];
  /**
   * Raw text sections by name with page anchors.
   */
  sections: {
    [k: string]: unknown | undefined;
  } & Section[];
  /**
   * Cropped graphics (graphs/structures/photos) with optional axis/points for graphs.
   */
  images: Image[];
  /**
   * Map of footnote keys to text as printed in the PDF.
   */
  document_footnotes: {
    [k: string]: string | undefined;
  };
  /**
   * Extractor version, date, and confidence scores by area.
   */
  extraction_metadata: {
    /**
     * Per-area confidence (e.g., tables, sections, graphs).
     */
    confidence_scores?: {
      product_info?: number | null;
      key_benefits?: number | null;
      applications_text?: number | null;
      applications?: number | null;
      properties_and_specifications?: number | null;
      typical_properties?: number | null;
      epoxy_resin_properties?: number | null;
      other_tables?: number | null;
      formulation_data?: number | null;
      toxicity_data?: number | null;
      sections?: number | null;
      images?: number | null;
      registrations?: number | null;
      document_footnotes?: number | null;
      /**
       * Confidence in the properties and specifications extraction.
       */
      properties?: number | null;
      overall?: number | null;
    };
    /**
     * Semantic/string version of the extractor used.
     */
    extractor_version: string;
    /**
     * RFC 3339 timestamp of when extraction occurred.
     */
    extraction_date: string | null;
    /**
     * Optional analyst/model notes summarizing what was extracted and any items requiring manual review.
     */
    extraction_report?: string | null;
  };
}
/**
 * Regulatory/compliance record with authority, jurisdiction, and optional ID.
 */
export interface Registration {
  authority: string;
  jurisdiction?: string | null;
  registration_number?: string | null;
  registration_name?: string | null;
  cas_number?: string | null;
  status?: string | null;
  effective_date?: string | null;
  notes?: string | null;
}
/**
 * Flattened property/spec row used for sorting/filtering across tables.
 */
export interface PropertySpecRow {
  category:
    | "Typical"
    | "Specification"
    | "Regulatory"
    | "Other"
    | "Physical"
    | "Chemical"
    | "Electrical"
    | "Thermal"
    | "Mechanical";
  name: string;
  unit?: string | null;
  value_string?: string | null;
  value_numeric?: number | null;
  value_min?: number | null;
  value_max?: number | null;
  test_method?: string | null;
  page?: number | null;
  notes?: string | null;
}
/**
 * A transposed row representing a single property for a specific epoxy resin under certain conditions.
 */
export interface EpoxyResinRow {
  /**
   * The name of the Dow Epoxy Resin (e.g., 'D.E.R. 332').
   */
  resin_name: string;
  /**
   * The name of the measured property (e.g., 'Average Epoxy Viscosity').
   */
  property_name: string;
  /**
   * The unit of measurement for the property (e.g., 'P', 'psi').
   */
  property_unit?: string | null;
  /**
   * The condition under which the property was measured (e.g., '@ 60 Hz', 'Condition A').
   */
  condition?: string | null;
  /**
   * The original value as a string, preserving original formatting.
   */
  value_string?: string | null;
  /**
   * The value as a parsed number, if applicable.
   */
  value_numeric?: number | null;
  /**
   * The minimum value if the original value represents a range.
   */
  value_min?: number | null;
  /**
   * The maximum value if the original value represents a range.
   */
  value_max?: number | null;
  /**
   * Flag indicating if this value is the minimum across all resins for this specific property and condition.
   */
  is_min?: boolean | null;
  /**
   * Flag indicating if this value is the maximum across all resins for this specific property and condition.
   */
  is_max?: boolean | null;
  /**
   * The ASTM or other test method used to determine the value.
   */
  test_method?: string | null;
}
export interface TableNote {
  /**
   * Identifier as printed in the table (e.g., '1', '*').
   */
  label: string;
  /**
   * Footnote text exactly as printed.
   */
  text: string;
  /**
   * Scope of the footnote.
   */
  applies_to?: "table" | "column" | "row";
  /**
   * Column name, row identifier, or null if it applies to the entire table.
   */
  target?: string | null;
}
/**
 * Normalized formulation/performance row (phr, viscosity, gel time, Tg, etc.).
 */
export interface FormulationRow {
  epoxy_type?: string | null;
  phr?: number | string | null;
  viscosity_at_25c_cp?: number | null;
  gel_time_min?: number | null;
  tg_c?: number | null;
  cure_schedule?: string | null;
  page?: number | null;
  source_table?: string | null;
  notes?: string | null;
  [k: string]: unknown | undefined;
}
/**
 * Toxicology datum with metric, value, units, route, and provenance.
 */
export interface ToxicityRecord {
  metric: string;
  species?: string | null;
  route?: string | null;
  value?: number | string | null;
  unit?: string | null;
  test_method?: string | null;
  conditions?: string | null;
  page?: number | null;
  source_text?: string | null;
}
/**
 * Axis label and optional unit for graph metadata.
 */
export interface Axis {
  label: string;
  unit?: string | null;
}
/**
 * Single (x, y) point for a graph series with optional series identification.
 */
export interface GraphPoint {
  x: number;
  y: number;
  /**
   * Optional series name for multi-series graphs
   */
  series?: string | null;
}

// ── derived-info-with-knowledge-graph-with-defs.described.schema.json 
/**
 * Derived analysis layer plus knowledge graph built on top of the base extraction.
 */
export interface DerivedInformationKnowledgeGraphSchemaIDsRequired {
  /**
   * Same UUID as the base document; join key between layers.
   */
  doc_id: string;
  /**
   * The name of the source PDF file.
   */
  filename?: string;
  /**
   * Original or canonical path to the related PDF (optional).
   */
  filepath?: string | null;
  /**
   * Document classification label, e.g., 'Product Technical Bulletin'. Carried forward from the base extraction.
   */
  document_type?: string;
  /**
   * Extractor version, date, and confidence scores by area.
   */
  extraction_metadata?: {
    /**
     * Per-area confidence (e.g., summary, personas, KG).
     */
    confidence_scores?: {
      [k: string]: number | undefined;
    };
    /**
     * Semantic/string version of the extractor used.
     */
    extractor_version: string;
    /**
     * RFC 3339 timestamp of when extraction occurred.
     */
    extraction_date: string;
  };
  /**
   * Summaries and persona-specific blurbs derived from the bulletin.
   */
  derived_info: {
    /**
     * Concise product synopsis combining high-level sales + technical context.
     */
    summary?: string;
    /**
     * Audience-targeted summaries (sales vs technical).
     */
    personas?: {
      /**
       * Short pitch for sales users (value props, where it wins).
       */
      sales_summary: string;
      /**
       * Short technical digest for engineers (properties, performance, caveats).
       */
      technical_summary: string;
    };
    /**
     * Key applications distilled to unique values.
     */
    key_applications?: string[];
  };
  /**
   * Entities and triples representing structured relationships.
   */
  knowledge_graph: {
    /**
     * Typed, deduplicated entities with IDs, canonical names, provenance, and metadata. Must contain at least one entity (typically a PRODUCT_NAME).
     *
     * @minItems 1
     */
    entities: [Entity, ...Entity[]];
    /**
     * Subject–predicate–object facts; objects may be entity refs or property/value pairs.
     */
    kg_triples: Triple[];
  };
}
/**
 * Knowledge graph node with id, text, type, canonical_name, aliases, provenance, metadata.
 */
export interface Entity {
  id: string;
  text: string;
  type:
    | "CHEMICAL"
    | "PRODUCT_NAME"
    | "ORGANIZATION"
    | "APPLICATION"
    | "PROPERTY"
    | "CAS_NUMBER"
    | "CHEMICAL_CLASS"
    | "CHEMICAL_FUNCTION"
    | "TEST_METHOD"
    | "UNIT"
    | "HAZARD"
    | "REGISTRATION"
    | "BENEFIT"
    | "MATERIAL"
    | "DOCUMENT"
    | "LOCATION";
  canonical_name?: string | null;
  aliases?: string[];
  source_text: string;
  provenance?: Provenance;
  metadata?: {
    [k: string]: (string | number | boolean | null) | undefined;
  };
}
/**
 * Page, spans, and optional bbox anchoring an extracted item to the source.
 */
export interface Provenance {
  document_id?: string;
  page?: number;
  page_label?: string | null;
  spans?: ProvenanceSpan[];
  /**
   * @minItems 4
   * @maxItems 4
   */
  bbox?: [number, number, number, number];
}
/**
 * Character offsets into source_text that support an entity/triple.
 */
export interface ProvenanceSpan {
  start: number;
  end: number;
}
/**
 * Subject–predicate–object relation with source_text, optional provenance, and confidence.
 */
export interface Triple {
  /**
   * Reference to a triple subject (by entity_id, canonical_name, or raw string).
   */
  subject:
    | {
        entity_id: string;
      }
    | {
        canonical_name: string;
      }
    | string;
  predicate: string;
  /**
   * Reference to a triple object (entity ref, string, or property/value literal).
   */
  object:
    | {
        entity_id: string;
      }
    | {
        canonical_name: string;
      }
    | string
    | {
        property: string;
        value: string | number;
      };
  source_text: string;
  provenance?: Provenance;
  confidence?: number;
}

// ── kg-entity.schema.json ───────────────────────────────────────
/**
 * Standalone entity schema aligned with common-defs.described.schema.json#/$defs/entity.
 */
export interface KGEntity {
  id: string;
  text: string;
  type:
    | "CHEMICAL"
    | "PRODUCT_NAME"
    | "ORGANIZATION"
    | "APPLICATION"
    | "PROPERTY"
    | "CAS_NUMBER"
    | "CHEMICAL_CLASS"
    | "CHEMICAL_FUNCTION"
    | "TEST_METHOD"
    | "UNIT"
    | "HAZARD"
    | "REGISTRATION"
    | "BENEFIT"
    | "MATERIAL"
    | "DOCUMENT"
    | "LOCATION";
  canonical_name?: string | null;
  aliases?: string[];
  source_text: string;
  provenance?: {
    document_id?: string;
    page?: number | null;
  };
  metadata?: {
    [k: string]: (string | number | boolean | null) | undefined;
  };
}

// ── kg-triple.schema.json ───────────────────────────────────────
export interface KGTriple {
  subject: string | {};
  predicate: string;
  object: string | number | boolean | null | {};
  source_text?: string | null;
  provenance?: {
    document_id?: string;
    page?: number | null;
    [k: string]: unknown | undefined;
  };
  confidence?: number | null;
}

// ── chunk.schema.json ───────────────────────────────────────────
export interface EmbeddingChunkSchema {
  id: string;
  text: string;
  metadata: {
    doc_id: string;
    source: "base" | "derived";
    page?: number | null;
    node_path?: string | null;
    filename?: string | null;
    product_name?: string | null;
    [k: string]: unknown | undefined;
  };
}

