/** Consume the debugger's existing data-line SSE representation without owning UI/history state. */
export async function consumeDebugSse(
  body: ReadableStream<Uint8Array>,
  isCurrent: () => boolean,
  onData: (data: string) => void,
): Promise<'completed' | 'superseded'> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!isCurrent()) return 'superseded';
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trimEnd();
        if (trimmed.startsWith('data:')) onData(trimmed.slice(5).trimStart());
      }
    }
    if (buffer.trim().startsWith('data:')) {
      const data = buffer.trim().slice(5).trimStart();
      if (data && isCurrent()) onData(data);
    }
    return 'completed';
  } finally {
    reader.releaseLock();
  }
}
