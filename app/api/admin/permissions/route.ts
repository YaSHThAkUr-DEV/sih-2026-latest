import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/admin-guard';
import { query } from '@/lib/db';

export async function GET(req: Request) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const permissions = await query(
      `SELECT id, code, description FROM permissions ORDER BY code ASC`
    );

    // Group logically by category
    const categorized = permissions.map((p) => {
      let category = 'Document Management';
      if (p.code.startsWith('AUDIT') || p.code.includes('AUDIT')) {
        category = 'Audit & Forensics';
      } else if (p.code.includes('APPROVE') || p.code.includes('REJECT') || p.code.includes('REQUEST_CHANGE')) {
        category = 'Maker-Checker Workflows';
      } else if (p.code.includes('PERMISSION') || p.code.includes('USER')) {
        category = 'Access & Identity Governance';
      } else if (p.code.includes('RETENTION')) {
        category = 'Statutory Retention & Archive';
      }

      return {
        ...p,
        category,
      };
    });

    return NextResponse.json({ permissions: categorized });
  } catch (err: any) {
    console.error('[ADMIN_GET_PERMISSIONS_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to retrieve permissions list.', details: err.message },
      { status: 500 }
    );
  }
}
