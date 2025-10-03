// Data model types for Dixie Chemical Product Agent

// Document and PDF metadata types
export interface DocumentMetadata {
  doc_id: string | null;
  filename: string;
  source_filepath: string | null;
  filepath: string | null;
  document_file_metadata: DocumentFileMetadata | null;
  source_file_hash: FileHash | null;
  document_type: string;
  manufacturer: string;
  contact_info: ContactInfo;
  has_images: boolean;
  extraction_metadata: ExtractionMetadata;
}

export interface DocumentFileMetadata {
  document_title: string;
  author?: string[];
  author_title?: string[];
  description?: string;
  description_writer?: string[];
  keywords?: string[];
  copyright_status: 'Unknown' | 'Copyrighted' | 'Public Domain';
  copyright_notice?: string;
  copyright_info?: string;
  created?: string;
  modified?: string;
  application?: string;
  advanced: AdvancedPdfMetadata;
}

export interface AdvancedPdfMetadata {
  pdf_producer?: string;
  pdf_version?: string;
  location?: string;
  file_size?: string;
  page_size?: string;
  number_of_pages: number;
  tagged_pdf: 'Yes' | 'No';
  fast_web_view: 'Yes' | 'No';
}

export interface FileHash {
  sha256: string;
  [key: string]: string;
}

export interface ContactInfo {
  address?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
  website?: string | null;
}

export interface ExtractionMetadata {
  confidence_scores?: ConfidenceScores;
  extractor_version: string;
  extraction_date: string | null;
  extraction_report?: string | null;
}

export interface ConfidenceScores {
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
  overall?: number | null;
}

// Product information types
export interface ProductInfo {
  product_name: string;
  product_short_name: string | null;
  product_family: string | null;
  cas_number: string | null;
  chemical_name: string | null;
  synonyms: string[];
}

export interface Registration {
  type: string;
  number: string;
  authority: string;
  status?: string;
  notes?: string;
}

// Property and specification types
export interface PropertySpecification {
  category: string;
  name: string;
  value_string: string | null;
  value_numeric: number | null;
  value_min: number | null;
  value_max: number | null;
  unit: string | null;
  test_method: string | null;
  page: number | null;
}

export interface TypicalProperty {
  name: string;
  unit: string | null;
  value_string: string | null;
  value_min: number | null;
  value_max: number | null;
  value_numeric: number | null;
  test_method: string | null;
}

export interface TypicalPropertiesTable {
  table_name: string;
  page: number;
  data_type: string;
  description: string;
  row_count: number;
  data: TypicalProperty[];
  notes?: string | object | null;
  table_notes: TableNote[];
}

export interface EpoxyResinRow {
  resin_name: string;
  property_name: string;
  property_unit: string | null;
  condition: string | null;
  value_string: string | null;
  value_numeric: number | null;
  value_min: number | null;
  value_max: number | null;
  is_min: boolean | null;
  is_max: boolean | null;
  test_method: string | null;
}

export interface EpoxyResinProperties {
  table_name: string;
  page: number;
  data_type: string;
  description: string;
  row_count: number;
  data: EpoxyResinRow[];
  notes?: string | object | null;
  table_notes: TableNote[];
}

export interface TableNote {
  key: string;
  text: string;
}

export interface GenericTable {
  table_name: string;
  page: number;
  data_type: string;
  description: string;
  row_count: number;
  data: Record<string, any>[];
  table_notes: TableNote[];
}

// Formulation and toxicity data types
export interface FormulationRow {
  formulation_id: string;
  component_name: string;
  phr: number | null;
  weight_percent: number | null;
  notes?: string;
}

export interface ToxicityRecord {
  test_type: string;
  species: string | null;
  route: string | null;
  value: number | null;
  unit: string | null;
  classification: string | null;
  source: string | null;
}

// Document structure types
export interface DocumentSection {
  name: string;
  page: number;
  content: string;
  subsections?: DocumentSection[];
}

export interface DocumentImage {
  filename: string;
  page: number;
  description: string | null;
  image_type: 'graph' | 'structure' | 'photo' | 'diagram' | 'other';
  extracted_data?: ImageData | null;
}

export interface ImageData {
  axis_labels?: {
    x_axis?: string;
    y_axis?: string;
  };
  data_points?: DataPoint[];
  chemical_structure?: ChemicalStructure;
}

export interface DataPoint {
  x: number;
  y: number;
  label?: string;
}

export interface ChemicalStructure {
  smiles?: string;
  molecular_formula?: string;
  molecular_weight?: number;
}

// Complete base extraction document type
export interface BaseExtractionDocument {
  doc_id: string | null;
  filename: string;
  source_filepath: string | null;
  filepath: string | null;
  document_file_metadata: DocumentFileMetadata | null;
  source_file_hash: FileHash | null;
  document_type: string;
  manufacturer: string;
  contact_info: ContactInfo;
  has_images: boolean;
  product_info: ProductInfo;
  registrations: Registration[];
  key_benefits: string[];
  applications_text: string | null;
  applications: string[];
  properties_and_specifications: PropertySpecification[];
  epoxy_resin_properties: EpoxyResinProperties | null;
  typical_properties: TypicalPropertiesTable;
  other_tables: GenericTable[];
  formulation_data: FormulationRow[];
  toxicity_data: ToxicityRecord[];
  sections: DocumentSection[];
  images: DocumentImage[];
  document_footnotes: Record<string, string>;
  extraction_metadata: ExtractionMetadata;
}

// Knowledge Graph types
export interface KGEntity {
  id: string;
  text: string;
  type: string;
  canonical_name: string | null;
  aliases: string[];
  source_text: string | null;
  provenance: KGProvenance;
  metadata: Record<string, any>;
}

export interface KGTriple {
  subject: string | KGEntity;
  predicate: string;
  object: string | number | boolean | null | KGEntity;
  source_text: string | null;
  provenance: KGProvenance;
  confidence: number | null;
}

export interface KGProvenance {
  document_id: string;
  page: number | null;
  [key: string]: any;
}

export interface KnowledgeGraph {
  entities: KGEntity[];
  kg_triples: KGTriple[];
  metadata: Record<string, any>;
}

// Derived information types
export interface DerivedInfo {
  doc_id: string;
  knowledge_graph: KnowledgeGraph;
  enhanced_applications: EnhancedApplication[];
  property_relationships: PropertyRelationship[];
  competitive_analysis: CompetitiveAnalysis[];
  usage_recommendations: UsageRecommendation[];
}

export interface EnhancedApplication {
  application: string;
  confidence: number;
  supporting_properties: string[];
  market_segments: string[];
  technical_requirements: string[];
}

export interface PropertyRelationship {
  property_name: string;
  related_properties: string[];
  relationship_type: 'correlates_with' | 'affects' | 'depends_on' | 'inverse_of';
  strength: number;
}

export interface CompetitiveAnalysis {
  competitor_product: string;
  comparison_type: 'similar' | 'alternative' | 'superior' | 'inferior';
  key_differences: string[];
  advantages: string[];
  disadvantages: string[];
}

export interface UsageRecommendation {
  application: string;
  recommended_conditions: Record<string, any>;
  performance_expectations: Record<string, any>;
  formulation_guidelines: string[];
  safety_considerations: string[];
}