import type { DebugResponsePayload } from './ResponsePanel';

// ─── Response body classification ─────────────────────

/**
 * Map a response blob + Content-Type into a representation the
 * ResponsePanel can render directly. Text-friendly payloads are always
 * decoded into `rawText` so the Raw tab can show something even for
 * image / binary responses that choose to embed ASCII.
 */
/**
 * Parse filename from Content-Disposition header.
 * Supports both `filename*=UTF-8''...` (RFC 5987) and plain `filename=...` forms.
 */
function parseContentDispositionFilename(header: string): string | undefined {
  if (!header) return undefined;

  // RFC 5987: filename*=UTF-8''encoded%20name
  const rfc5987Match = header.match(/filename\*\s*=\s*([^']*)'[^']*'([^;,\s]+)/i);
  if (rfc5987Match) {
    try {
      return decodeURIComponent(rfc5987Match[2]);
    } catch {
      // fall through to plain filename
    }
  }

  // Plain: filename="foo.xlsx" or filename=foo.xlsx
  const plainMatch = header.match(/filename\s*=\s*"?([^";,\s]+)"?/i);
  if (plainMatch) {
    return plainMatch[1];
  }

  return undefined;
}

export async function interpretResponseBlob(
  blob: Blob,
  contentType: string,
  requestUrl: string,
  contentDisposition?: string,
): Promise<{
  kind: DebugResponsePayload['kind'];
  rawText: string;
  objectUrl?: string;
  filename?: string;
}> {
  const ct = (contentType || '').toLowerCase();

  // Content-Disposition: attachment → treat as binary download regardless of content-type
  const isAttachment = contentDisposition ? /attachment/i.test(contentDisposition) : false;
  const cdFilename = contentDisposition ? parseContentDispositionFilename(contentDisposition) : undefined;

  if (isAttachment) {
    const filename = cdFilename ?? extractFilenameFromUrl(requestUrl) ?? 'download';
    return {
      kind: 'binary',
      rawText: '',
      objectUrl: URL.createObjectURL(blob),
      filename,
    };
  }

  // image/* → inline preview via object URL, keep rawText empty (binary)
  if (ct.startsWith('image/')) {
    return { kind: 'image', rawText: '', objectUrl: URL.createObjectURL(blob) };
  }

  // application/json (and *+json variants) → JSON text
  if (ct.includes('json')) {
    const rawText = await blob.text();
    return { kind: 'json', rawText };
  }

  // Anything text-like: text/plain, text/html, application/javascript, application/xml, text/xml, etc.
  if (ct.startsWith('text/') || ct.includes('javascript') || ct.includes('xml') || ct.includes('yaml')) {
    const rawText = await blob.text();
    return { kind: 'text', rawText };
  }

  // Empty Content-Type: fall back to text interpretation for robustness
  if (!ct) {
    const rawText = await blob.text();
    return { kind: rawText ? 'text' : 'binary', rawText };
  }

  // Binary payload (pdf, octet-stream, zip, xlsx, ...) → download link.
  const filename = cdFilename ?? extractFilenameFromUrl(requestUrl) ?? 'download';
  return {
    kind: 'binary',
    rawText: '',
    objectUrl: URL.createObjectURL(blob),
    filename,
  };
}

/** Best-effort filename from a URL path's last segment, dropping query/hash. */
function extractFilenameFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url, typeof window === 'undefined' ? 'http://localhost' : window.location.href);
    const last = parsed.pathname.split('/').filter(Boolean).pop();
    return last || undefined;
  } catch {
    return undefined;
  }
}
