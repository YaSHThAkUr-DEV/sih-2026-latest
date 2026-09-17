import crypto from 'crypto';
import Tesseract from 'tesseract.js';

export interface ExtractedOcrResult {
  extractedText: string;
  textSha256: string;
  confidence: number;
  language: string;
  pageCount: number;
  engine: string;
  engineVersion: string;
}

export class OcrExtractorService {
  /**
   * Extracts text from an evidentiary file buffer (PDF or Image)
   */
  public static async extractText(
    buffer: Buffer,
    fileName: string,
    mimeType?: string
  ): Promise<ExtractedOcrResult> {
    const isPdf =
      mimeType === 'application/pdf' ||
      fileName.toLowerCase().endsWith('.pdf');
    
    const isImage =
      (mimeType && mimeType.startsWith('image/')) ||
      /\.(png|jpe?g|tiff|bmp|webp)$/i.test(fileName);

    let extractedText = '';
    let confidence = 95.0;
    let pageCount = 1;
    let engine = 'Tesseract OCR';
    let engineVersion = '5.0.0';

    if (isPdf) {
      try {
        const pdfModule: any = await import('pdf-parse');
        if (pdfModule.PDFParse) {
          const parser = new pdfModule.PDFParse({ data: new Uint8Array(buffer) });
          const pdfData = await parser.getText();
          extractedText = pdfData.text || '';
          pageCount = pdfData.total || pdfData.pages?.length || 1;
          confidence = extractedText.trim().length > 0 ? 98.5 : 50.0;
        } else if (typeof pdfModule === 'function' || typeof pdfModule.default === 'function') {
          const parseFn = typeof pdfModule === 'function' ? pdfModule : pdfModule.default;
          const pdfData = await parseFn(buffer);
          extractedText = pdfData.text || '';
          pageCount = pdfData.numpages || 1;
          confidence = extractedText.trim().length > 0 ? 98.5 : 50.0;
        }
        engine = 'PDF-Engine / Parser';
        engineVersion = '2.4.5';
      } catch (err: any) {
        console.warn(`[OCR] Direct PDF extraction failed: ${err.message}`);
        extractedText = '';
        confidence = 0.0;
      }
    } else if (isImage) {
      try {
        const result = await Tesseract.recognize(buffer, 'eng');
        extractedText = result.data.text || '';
        confidence = Number(result.data.confidence) || 90.0;
        pageCount = 1;
        engine = 'Tesseract OCR';
        engineVersion = '7.0.0';
      } catch (err: any) {
        console.warn(`[OCR] Tesseract image OCR failed: ${err.message}`);
        extractedText = '';
        confidence = 0.0;
      }
    } else {
      // Plain text, log file, CSV, JSON
      try {
        extractedText = buffer.toString('utf-8');
        confidence = 100.0;
        engine = 'Text-Normalizer';
        engineVersion = '1.0.0';
      } catch {
        extractedText = '';
        confidence = 0.0;
      }
    }

    // Clean and normalize extracted text (remove null bytes, replacement chars, zero-width chars, Private Use Area symbols)
    const normalizedText = extractedText
      .replace(/\0/g, '')
      .replace(/[\uFFFD\uFEFF]/g, ' ')
      .replace(/[\u200B-\u200D]/g, '')
      .replace(/[\uE000-\uF8FF]/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    // Compute bit-exact SHA-256 integrity hash of extracted text
    const textSha256 = crypto
      .createHash('sha256')
      .update(normalizedText, 'utf8')
      .digest('hex');

    return {
      extractedText: normalizedText,
      textSha256,
      confidence: Math.min(100, Math.max(0, parseFloat(confidence.toFixed(2)))),
      language: 'eng',
      pageCount,
      engine,
      engineVersion,
    };
  }
}
