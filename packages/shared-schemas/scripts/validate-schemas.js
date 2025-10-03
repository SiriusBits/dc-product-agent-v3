#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

/**
 * Validate all JSON schema files in the schemas directory
 */
function validateSchemas() {
  const ajv = new Ajv({ 
    allErrors: true, 
    verbose: true,
    strict: false // Allow additional properties for flexibility
  });
  addFormats(ajv);

  const schemasDir = path.join(__dirname, '..', 'schemas');
  const schemaFiles = fs.readdirSync(schemasDir)
    .filter(file => file.endsWith('.schema.json'))
    .map(file => path.join(schemasDir, file));

  let hasErrors = false;

  console.log('Validating JSON schemas...\n');

  for (const schemaFile of schemaFiles) {
    const schemaName = path.basename(schemaFile);
    console.log(`Validating ${schemaName}...`);

    try {
      const schemaContent = fs.readFileSync(schemaFile, 'utf8');
      const schema = JSON.parse(schemaContent);

      // Validate that the schema itself is valid JSON Schema
      const isValid = ajv.validateSchema(schema);
      
      if (isValid) {
        console.log(`  ✓ ${schemaName} is valid`);
      } else {
        console.error(`  ✗ ${schemaName} is invalid:`);
        if (ajv.errors) {
          ajv.errors.forEach(error => {
            console.error(`    - ${error.instancePath}: ${error.message}`);
          });
        }
        hasErrors = true;
      }
    } catch (error) {
      console.error(`  ✗ ${schemaName} failed to parse: ${error.message}`);
      hasErrors = true;
    }
  }

  console.log(`\nValidation complete. Found ${schemaFiles.length} schema files.`);
  
  if (hasErrors) {
    console.error('Some schemas have validation errors.');
    process.exit(1);
  } else {
    console.log('All schemas are valid!');
  }
}

/**
 * Generate an index of all available schemas
 */
function generateSchemaIndex() {
  const schemasDir = path.join(__dirname, '..', 'schemas');
  const schemaFiles = fs.readdirSync(schemasDir)
    .filter(file => file.endsWith('.schema.json') && file !== 'index.json')
    .sort();

  const index = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "Shared Schemas Index",
    "description": "Index of all shared JSON schemas for Dixie Chemical Product Agent",
    "type": "object",
    "properties": {
      "schemas": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "file": { "type": "string" },
            "id": { "type": "string" },
            "title": { "type": "string" },
            "description": { "type": "string" }
          }
        }
      }
    },
    "schemas": []
  };

  // Read each schema file and extract metadata
  for (const file of schemaFiles) {
    const filePath = path.join(schemasDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const schema = JSON.parse(content);
      
      index.schemas.push({
        name: path.basename(file, '.schema.json'),
        file: file,
        id: schema.$id || '',
        title: schema.title || '',
        description: schema.description || ''
      });
    } catch (error) {
      console.warn(`Warning: Could not read schema ${file}: ${error.message}`);
    }
  }

  // Write the updated index
  const indexPath = path.join(schemasDir, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`Generated schema index with ${index.schemas.length} schemas.`);
}

// Run validation and generate index
if (require.main === module) {
  validateSchemas();
  generateSchemaIndex();
}

module.exports = {
  validateSchemas,
  generateSchemaIndex
};