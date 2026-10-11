import { message } from 'antd';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { ExternalResourceContextValue } from '../../context/SchemaEngineContext';
import type { ResourceCandidate, ResourceDiagnostic, ResourceGraphNode } from '../../schema/externalResourceGraph';
import ExternalResourcePanel from './ExternalResourcePanel';

const context = vi.hoisted(() => ({ value: null as ExternalResourceContextValue | null }));
vi.mock('../../context/SchemaEngineContext', () => ({ useExternalResources: () => context.value }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function candidate(key: string, state: 'pending' | 'failed' = 'pending', retryable = false): ResourceCandidate {
  return {
    retrievalUri: `https://example.test/${key}.json`,
    retrievalUriHash: key,
    displayUri: `${key}.json`,
    sameOrigin: true,
    depth: 1,
    state,
    retryable,
    references: [],
  };
}

function diagnostic(target: string, sourcePointer: string): ResourceDiagnostic {
  return {
    code: 'RESOURCE_HTTP_STATUS',
    phase: 'fetch',
    sourceRetrievalUriHash: 'entry',
    sourcePointer,
    referenceKind: 'schema-ref',
    rawReferenceDisplay: `${target}.json`,
    resolutionBaseDisplay: 'entry.json',
    targetRetrievalUriHash: target,
    resourceDisplay: `${target}.json`,
    generation: 1,
    retryable: true,
  };
}

let root: Root;
let container: HTMLDivElement;
let resources: ExternalResourceContextValue;
beforeEach(() => {
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: false,
    media,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const computedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => computedStyle(element));
  resources = {
    status: 'pending',
    generation: 1,
    documentScope: 'entry',
    candidates: [candidate('first'), candidate('second')],
    diagnostics: [],
    snapshot: null,
    registrationError: null,
    loadOnce: vi.fn().mockResolvedValue(undefined),
    rememberAndLoad: vi.fn().mockResolvedValue(true),
    retry: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn(),
  };
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
    message.destroy();
  });
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function render() {
  context.value = resources;
  await act(async () => root.render(<ExternalResourcePanel />));
}

function button(text: string): HTMLButtonElement {
  const element = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (item) => item.textContent === text,
  );
  expect(element).toBeDefined();
  return element!;
}

async function click(element: HTMLElement) {
  await act(async () => element.click());
}

async function open() {
  await render();
  await click(button('resource.open'));
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());
}

function checkboxes() {
  return Array.from(document.querySelectorAll<HTMLInputElement>('[role="dialog"] input[type="checkbox"]'));
}

describe('external resource panel with real Ant Design controls', () => {
  test('requires explicit selection and sends only selected keys to loadOnce', async () => {
    resources = {
      ...resources,
      candidates: [{ ...candidate('first'), displayUri: '<img src=x onerror=alert(1)>' }, candidate('second')],
    };
    await open();
    expect(document.querySelector('[role="dialog"] li')?.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(document.querySelector('[role="dialog"] li img')).toBeNull();
    expect(button('resource.loadOnce').disabled).toBe(true);
    expect(resources.loadOnce).not.toHaveBeenCalled();
    await click(checkboxes()[1]);
    expect(checkboxes()[0].indeterminate).toBe(true);
    await click(button('resource.loadOnce'));
    expect(resources.loadOnce).toHaveBeenCalledExactlyOnceWith(['first']);
    expect(checkboxes().every((element) => !element.checked)).toBe(true);
    expect(button('resource.loadOnce').disabled).toBe(true);
  });

  test('select-all preserves order, remembers exact keys and clears stale selection', async () => {
    await open();
    await click(checkboxes()[0]);
    expect(checkboxes().every((element) => element.checked)).toBe(true);
    await click(button('resource.rememberAndLoad'));
    expect(resources.rememberAndLoad).toHaveBeenCalledExactlyOnceWith(['first', 'second']);
    expect(checkboxes().every((element) => !element.checked)).toBe(true);
    await click(checkboxes()[1]);
    resources = { ...resources, candidates: [candidate('second')] };
    await render();
    expect(button('resource.loadOnce').disabled).toBe(true);
    expect(checkboxes().every((element) => !element.checked)).toBe(true);
  });

  test('keeps loaded and diagnostic rows ordered, redacts canonical URIs and retries the matching key', async () => {
    const node: ResourceGraphNode = {
      retrievalUri: 'https://example.test/loaded.json',
      retrievalUriHash: 'loaded',
      displayUri: 'loaded.json',
      mediaType: 'application/json',
      byteLength: 10,
      contentDigest: 'digest',
      documentKind: 'json-schema',
      authorizationScope: 'generation',
      resourceUris: ['https://user:password@example.test/loaded.json?token=secret'],
      document: {},
    };
    resources = {
      ...resources,
      status: 'partial',
      candidates: [candidate('first'), candidate('failed', 'failed', true), candidate('denied', 'failed')],
      diagnostics: [diagnostic('failed', '#/first'), diagnostic('failed', '#/second'), diagnostic('denied', '#/third')],
      snapshot: {
        generation: 1,
        entryRetrievalUri: 'https://example.test/entry.json',
        documentScope: 'entry',
        nodes: new Map([[node.retrievalUri, node]]),
        resourceTargets: new Map(),
        anchorTargets: new Map(),
        documentTargets: new Map(),
        objectLocations: [],
        edges: [],
        diagnostics: [],
        complete: false,
      },
    };
    await open();
    const lists = Array.from(document.querySelectorAll('[role="dialog"] ul')).filter((list) =>
      list.querySelector(':scope > li'),
    );
    expect(lists.map((list) => list.querySelectorAll(':scope > li').length)).toEqual([1, 1, 3]);
    const loaded = document.querySelector('.knife4j-resource-passport-loaded')!;
    expect(loaded.textContent).toContain('loaded.json');
    expect(loaded.textContent).not.toMatch(/password|secret|user:/);
    const rows = Array.from(lists[2].querySelectorAll(':scope > li'));
    expect(rows.map((row) => Array.from(row.querySelectorAll('.ant-typography')).at(-1)?.textContent)).toEqual([
      '#/first',
      '#/second',
      '#/third',
    ]);
    expect(rows[2].querySelector('button')).toBeNull();
    await click(rows[1].querySelector('button')!);
    expect(resources.retry).toHaveBeenCalledExactlyOnceWith('failed');
  });

  test('busy state disables loading and retry, exposes cancellation and preserves selection', async () => {
    resources = {
      ...resources,
      candidates: [candidate('first'), candidate('failed', 'failed', true)],
      diagnostics: [diagnostic('failed', '#/failed')],
    };
    await open();
    await click(checkboxes()[1]);
    resources = { ...resources, status: 'loading' };
    await render();
    for (const text of ['resource.loadOnce', 'resource.rememberAndLoad', 'resource.retry']) {
      expect(button(text).disabled).toBe(true);
    }
    expect(checkboxes()[1].checked).toBe(true);
    await click(button('resource.cancelLoad'));
    expect(resources.cancel).toHaveBeenCalledOnce();
  });

  test('preserves the pending empty text and Antd empty diagnostic state for registration failure', async () => {
    resources = {
      ...resources,
      status: 'failed',
      candidates: [],
      registrationError: { message: 'fixture', details: {} },
    };
    await open();
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('resource.pending.empty');
    expect(document.querySelector('.ant-empty')).not.toBeNull();
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('resource.registrationFailed');
    expect(checkboxes()).toHaveLength(0);
    await click(button('resource.close'));
    await vi.waitFor(() => expect(document.querySelector<HTMLElement>('[role="dialog"]')?.style.display).toBe('none'));
  });

  test('renders every row in a long pending list and keeps the focused checkbox when rows reorder', async () => {
    resources = { ...resources, candidates: Array.from({ length: 40 }, (_, index) => candidate(`item${index}`)) };
    await open();
    expect(checkboxes()).toHaveLength(41);
    const focused = checkboxes()[5];
    focused.focus();
    resources = { ...resources, candidates: [...resources.candidates].reverse() };
    await render();
    expect(document.activeElement).toBe(focused);
    expect(checkboxes()).toHaveLength(41);
  });
});
