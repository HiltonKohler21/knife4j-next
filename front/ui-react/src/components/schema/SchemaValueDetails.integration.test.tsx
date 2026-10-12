import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import SchemaValueDetails from './SchemaValueDetails';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count: number }) => (options ? `${key}:${options.count}` : key),
  }),
}));

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('Schema values in description cells', () => {
  test.each([0, false, '', null, ['a', 'b'], { enabled: false }])(
    'displays a declared default %j with its JSON type intact',
    async (value) => {
      await act(async () => root.render(<SchemaValueDetails default={value} />));
      expect(container.querySelector('code')?.textContent).toBe(JSON.stringify(value));
      expect(container.textContent).toContain('schema.values.default');
      expect(container.textContent).not.toContain('schema.values.enum');
    },
  );

  test('keeps enum and default on separate lines, with all typed choices available in expandable details', async () => {
    const values = ['0', 0, false, '', null, [1, 2], { key: 'value' }];
    await act(async () => root.render(<SchemaValueDetails enum={values} default={false} />));
    const details = container.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')?.textContent).toContain('schema.values.showAll:7');
    expect(Array.from(details.querySelectorAll('summary code'), (code) => code.textContent)).toEqual([
      '"0"',
      '0',
      'false',
    ]);
    expect(Array.from(details.querySelectorAll(':scope > div code'), (code) => code.textContent)).toEqual(
      values.map((value) => JSON.stringify(value)),
    );
    expect(details.parentElement?.nextElementSibling?.textContent).toBe('schema.values.defaultfalse');
  });

  test('escapes document text and displays short enums without requiring expansion', async () => {
    const value = '<img src=x onerror=alert(1)>';
    await act(async () => root.render(<SchemaValueDetails enum={[value, 'a,b', 'a\nb']} default={value} />));
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('details')).toBeNull();
    expect(Array.from(container.querySelectorAll('code'), (code) => code.textContent)).toEqual([
      JSON.stringify(value),
      '"a,b"',
      '"a\\nb"',
      JSON.stringify(value),
    ]);
  });

  test('omits absent defaults and empty enums', async () => {
    await act(async () => root.render(<SchemaValueDetails enum={[]} />));
    expect(container.textContent).toBe('');
  });
});
