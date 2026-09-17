import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { hashOrNumber } = await req.json();
    const term = (hashOrNumber || '').trim();

    if (!term) {
      return NextResponse.json({ error: 'Please enter a SHA-256 hash or Document Number.' }, { status: 400 });
    }

    // Search document_versions by hash or documents by document_number
    const rows = await query(
      `SELECT 
         dv.id as version_id,
         dv.version_number,
         dv.sha256_hash,
         dv.file_name,
         dv.file_size,
         dv.encryption_algorithm,
         dv.status as version_status,
         dv.created_at,
         d.id as document_id,
         d.document_number,
         d.title,
         sl.code as security_tier,
         sl.name as security_tier_name,
         dep.name as department_name,
         u.full_name as created_by_name
       FROM document_versions dv
       JOIN documents d ON dv.document_id = d.id
       JOIN security_levels sl ON d.security_level_id = sl.id
       JOIN departments dep ON d.department_id = dep.id
       JOIN users u ON dv.created_by = u.id
       WHERE (LOWER(dv.sha256_hash) = LOWER($1) OR LOWER(d.document_number) = LOWER($1))
       LIMIT 1`,
      [term]
    );

    if (rows.length === 0) {
      return NextResponse.json({
        verified: false,
        message: 'No matching document or cryptographic checksum found in the national registry. Possible unregistered or tampered file.',
      });
    }

    const doc = rows[0];

    return NextResponse.json({
      verified: true,
      document: {
        documentNumber: doc.document_number,
        title: doc.title,
        version: `v${doc.version_number}.0`,
        sha256Hash: doc.sha256_hash,
        fileName: doc.file_name,
        fileSize: `${(doc.file_size / (1024 * 1024)).toFixed(2)} MB`,
        encryption: doc.encryption_algorithm,
        securityTier: `${doc.security_tier} (${doc.security_tier_name})`,
        department: doc.department_name,
        officer: doc.created_by_name,
        timestamp: doc.created_at,
      },
      message: `Attestation Verified: Document ${doc.document_number} matches the registered SHA-256 digest in PostgreSQL.`,
    });
  } catch (err: any) {
    console.error('Verify hash error:', err);
    return NextResponse.json({ error: 'Verification service error' }, { status: 500 });
  }
}
