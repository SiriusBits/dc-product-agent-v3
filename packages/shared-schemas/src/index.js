const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

/**
 * Schema loader and validator utility for shared schemas
 */
class SchemaLoader {
  constructor() {
    this.ajv = new Ajv({ 
      allErrors: true, 
      verbose: true,
      strict: false 
    });
    addFormats(this.ajv);
    this.schemas = new Map();
    this.loadAllSchemas();
  }

  /**
   * Load all schemas from the schemas directory
   */
  loadAllSchemas() {
    const schemasDir = path.join(__dirname, '..', 'schemas');
    const schemaFiles = fs.readdirSync(schemasDir)
      .filter(file => file.endsWith('.schema.json') && file !== 'index.json');

    for (const file of schemaFiles) {
      const filePath = path.join(schemasDir, file);
      const schemaContent = fs.readFileSync(filePath, 'utf8');
      const schema = JSON.parse(schemaContent);
      
      const schemaName = path.basename(file, '.schema.json');
      this.schemas.set(schemaName, schema);
      
      // Add to AJV for validation
      if (schema.$id) {
        this.ajv.addSchema(schema, schema.$id);
      }
      this.ajv.addSchema(schema, schemaName);
    }
  }

  /**
   * Get a schema by name
   * @param {string} schemaName - Name of the schema (without .schema.json extension)
   * @returns {object|null} The schema object or null if not found
   */
  getSchema(schemaName) {
    return this.schemas.get(schemaName) || null;
  }

  /**
   * Get all available schema names
   * @returns {string[]} Array of schema names
   */
  getSchemaNames() {
    return Array.from(this.schemas.keys());
  }

  /**
   * Validate data against a schema
   * @param {string} schemaName - Name of the schema to validate against
   * @param {any} data - Data to validate
   * @returns {object} Validation result with isValid boolean and errors array
   */
  validate(schemaName, data) {
    const schema = this.getSchema(schemaName);
    if (!schema) {
      return {
        isValid: false,
        errors: [`Schema '${schemaName}' not found`]
      };
    }

    const isValid = this.ajv.validate(schemaName, data);
    return {
      isValid,
      errors: isValid ? [] : (this.ajv.errors || []).map(error => ({
        instancePath: error.instancePath,
        schemaPath: error.schemaPath,
        keyword: error.keyword,
        params: error.params,
        message: error.message
      }))
    };
  }

  /**
   * Create a validator function for a specific schema
   * @param {string} schemaName - Name of the schema
   * @returns {function|null} Validator function or null if schema not found
   */
  createValidator(schemaName) {
    const schema = this.getSchema(schemaName);
    if (!schema) {
      return null;
    }

    const validateFn = this.ajv.compile(schema);
    return (data) => {
      const isValid = validateFn(data);
      return {
        isValid,
        errors: isValid ? [] : (validateFn.errors || []).map(error => ({
          instancePath: error.instancePath,
          schemaPath: error.schemaPath,
          keyword: error.keyword,
          params: error.params,
          message: error.message
        }))
      };
    };
  }
}

// Create singleton instance
const schemaLoader = new SchemaLoader();

module.exports = {
  SchemaLoader,
  schemaLoader,
  
  // Convenience functions
  getSchema: (name) => schemaLoader.getSchema(name),
  validate: (schemaName, data) => schemaLoader.validate(schemaName, data),
  createValidator: (schemaName) => schemaLoader.createValidator(schemaName),
  getSchemaNames: () => schemaLoader.getSchemaNames()
};