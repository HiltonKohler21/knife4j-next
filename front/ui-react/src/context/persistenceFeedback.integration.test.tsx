import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  write: vi.fn<(...args: unknown[]) => Promise<boolean>>(),
  remove: vi.fn<(...args: unknown[]) => Promise<boolean>>(),
  snapshot: { generation: 'initial', active: false },
  listeners: new Set<(snapshot: { generation: string; active: boolean }) => void>(),
}));
vi.mock('../storage/knife4jStorage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../storage/knife4jStorage')>()),
  setKnife4jStorageItem: storage.write,
  removeKnife4jStorageItem: storage.remove,
  getKnife4jStorageResetSnapshot: () => storage.snapshot,
  subscribeKnife4jStorageReset: (listener: (snapshot: typeof storage.snapshot) => void) => {
    storage.listeners.add(listener);
    return () => storage.listeners.delete(listener);
  },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('antd', async () => {
  const { createElement } = await import('react');
  const Widget = ({ children }: { children?: import('react').ReactNode }) => createElement('div', null, children);
  return {
    Alert: ({ title, type }: { title: string; type: string }) =>
      createElement('div', { role: 'alert', 'data-type': type }, title),
    Button: Widget,
    Checkbox: Widget,
    Divider: Widget,
    Input: Widget,
    Select: Widget,
    Space: Widget,
    Typography: { Text: Widget },
    message: { error: vi.fn() },
    Modal: { error: vi.fn(), confirm: vi.fn() },
  };
});
import Settings from '../pages/document/Settings';
import { SettingsProvider, useSettings } from './SettingsContext';
import { GlobalParamProvider, useGlobalParam } from './GlobalParamContext';

let settings: ReturnType<typeof useSettings>;
let params: ReturnType<typeof useGlobalParam>;
function Probe() {
  settings = useSettings();
  params = useGlobalParam();
  return <Settings />;
}
let root: Root;
let container: HTMLDivElement;
async function mount(groupId = 'one', strict = false) {
  const children = (
    <SettingsProvider>
      <GlobalParamProvider groupId={groupId}>
        <Probe />
      </GlobalParamProvider>
    </SettingsProvider>
  );
  await act(async () => root.render(strict ? <StrictMode>{children}</StrictMode> : children));
}
const param = {
  name: 'X-Test',
  value: 'value',
  in: 'header' as const,
  enabled: true,
  masked: false,
  valueSource: 'manual' as const,
};
beforeEach(() => {
  localStorage.clear();
  storage.snapshot = { generation: 'initial', active: false };
  storage.listeners.clear();
  storage.write.mockReset().mockResolvedValue(true);
  storage.remove.mockReset().mockResolvedValue(true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('configuration persistence feedback', () => {
  it('keeps failed settings in memory, reports failure, and clears it after a later successful save', async () => {
    await mount('one', true);
    storage.write.mockResolvedValue(false);
    await act(async () => settings.setSetting('enableHost', true));
    expect(settings.settings.enableHost).toBe(true);
    expect(settings.persistenceFailed).toBe(true);
    expect(container.querySelector('[role=alert][data-type=warning]')?.textContent).toBe('storage.persistenceFailed');
    storage.write.mockResolvedValue(true);
    await act(async () => settings.setSetting('enableHost', false));
    expect(settings.persistenceFailed).toBe(false);
    expect(container.querySelector('[role=alert][data-type=warning]')).toBeNull();
  });
  it('persists once per StrictMode user action rather than replaying side effects', async () => {
    await mount('one', true);
    storage.write.mockResolvedValue(true);
    await act(async () => settings.setSetting('enableHost', true));
    expect(storage.write).toHaveBeenCalledTimes(1);
    expect(settings.persistenceFailed).toBe(false);
  });
  it('ignores a superseded settings failure that finishes after a newer successful save', async () => {
    await mount();
    let fail: (value: boolean) => void = () => {};
    storage.write.mockImplementationOnce(
      () =>
        new Promise((r) => {
          fail = r;
        }),
    );
    await act(async () => settings.setSetting('enableHost', true));
    await act(async () => settings.setSetting('enableHost', false));
    await act(async () => fail(false));
    expect(settings.persistenceFailed).toBe(false);
    expect(settings.settings.enableHost).toBe(false);
  });
  it('separates application and group failures, including Cookie configuration', async () => {
    await mount('one', true);
    storage.write.mockResolvedValue(false);
    await act(async () => params.addParam('application', param));
    expect(params.applicationParams).toHaveLength(1);
    expect(params.applicationPersistenceFailed).toBe(true);
    expect(params.groupPersistenceFailed).toBe(false);
    await act(async () => params.setCookieSession({ credentials: 'include' }));
    expect(params.cookieSession.credentials).toBe('include');
    expect(params.groupPersistenceFailed).toBe(true);
    storage.write.mockResolvedValue(true);
    await act(async () => params.addParam('group', param));
    expect(params.groupPersistenceFailed).toBe(false);
    expect(params.applicationPersistenceFailed).toBe(true);
  });
  it('retains group-specific results across navigation and reports failed removal', async () => {
    await mount();
    storage.write.mockResolvedValue(false);
    await act(async () => params.addParam('group', param));
    await mount('two');
    expect(params.groupPersistenceFailed).toBe(false);
    await mount('one');
    expect(params.groupPersistenceFailed).toBe(true);
    storage.remove.mockResolvedValue(false);
    await act(async () => params.clearGroup());
    expect(params.groupParams).toHaveLength(0);
    expect(params.groupPersistenceFailed).toBe(true);
  });
  it('ignores older application/group failures after newer saves succeed', async () => {
    await mount();
    const finish: Array<(value: boolean) => void> = [];
    storage.write
      .mockImplementationOnce(() => new Promise((r) => finish.push(r)))
      .mockImplementationOnce(() => new Promise((r) => finish.push(r)));
    await act(async () => {
      params.addParam('application', param);
      params.addParam('group', param);
    });
    await act(async () => {
      params.addParam('application', { ...param, name: 'X-New' });
      params.addParam('group', { ...param, name: 'X-New' });
    });
    await act(async () => finish.forEach((resolve) => resolve(false)));
    expect(params.applicationPersistenceFailed).toBe(false);
    expect(params.groupPersistenceFailed).toBe(false);
    expect(params.applicationParams).toHaveLength(2);
    expect(params.groupParams).toHaveLength(2);
  });
  it('ignores an older failed group removal after a new group save', async () => {
    await mount();
    let finish: (value: boolean) => void = () => {};
    storage.remove.mockImplementationOnce(
      () =>
        new Promise((r) => {
          finish = r;
        }),
    );
    await act(async () => params.clearGroup());
    await act(async () => params.addParam('group', param));
    await act(async () => finish(false));
    expect(params.groupPersistenceFailed).toBe(false);
    expect(params.groupParams).toHaveLength(1);
  });
  it('reports a failed settings reset without restoring the removed overrides in memory', async () => {
    await mount();
    await act(async () => settings.setSetting('enableHost', true));
    storage.write.mockResolvedValue(false);
    await act(async () => settings.resetSettings());
    expect(settings.userSettings).toEqual({});
    expect(settings.persistenceFailed).toBe(true);
  });
  it.each(['settings', 'application', 'group'] as const)(
    'lets a reset observed during %s persistence supersede the user mutation',
    async (target) => {
      await mount();
      storage.write.mockImplementationOnce(() => {
        storage.snapshot = { generation: 'nested-reset', active: true };
        storage.listeners.forEach((listener) => listener(storage.snapshot));
        return Promise.resolve(false);
      });
      await act(async () => {
        if (target === 'settings') settings.setSetting('enableHost', true);
        else params.addParam(target, param);
      });
      expect(settings.userSettings).toEqual({});
      expect(params.applicationParams).toHaveLength(0);
      expect(params.groupParams).toHaveLength(0);
      expect(settings.persistenceFailed).toBe(false);
      expect(params.applicationPersistenceFailed).toBe(false);
      expect(params.groupPersistenceFailed).toBe(false);
    },
  );
  it('ignores late failures after a full reset and clears failure indicators', async () => {
    await mount();
    const finish: Array<(value: boolean) => void> = [];
    storage.write.mockImplementation(
      () =>
        new Promise((r) => {
          finish.push(r);
        }),
    );
    await act(async () => {
      settings.setSetting('enableHost', true);
      params.addParam('application', param);
      params.addParam('group', param);
    });
    await act(async () => {
      storage.snapshot = { generation: 'after-reset', active: true };
      storage.listeners.forEach((listener) => listener(storage.snapshot));
    });
    await act(async () => finish.forEach((resolve) => resolve(false)));
    expect(settings.persistenceFailed).toBe(false);
    expect(params.applicationPersistenceFailed).toBe(false);
    expect(params.groupPersistenceFailed).toBe(false);
    expect(params.applicationParams).toHaveLength(0);
    expect(params.groupParams).toHaveLength(0);
  });
});
