import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';
import { OcrPipelineService } from '@/lib/ocr/pipeline';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { versionId } = await params;

    // Check existing OCR result
    const results = await query<any>(
      `SELECT 
         ocr.id,
         ocr.document_version_id,
         ocr.extracted_text,
         ocr.text_sha256,
         ocr.language,
         ocr.confidence,
         ocr.created_at,
         job.status as job_status,
         job.engine,
         job.page_count,
         job.completed_at,
         d.document_number,
         d.title as document_title,
         dv.file_name
       FROM document_versions dv
       JOIN documents d ON dv.document_id = d.id
       LEFT JOIN ocr_results ocr ON dv.id = ocr.document_version_id
       LEFT JOIN ocr_jobs job ON dv.id = job.document_version_id
       WHERE dv.id = $1
       ORDER BY job.created_at DESC
       LIMIT 1;`,
      [versionId]
    );

    if (!results || results.length === 0) {
      return NextResponse.json({ error: 'Document version not found' }, { status: 404 });
    }

    const row = results[0];

    return NextResponse.json({
      success: true,
      ocr: {
        versionId,
        documentNumber: row.document_number,
        documentTitle: row.document_title,
        fileName: row.file_name,
        hasOcr: !!row.extracted_text,
        extractedText: row.extracted_text || '',
        textSha256: row.text_sha256 || null,
        confidence: row.confidence ? parseFloat(row.confidence) : 0,
        pageCount: row.page_count || 1,
        jobStatus: row.job_status || (row.extracted_text ? 'COMPLETED' : 'PENDING'),
        engine: row.engine || 'Tesseract OCR',
        completedAt: row.completed_at,
      },
    });
  } catch (err: any) {
    console.error('[API_OCR_ERROR]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * Trigger or re-run OCR extraction for a document version
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { versionId } = await params;

    const res = await OcrPipelineService.processVersion(versionId, session.userId);
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'OCR extraction completed successfully',
      result: res.result,
    });
  } catch (err: any) {
    console.error('[API_OCR_TRIGGER_ERROR]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
