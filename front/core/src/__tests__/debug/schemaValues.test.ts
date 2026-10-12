import { buildSchemaFieldTree } from '../../debug/schemaExample';

describe('declared Schema enum/default display metadata', () => {
  const doc = { openapi: '3.0.3' };
  const ctx = { doc, maxDepth: 8 };

  test('preserves array and object root values without assigning them to child fields', () => {
    const array = { type: 'array', items: { type: 'integer' }, enum: [[1, 2], [3]], default: [1, 2] };
    expect(buildSchemaFieldTree(array, ctx)[0]).toMatchObject({
      isRoot: true,
      enum: array.enum,
      default: array.default,
    });
    const object = {
      type: 'object',
      properties: { enabled: { type: 'boolean' } },
      enum: [{ enabled: false }],
      default: { enabled: false },
    };
    const fields = buildSchemaFieldTree(object, ctx);
    expect(fields[0]).toMatchObject({ isRoot: true, enum: object.enum, default: object.default });
    expect(fields[1]).toMatchObject({ name: 'enabled' });
    expect(fields[1].default).toBeUndefined();
    expect(fields[1].enum).toBeUndefined();
  });

  test.each(['oneOf', 'anyOf'])(
    'preserves %s outer values at the root and nested fields without inferring a branch default',
    (keyword) => {
      const schema = { [keyword]: [{ type: 'string' }, { type: 'integer' }], enum: ['a', 0], default: 0 };
      expect(buildSchemaFieldTree(schema, ctx)[0]).toMatchObject({ isRoot: true, enum: ['a', 0], default: 0 });
      expect(buildSchemaFieldTree({ type: 'object', properties: { value: schema } }, ctx)[0]).toMatchObject({
        name: 'value',
        enum: ['a', 0],
        default: 0,
      });
      const branchOnly = {
        [keyword]: [
          { type: 'string', default: 'a' },
          { type: 'integer', default: 0 },
        ],
      };
      const [field] = buildSchemaFieldTree({ type: 'object', properties: { value: branchOnly } }, ctx);
      expect(field.default).toBeUndefined();
      expect(field.enum).toBeUndefined();
    },
  );
});
