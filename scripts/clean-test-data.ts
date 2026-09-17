import { pool, query } from '../lib/db';
import { invalidateCache } from '../lib/cache/redis';

async function cleanup() {
  console.log('--- Cleaning up test/hardcoded seeded data ---');

  // 1. Delete approval actions
  await query(`DELETE FROM approval_actions;`);

  // 2. Delete change requests
  await query(`DELETE FROM change_requests;`);

  // 3. Delete OCR data tied to test docs
  await query(`
    DELETE FROM ocr_results 
    WHERE document_version_id IN (
      SELECT id FROM document_versions 
      WHERE document_id IN (SELECT id FROM documents WHERE document_number LIKE 'CIB-EVID-%')
    );
  `);

  await query(`
    DELETE FROM ocr_jobs 
    WHERE document_version_id IN (
      SELECT id FROM document_versions 
      WHERE document_id IN (SELECT id FROM documents WHERE document_number LIKE 'CIB-EVID-%')
    );
  `);

  // 4. Unlink audit events and current_version_id before deleting versions
  await query(`
    UPDATE audit_events 
    SET document_version_id = NULL, document_id = NULL
    WHERE document_id IN (SELECT id FROM documents WHERE document_number LIKE 'CIB-EVID-%');
  `);

  await query(`
    UPDATE documents 
    SET current_version_id = NULL 
    WHERE document_number LIKE 'CIB-EVID-%';
  `);

  // 5. Delete document versions
  await query(`
    DELETE FROM document_versions 
    WHERE document_id IN (SELECT id FROM documents WHERE document_number LIKE 'CIB-EVID-%');
  `);

  // 6. Delete documents
  const delDocs = await query(`
    DELETE FROM documents 
    WHERE document_number LIKE 'CIB-EVID-%'
    RETURNING document_number;
  `);

  console.log(`Deleted ${delDocs.length} test documents.`);

  // 7. Clear Redis cache
  await invalidateCache('dms:*');

  console.log('✅ All test documents and pending approvals wiped clean.');
  await pool.end();
}

cleanup().catch((err) => {
  console.error('Cleanup error:', err);
  process.exit(1);
});
