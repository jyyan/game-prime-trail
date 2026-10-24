import { ref, type Ref } from 'vue';
import type { Difficulty, Level } from '../core/types';
import { t } from '../i18n';
import { loadPdfFont, resetPdfFontCache } from '../pdf/font-loader';
import { pdfLabelsFromI18n } from '../pdf/labels';
import { pdfLabelsEn } from '../pdf/labels-en';
import { useToast } from './useToast';

export interface PdfExportDeps {
  download?: (blob: Blob, filename: string) => void;
  fetchImpl?: typeof fetch;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * PDF export (spec §6.9): loads the CJK subset font on demand, renders, and downloads.
 * Without a usable font the PDF falls back to English labels in Helvetica and a toast says so.
 * jsPDF is imported dynamically so it stays out of the main bundle.
 */
export function usePdfExport(): {
  busy: Ref<boolean>;
  exportPdf(
    level: Level,
    difficulty: Difficulty,
    includeSolution: boolean,
    deps?: PdfExportDeps,
  ): Promise<boolean>;
} {
  const busy = ref(false);
  const toast = useToast();

  async function exportPdf(
    level: Level,
    difficulty: Difficulty,
    includeSolution: boolean,
    deps: PdfExportDeps = {},
  ): Promise<boolean> {
    busy.value = true;
    try {
      const { renderPuzzlePdf, pdfFilename } = await import('../pdf/renderPuzzlePdf');
      const font = await loadPdfFont(deps.fetchImpl ?? fetch);
      const base = { level, difficulty, includeSolution };
      let blob: Blob | null = null;
      if (font !== null) {
        try {
          blob = await renderPuzzlePdf({ ...base, labels: pdfLabelsFromI18n(difficulty), font });
        } catch {
          // A font jsPDF cannot parse is treated like a failed load.
          resetPdfFontCache();
        }
      }
      if (blob === null) {
        toast.show(t('pdf.fontFallback'));
        blob = await renderPuzzlePdf({ ...base, labels: pdfLabelsEn(difficulty), font: null });
      }
      (deps.download ?? downloadBlob)(blob, pdfFilename(level.id, difficulty));
      return true;
    } catch (err) {
      console.error('[pdf] export failed', err);
      toast.show(t('pdf.exportFailed'), { variant: 'danger' });
      return false;
    } finally {
      busy.value = false;
    }
  }

  return { busy, exportPdf };
}
