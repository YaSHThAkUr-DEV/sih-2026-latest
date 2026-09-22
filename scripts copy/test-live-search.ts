import { query, pool } from '../lib/db';

async function testAll() {
  const terms = ['ko', 'koc', 'koch', 'kochi', 'sih', 'sched', 'turing', 'akashic', 'kids'];
  for (const q of terms) {
    const res = await query<any>(
      `SELECT d.title, dv.file_name,
              ts_headline('simple', coalesce(nullif(ocr.extracted_text, ''), d.description, d.title), plainto_tsquery('simple', $1), 'StartSel=<mark>, StopSel=</mark>, MaxWords=20') as snippet
       FROM documents d
       JOIN document_versions dv ON d.id = dv.document_id
       JOIN security_levels sl ON d.security_level_id = sl.id
       LEFT JOIN ocr_results ocr ON dv.id = ocr.document_version_id
       WHERE (ocr.search_vector IS NOT NULL AND ocr.search_vector @@ plainto_tsquery('simple', $1))
          OR (ocr.extracted_text IS NOT NULL AND ocr.extracted_text ILIKE ('%' || $1 || '%'))
          OR d.title ILIKE ('%' || $1 || '%')
          OR dv.file_name ILIKE ('%' || $1 || '%')`,
      [q]
    );
    console.log(`\nQuery "${q}": ${res.length} matches`);
    if (res.length > 0) {
      console.log(`  Top match: ${res[0].file_name} (${res[0].title})`);
      console.log(`  Snippet: ${res[0].snippet}`);
    }
  }
  await pool.end();
}

testAll().catch(console.error);
