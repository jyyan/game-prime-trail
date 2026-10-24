import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_RECORD } from '../../core/__fixtures__/level-fixture';
import { decodeLevel } from '../../core/level-decode';
import { t } from '../../i18n';
import { loadPdfFont, resetPdfFontCache } from '../../pdf/font-loader';
import { usePdfExport } from '../usePdfExport';
import { useToast } from '../useToast';

const level = decodeLevel(FIXTURE_RECORD, 123);

function fetchReturning(res: unknown): typeof fetch {
  return vi.fn(async () => res as Response) as unknown as typeof fetch;
}

function clearToasts(): void {
  const { toasts, dismiss } = useToast();
  for (const toast of [...toasts.value]) dismiss(toast.id);
}

function toastMessages(): Array<[string, string]> {
  return useToast().toasts.value.map((toast) => [toast.message, toast.variant]);
}

beforeEach(() => {
  resetPdfFontCache();
  clearToasts();
});

afterEach(() => {
  vi.restoreAllMocks();
  clearToasts();
});

describe('usePdfExport', () => {
  it('falls back to English labels and toasts when the font fetch fails', async () => {
    const { exportPdf } = usePdfExport();
    const download = vi.fn();
    const ok = await exportPdf(level, 'advanced', false, {
      download,
      fetchImpl: fetchReturning({ ok: false }),
    });
    expect(ok).toBe(true);
    expect(download).toHaveBeenCalledTimes(1);
    const [blob, filename] = download.mock.calls[0];
    expect(filename).toBe('prime-trail-0123-advanced.pdf');
    expect(blob).toBeInstanceOf(Blob);
    expect((blob as Blob).size).toBeGreaterThan(1000);
    expect(toastMessages()).toContainEqual([t('pdf.fontFallback'), 'info']);
  });

  it('falls back to Helvetica when jsPDF rejects the font data', async () => {
    const { exportPdf } = usePdfExport();
    const download = vi.fn();
    const fetchImpl = fetchReturning({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    const ok = await exportPdf(level, 'easy', true, { download, fetchImpl });
    expect(ok).toBe(true);
    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0][1]).toBe('prime-trail-0123-easy.pdf');
    expect(toastMessages()).toContainEqual([t('pdf.fontFallback'), 'info']);
    // The rejected font is not cached: the next export fetches again.
    await exportPdf(level, 'easy', false, { download, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('falls back when fetch itself throws', async () => {
    const { exportPdf } = usePdfExport();
    const download = vi.fn();
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('network down');
    }) as unknown as typeof fetch;
    expect(await exportPdf(level, 'challenge', false, { download, fetchImpl })).toBe(true);
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('is busy while exporting and idle afterwards', async () => {
    const { busy, exportPdf } = usePdfExport();
    const seen: boolean[] = [];
    expect(busy.value).toBe(false);
    const pending = exportPdf(level, 'easy', false, {
      download: () => seen.push(busy.value),
      fetchImpl: fetchReturning({ ok: false }),
    });
    expect(busy.value).toBe(true);
    await pending;
    expect(seen).toEqual([true]);
    expect(busy.value).toBe(false);
  });

  it('returns false with a danger toast when the export throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { busy, exportPdf } = usePdfExport();
    const ok = await exportPdf(level, 'easy', false, {
      download: () => {
        throw new Error('blocked');
      },
      fetchImpl: fetchReturning({ ok: false }),
    });
    expect(ok).toBe(false);
    expect(busy.value).toBe(false);
    expect(toastMessages()).toContainEqual([t('pdf.exportFailed'), 'danger']);
  });

  it('downloads through an <a download> link by default', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    // jsdom has no object URLs; subclass URL so the stub disappears with unstubAllGlobals.
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = createObjectURL;
        static revokeObjectURL = revokeObjectURL;
      },
    );
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      const { exportPdf } = usePdfExport();
      const ok = await exportPdf(level, 'easy', false, { fetchImpl: fetchReturning({ ok: false }) });
      expect(ok).toBe(true);
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(click).toHaveBeenCalledTimes(1);
      const anchor = click.mock.contexts[0] as HTMLAnchorElement;
      expect(anchor.download).toBe('prime-trail-0123-easy.pdf');
      expect(anchor.href).toBe('blob:mock');
      expect(anchor.isConnected).toBe(false);
      vi.runAllTimers();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});

describe('loadPdfFont', () => {
  it('returns null on a non-2xx response', async () => {
    expect(await loadPdfFont(fetchReturning({ ok: false }))).toBeNull();
  });

  it('caches a successful load', async () => {
    const data = new ArrayBuffer(16);
    const fetchImpl = fetchReturning({ ok: true, arrayBuffer: async () => data });
    const first = await loadPdfFont(fetchImpl, '/fonts/x.ttf');
    expect(first).toEqual({ family: 'PrimeTrailZh', data });
    expect(await loadPdfFont(fetchImpl, '/fonts/x.ttf')).toBe(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith('/fonts/x.ttf');
  });

  it('requests the default URL', async () => {
    const fetchImpl = fetchReturning({ ok: false });
    await loadPdfFont(fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith('/fonts/pdf-zh.subset.ttf');
  });
});
