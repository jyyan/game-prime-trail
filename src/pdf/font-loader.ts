export const PDF_FONT_FAMILY = 'PrimeTrailZh';
export const PDF_FONT_URL = '/fonts/pdf-zh.subset.ttf';

export interface LoadedPdfFont {
  family: typeof PDF_FONT_FAMILY;
  data: ArrayBuffer;
}

// Only a successful load is cached; a failure is retried on the next export.
let cached: LoadedPdfFont | null = null;

/**
 * Fetches the CJK subset font for the PDF labels (spec §6.9), only when an export happens.
 * Returns `null` on a non-2xx response or any error so the caller can fall back to English labels.
 */
export async function loadPdfFont(
  fetchImpl: typeof fetch = fetch,
  url: string = PDF_FONT_URL,
): Promise<LoadedPdfFont | null> {
  if (cached !== null) return cached;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    const data = await res.arrayBuffer();
    if (data.byteLength === 0) return null;
    cached = { family: PDF_FONT_FAMILY, data };
    return cached;
  } catch {
    return null;
  }
}

/** Drops the cached font, e.g. after jsPDF rejected it, so the next export fetches again. */
export function resetPdfFontCache(): void {
  cached = null;
}
