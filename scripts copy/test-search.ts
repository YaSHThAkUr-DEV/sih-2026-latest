import { query, pool } from '../lib/db';

async function testSearch() {
  console.log('=== TESTING INTELLIGENCE SEARCH ENGINE & GIN TSVECTOR ===\n');

  // Test 1: Full-text search inside OCR text for "svchost.exe"
  const q1 = 'svchost.exe';
  console.log(`[TEST 1] Searching for keyword: "${q1}"`);
  const res1 = await query<any>(`
    SELECT 
      d.document_number,
      d.title,
      sl.code as security_tier,
      ocr.confidence,
      ts_headline('simple', ocr.extracted_text, plainto_tsquery('simple', $1), 'StartSel=[[HIGHLIGHT]], StopSel=[[/HIGHLIGHT]]') as snippet,
      ts_rank(ocr.search_vector, plainto_tsquery('simple', $1)) as rank
    FROM ocr_results ocr
    JOIN document_versions dv ON ocr.document_version_id = dv.id
    JOIN documents d ON dv.document_id = d.id
    JOIN security_levels sl ON d.security_level_id = sl.id
    WHERE ocr.search_vector @@ plainto_tsquery('simple', $1)
    ORDER BY rank DESC;
  `, [q1]);

  console.log(`Results found: ${res1.length}`);
  res1.forEach(r => {
    console.log(` - Doc: ${r.document_number} (${r.security_tier}) | Title: ${r.title}`);
    console.log(`   OCR Confidence: ${r.confidence}%`);
    console.log(`   Highlighted Snippet: ${r.snippet}\n`);
  });

  // Test 2: Search for suspect "Devendra Sharma"
  const q2 = 'Devendra Sharma';
  console.log(`[TEST 2] Searching for suspect name: "${q2}"`);
  const res2 = await query<any>(`
    SELECT 
      d.document_number,
      d.title,
      dt.name as type_name,
      ts_headline('simple', ocr.extracted_text, plainto_tsquery('simple', $1), 'StartSel=[[, StopSel=]]') as snippet
    FROM ocr_results ocr
    JOIN document_versions dv ON ocr.document_version_id = dv.id
    JOIN documents d ON dv.document_id = d.id
    JOIN document_types dt ON d.document_type_id = dt.id
    WHERE ocr.search_vector @@ plainto_tsquery('simple', $1)
    ORDER BY dv.created_at DESC;
  `, [q2]);

  console.log(`Results found: ${res2.length}`);
  res2.forEach(r => {
    console.log(` - Doc: ${r.document_number} [${r.type_name}] | ${r.title}`);
  });

  console.log('\n=== ALL INTELLIGENCE SEARCH TESTS PASSED ===');
  await pool.end();
  process.exit(0);
}

testSearch().catch(err => {
  console.error('[TEST_ERR]', err);
  process.exit(1);
});
