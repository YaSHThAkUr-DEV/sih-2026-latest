import { query, pool } from '../lib/db';

async function testKeywords() {
  const keywords = ['Scheduling', 'Turing', 'Linux', 'Kochi', 'Engineering', 'Leave'];
  for (const kw of keywords) {
    const res = await query<any>(
      `SELECT d.title, d.document_number, 
              ts_headline('simple', ocr.extracted_text, plainto_tsquery('simple', $1), 'StartSel=<mark>, StopSel=</mark>, MaxWords=20') as snippet
       FROM ocr_results ocr
       JOIN document_versions dv ON ocr.document_version_id = dv.id
       JOIN documents d ON dv.document_id = d.id
       WHERE ocr.search_vector @@ plainto_tsquery('simple', $1)`,
      [kw]
    );
    console.log(`\nKeyword "${kw}": ${res.length} matches`);
    for (const r of res) {
      console.log(` - [${r.document_number}] ${r.title}`);
      console.log(`   Snippet: ${r.snippet}`);
    }
  }
  await pool.end();
}

testKeywords().catch(console.error);
