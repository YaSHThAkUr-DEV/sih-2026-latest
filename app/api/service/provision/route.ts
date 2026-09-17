import { NextRequest, NextResponse } from 'next/server';
import { provisionOfficeInstance } from '@/lib/service/provisioning';
import {
  DEFAULT_FULL_FEATURES,
  MINIMAL_RECEIPTS_FEATURES,
  MODULE_DESCRIPTIONS,
} from '@/lib/service/service-config';

export const dynamic = 'force-dynamic';

/**
 * GET /api/service/provision
 * Returns available module descriptors and presets for the setup wizard.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    modules: MODULE_DESCRIPTIONS,
    presets: {
      FULL_SUITE: {
        name: 'Complete Institutional DMS',
        description: 'Enables all evidentiary, dual-custody, retention, OCR, and blockchain capabilities.',
        features: DEFAULT_FULL_FEATURES,
      },
      PAYMENT_RECEIPTS_MINIMAL: {
        name: 'Revenue & Payment Receipts Only',
        description: 'Optimized for offices handling bills, receipts, and challans without judicial evidence or approvals overhead.',
        features: MINIMAL_RECEIPTS_FEATURES,
      },
      RECORDS_ARCHIVE: {
        name: 'Archives & Public Grievance',
        description: 'Includes retention holds and deep OCR without dual approvals.',
        features: {
          feature_approvals: false,
          feature_section_65b: false,
          feature_retention_holds: true,
          feature_blockchain: true,
          feature_deep_ocr: true,
        },
      },
    },
  });
}

/**
 * POST /api/service/provision
 * Provisions a new customized office DMS instance.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.officeName || !body.officeCode) {
      return NextResponse.json(
        { error: 'Office name and office code are required.' },
        { status: 400 }
      );
    }

    if (!body.adminUser?.email || !body.adminUser?.password) {
      return NextResponse.json(
        { error: 'Administrator email and initial password are required.' },
        { status: 400 }
      );
    }

    const result = await provisionOfficeInstance({
      officeName: body.officeName,
      officeCode: body.officeCode,
      officeDescription: body.officeDescription,
      features: body.features,
      departments: body.departments,
      documentTypes: body.documentTypes,
      adminUser: {
        fullName: body.adminUser.fullName || `${body.officeName} Admin`,
        email: body.adminUser.email,
        employeeCode: body.adminUser.employeeCode || `${body.officeCode}-ADM`,
        password: body.adminUser.password,
        designation: body.adminUser.designation || 'Institutional Administrator',
        username: body.adminUser.username,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    console.error('Failed to provision office instance:', err);
    const message = err instanceof Error ? err.message : 'Failed to provision office instance.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
