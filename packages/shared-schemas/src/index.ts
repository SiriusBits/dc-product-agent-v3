import * as baseTechnicalBulletinSchema from './schemas/base-technical-bulletin-llm.schema.json';
import * as baseTechnicalBulletinWithDefsSchema from './schemas/base-technical-bulletin-with-defs.described.schema.json';
import * as chunkSchema from './schemas/chunk.schema.json';
import * as commonDefsSchema from './schemas/common-defs.described.schema.json';
import * as derivedInfoSchema from './schemas/derived-info-with-knowledge-graph-with-defs.described.schema.json';
import * as kgEntitySchema from './schemas/kg-entity.schema.json';
import * as kgTripleSchema from './schemas/kg-triple.schema.json';

export const schemas = {
    baseTechnicalBulletin: baseTechnicalBulletinSchema,
    baseTechnicalBulletinWithDefs: baseTechnicalBulletinWithDefsSchema,
    chunk: chunkSchema,
    commonDefs: commonDefsSchema,
    derivedInfo: derivedInfoSchema,
    kgEntity: kgEntitySchema,
    kgTriple: kgTripleSchema,
};
