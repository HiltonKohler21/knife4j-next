import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendDebugHttpRequest, type DebugHttpRequestOptions } from './debugHttpRequest';
import { consumeDebugSse } from './debugSseResponse';
import { interpretResponseBlob } from './debugResponseBody';

afterEach(() => vi.unstubAllGlobals());

function request(): DebugHttpRequestOptions {
  return {
    built: {
      url: 'https://example.test/pets',
      method: 'POST',
      headers: {},
      query: {},
      contentType: 'application/json',
      body: '{"id":1}',
    },
    formValues: { pathParams: {}, queryParams: {}, headerParams: {}, cookieParams: {} },
    multipartTextFields: {},
    binaryFile: null,
    credentials: 'include',
    signal: new AbortController().signal,
    isOas32: false,
    unrepresentableMessage: 'unsupported multipart',
  };
}

describe('debug HTTP execution boundary', () => {
  it('sends the validated snapshot with its credentials and cancellation signal', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetch);
    const options = request();
    await sendDebugHttpRequest(options);
    expect(fetch).toHaveBeenCalledWith(
      options.built.url,
      expect.objectContaining({
        method: 'POST',
        body: '{"id":1}',
        credentials: 'include',
        signal: options.signal,
      }),
    );
    options.built.body = '';
    options.built.explicitExampleBody = true;
    await sendDebugHttpRequest(options);
    expect(fetch.mock.calls[1][1].body).toBe('');
  });

  it('preserves single/multiple files and JSON parts in legacy multipart requests', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetch);
    const options = request();
    options.activeBodyContent = {
      mediaType: 'multipart/form-data',
      category: 'multipart',
      fileFieldsMultiple: ['many'],
    };
    options.built.headers['Content-Type'] = 'multipart/form-data';
    const first = new File(['first'], 'first.txt');
    const second = new File(['second'], 'second.txt');
    options.formValues.fileFields = { single: [first, second], many: [first, second] };
    options.formValues.jsonFields = ['metadata'];
    options.multipartTextFields = { metadata: '{"id":1}', name: 'pet' };
    await sendDebugHttpRequest(options);
    const init = fetch.mock.calls[0][1] as RequestInit;
    const body = init.body as FormData;
    expect(body.getAll('single')).toHaveLength(1);
    expect(body.getAll('many')).toHaveLength(2);
    expect(await (body.get('metadata') as Blob).text()).toBe('{"id":1}');
    expect((body.get('metadata') as Blob).type).toBe('application/json');
    expect(body.get('name')).toBe('pet');
    expect(init.headers).not.toHaveProperty('Content-Type');
  });

  it('refuses unmaterialized OAS3.2 multipart and sends an already prepared envelope unchanged', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetch);
    const options = request();
    options.isOas32 = true;
    options.activeBodyContent = { mediaType: 'multipart/mixed', category: 'multipart' };
    await expect(sendDebugHttpRequest(options)).rejects.toThrow('unsupported multipart');
    expect(fetch).not.toHaveBeenCalled();
    const body = new Blob(['exact wire bytes']);
    options.preparedMultipart = { body, contentType: 'multipart/mixed; boundary=fixed', mode: 'encoded' };
    options.built.headers['content-type'] = 'old';
    await sendDebugHttpRequest(options);
    expect(fetch.mock.calls[0][1].body).toBe(body);
    expect(fetch.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'multipart/mixed; boundary=fixed' });
  });
});

describe('debug response consumption', () => {
  it('retains existing SSE data-line semantics across byte boundaries and an unterminated last line', async () => {
    const bytes = new TextEncoder().encode('event: ignored\ndata: 中文\ndata: second\ndata: tail');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
        controller.close();
      },
    });
    const events: string[] = [];
    await expect(
      consumeDebugSse(
        stream,
        () => true,
        (data) => events.push(data),
      ),
    ).resolves.toBe('completed');
    expect(events).toEqual(['中文', 'second', 'tail']);
    expect(stream.locked).toBe(false);
  });

  it('does not publish data from a superseded request and propagates cancellation', async () => {
    const onData = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: stale\n'));
      },
    });
    await expect(consumeDebugSse(stream, () => false, onData)).resolves.toBe('superseded');
    expect(onData).not.toHaveBeenCalled();
    const aborted = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new DOMException('cancelled', 'AbortError'));
      },
    });
    await expect(consumeDebugSse(aborted, () => true, onData)).rejects.toHaveProperty('name', 'AbortError');
    expect(aborted.locked).toBe(false);
  });

  it('preserves textual JSON bytes and attachment disposition', async () => {
    const raw = '{"large":9007199254740993}';
    await expect(interpretResponseBlob(new Blob([raw]), 'application/json', '/pets')).resolves.toEqual({
      kind: 'json',
      rawText: raw,
    });
    const attachment = await interpretResponseBlob(
      new Blob([raw]),
      'application/json',
      '/pets',
      "attachment; filename*=UTF-8''report%20one.json",
    );
    expect(attachment).toMatchObject({ kind: 'binary', rawText: '', filename: 'report one.json' });
    expect(attachment.objectUrl).toMatch(/^blob:/);
    URL.revokeObjectURL(attachment.objectUrl!);
  });
});
