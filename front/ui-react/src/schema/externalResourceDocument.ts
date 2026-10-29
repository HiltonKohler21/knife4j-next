import { parseAllDocuments } from 'yaml';
import { stableSerializeJson } from '../utils/stableJson';
import { ResourceLoadError, type FetchedExternalResource } from './externalResourcePolicy';

type JsonRecord = Record<string, unknown>;

/** Limits for parsing one document, independent of graph traversal. */
export interface ResourceDocumentLimits {
  maxParsedNodesPerDocument: number;
  maxDepth: number;
  maxYamlAliases: number;
}

class StrictJsonParser {
  private index = 0;
  private nodes = 0;

  public constructor(
    private readonly source: string,
    private readonly maxNodes: number,
    private readonly maxDepth: number,
  ) {}

  public parse(): { value: unknown; nodes: number } {
    this.skipWhitespace();
    const value = this.parseValue(0);
    this.skipWhitespace();
    if (this.index !== this.source.length) this.fail('Trailing JSON content is not allowed.');
    return { value, nodes: this.nodes };
  }

  private parseValue(depth: number): unknown {
    this.reserveNode(depth);
    const token = this.source[this.index];
    if (token === '{') return this.parseObject(depth);
    if (token === '[') return this.parseArray(depth);
    if (token === '"') return this.parseString();
    if (token === 't' && this.source.startsWith('true', this.index)) {
      this.index += 4;
      return true;
    }
    if (token === 'f' && this.source.startsWith('false', this.index)) {
      this.index += 5;
      return false;
    }
    if (token === 'n' && this.source.startsWith('null', this.index)) {
      this.index += 4;
      return null;
    }
    return this.parseNumber();
  }

  private parseObject(depth: number): JsonRecord {
    this.index += 1;
    this.skipWhitespace();
    const result = Object.create(null) as JsonRecord;
    const keys = new Set<string>();
    if (this.source[this.index] === '}') {
      this.index += 1;
      return result;
    }
    for (;;) {
      if (this.source[this.index] !== '"') this.fail('JSON object keys must be strings.');
      const key = this.parseString();
      if (keys.has(key)) this.fail('Duplicate JSON object keys are not allowed.');
      keys.add(key);
      this.skipWhitespace();
      if (this.source[this.index] !== ':') this.fail("Expected ':' after a JSON object key.");
      this.index += 1;
      this.skipWhitespace();
      result[key] = this.parseValue(depth + 1);
      this.skipWhitespace();
      const separator = this.source[this.index];
      if (separator === '}') {
        this.index += 1;
        return result;
      }
      if (separator !== ',') this.fail("Expected ',' or '}' in a JSON object.");
      this.index += 1;
      this.skipWhitespace();
    }
  }

  private parseArray(depth: number): unknown[] {
    this.index += 1;
    this.skipWhitespace();
    const result: unknown[] = [];
    if (this.source[this.index] === ']') {
      this.index += 1;
      return result;
    }
    for (;;) {
      result.push(this.parseValue(depth + 1));
      this.skipWhitespace();
      const separator = this.source[this.index];
      if (separator === ']') {
        this.index += 1;
        return result;
      }
      if (separator !== ',') this.fail("Expected ',' or ']' in a JSON array.");
      this.index += 1;
      this.skipWhitespace();
    }
  }

  private parseString(): string {
    const start = this.index;
    this.index += 1;
    while (this.index < this.source.length) {
      const code = this.source.charCodeAt(this.index);
      if (code === 0x22) {
        this.index += 1;
        try {
          return JSON.parse(this.source.slice(start, this.index)) as string;
        } catch {
          this.fail('Invalid JSON string escape.');
        }
      }
      if (code < 0x20) this.fail('Unescaped control characters are not allowed in JSON strings.');
      if (code === 0x5c) {
        this.index += 1;
        const escape = this.source[this.index];
        if (escape === 'u') {
          const digits = this.source.slice(this.index + 1, this.index + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(digits)) this.fail('Invalid JSON unicode escape.');
          this.index += 5;
          continue;
        }
        if (!'"\\/bfnrt'.includes(escape ?? '')) this.fail('Invalid JSON string escape.');
      }
      this.index += 1;
    }
    this.fail('Unterminated JSON string.');
  }

  private parseNumber(): number {
    const token = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(this.source.slice(this.index))?.[0];
    if (!token) this.fail('Expected a JSON value.');
    this.index += token.length;
    const value = Number(token);
    if (!Number.isFinite(value)) this.fail('JSON numbers must be finite.');
    return value;
  }

  private reserveNode(depth: number): void {
    this.nodes += 1;
    if (this.nodes > this.maxNodes) {
      throw new ResourceLoadError('GRAPH_NODE_LIMIT', 'Parsed document node limit exceeded.', {
        limit: this.maxNodes,
        actual: this.nodes,
        scope: 'document',
      });
    }
    if (depth > this.maxDepth) {
      throw new ResourceLoadError('GRAPH_NODE_LIMIT', 'Parsed document depth limit exceeded.', {
        limit: this.maxDepth,
        actual: depth,
        scope: 'document-depth',
      });
    }
  }

  private skipWhitespace(): void {
    while (/[ \t\r\n]/.test(this.source[this.index] ?? '')) this.index += 1;
  }

  private fail(message: string): never {
    throw new ResourceLoadError('DOCUMENT_PARSE_FAILED', message);
  }
}

function freezeJsonValue<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value as Record<string, unknown>).forEach((nested) => freezeJsonValue(nested));
  return Object.freeze(value);
}

function cloneYamlValue(value: unknown, maxNodes: number, maxDepth: number): { value: unknown; nodes: number } {
  let nodes = 0;
  const ancestors = new Set<object>();
  const visit = (candidate: unknown, depth: number): unknown => {
    nodes += 1;
    if (nodes > maxNodes) {
      throw new ResourceLoadError('GRAPH_NODE_LIMIT', 'Parsed document node limit exceeded.', {
        limit: maxNodes,
        actual: nodes,
        scope: 'document',
      });
    }
    if (depth > maxDepth) {
      throw new ResourceLoadError('GRAPH_NODE_LIMIT', 'Parsed document depth limit exceeded.', {
        limit: maxDepth,
        actual: depth,
        scope: 'document-depth',
      });
    }
    if (candidate === null || typeof candidate === 'string' || typeof candidate === 'boolean') return candidate;
    if (typeof candidate === 'number') {
      if (!Number.isFinite(candidate)) throw new ResourceLoadError('DOCUMENT_PARSE_FAILED', 'Numbers must be finite.');
      return candidate;
    }
    if (typeof candidate !== 'object') {
      throw new ResourceLoadError(
        'DOCUMENT_PARSE_FAILED',
        'The YAML document is not compatible with the JSON data model.',
      );
    }
    if (ancestors.has(candidate)) {
      throw new ResourceLoadError('DOCUMENT_PARSE_FAILED', 'Cyclic YAML aliases are not allowed.');
    }
    ancestors.add(candidate);
    try {
      if (Array.isArray(candidate)) return candidate.map((item) => visit(item, depth + 1));
      if (!(candidate instanceof Map)) {
        throw new ResourceLoadError('DOCUMENT_PARSE_FAILED', 'The YAML document contains a non-JSON collection.');
      }
      const result = Object.create(null) as JsonRecord;
      for (const [key, nested] of candidate) {
        if (typeof key !== 'string') {
          throw new ResourceLoadError('DOCUMENT_PARSE_FAILED', 'YAML object keys must be strings.');
        }
        if (key === '<<') throw new ResourceLoadError('DOCUMENT_PARSE_FAILED', 'YAML merge keys are not allowed.');
        result[key] = visit(nested, depth + 1);
      }
      return result;
    } finally {
      ancestors.delete(candidate);
    }
  };
  return { value: visit(value, 0), nodes };
}

export function parseExternalResourceDocument(
  fetched: Pick<FetchedExternalResource, 'mediaType' | 'text'>,
  limits: ResourceDocumentLimits,
): { document: unknown; nodes: number } {
  if (fetched.mediaType.format === 'json') {
    const parsed = new StrictJsonParser(fetched.text, limits.maxParsedNodesPerDocument, limits.maxDepth).parse();
    return { document: freezeJsonValue(parsed.value), nodes: parsed.nodes };
  }

  let documents;
  try {
    documents = parseAllDocuments(fetched.text, {
      version: '1.2',
      // YAML 1.2 core keeps ordinary unquoted OpenAPI strings usable while
      // excluding YAML 1.1 object-producing tags; the JSON-model clone below
      // rejects every remaining non-string key, merge, cycle, and non-finite value.
      schema: 'core',
      customTags: [],
      merge: false,
      resolveKnownTags: false,
      strict: true,
      uniqueKeys: true,
      stringKeys: true,
      prettyErrors: false,
      logLevel: 'silent',
    });
  } catch (error) {
    throw new ResourceLoadError(
      'DOCUMENT_PARSE_FAILED',
      'Unable to safely parse the complete YAML document.',
      {},
      error,
    );
  }
  if (documents.length !== 1) {
    throw new ResourceLoadError('DOCUMENT_PARSE_FAILED', 'A YAML resource must contain exactly one complete document.');
  }
  const document = documents[0];
  if (document.errors.length > 0) {
    throw new ResourceLoadError(
      'DOCUMENT_PARSE_FAILED',
      'Unable to safely parse the complete YAML document.',
      {},
      document.errors[0],
    );
  }
  if (document.warnings.length > 0) {
    throw new ResourceLoadError(
      'DOCUMENT_PARSE_FAILED',
      'The YAML document uses a tag or construct outside the safe YAML 1.2 profile.',
      {},
      document.warnings[0],
    );
  }
  let value: unknown;
  try {
    value = document.toJS({ mapAsMap: true, maxAliasCount: limits.maxYamlAliases });
  } catch (error) {
    throw new ResourceLoadError('DOCUMENT_PARSE_FAILED', 'Unable to safely expand YAML aliases.', {}, error);
  }
  const parsed = cloneYamlValue(value, limits.maxParsedNodesPerDocument, limits.maxDepth);
  return { document: freezeJsonValue(parsed.value), nodes: parsed.nodes };
}

export function cloneAndCountEntry(
  document: unknown,
  limits: Pick<ResourceDocumentLimits, 'maxParsedNodesPerDocument' | 'maxDepth'>,
): { document: unknown; nodes: number; text: string } {
  let text: string;
  try {
    text = stableSerializeJson(document);
  } catch (error) {
    throw new ResourceLoadError('DOCUMENT_PARSE_FAILED', 'The entry document is not valid JSON data.', {}, error);
  }
  const parsed = new StrictJsonParser(text, limits.maxParsedNodesPerDocument, limits.maxDepth).parse();
  return { document: freezeJsonValue(parsed.value), nodes: parsed.nodes, text };
}
