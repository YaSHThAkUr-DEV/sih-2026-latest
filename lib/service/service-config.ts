import { query } from '@/lib/db';
import { normalizeFeatures, DEFAULT_FULL_FEATURES } from './service-config-shared';
import type { OrganizationFeatureConfig } from './service-config-shared';

// Re-export everything from the shared module so existing server-side imports
// (e.g. provisioning.ts, API routes, scripts) continue to work unchanged.
export type { OrganizationFeatureConfig } from './service-config-shared';
export {
  DEFAULT_FULL_FEATURES,
  MINIMAL_RECEIPTS_FEATURES,
  MODULE_DESCRIPTIONS,
  normalizeFeatures,
} from './service-config-shared';

let _schemaChecked = false;

/**
 * Ensures the `features` JSONB column exists on the `organizations` table.
 * Runs idempotently once per application runtime.
 */
export async function ensureOrganizationFeaturesSchema(): Promise<void> {
  if (_schemaChecked) return;
  try {
    await query(`
      ALTER TABLE organizations 
      ADD COLUMN IF NOT EXISTS features JSONB 
      DEFAULT '{"feature_approvals":true,"feature_section_65b":true,"feature_retention_holds":true,"feature_blockchain":true,"feature_deep_ocr":true}'::jsonb;
    `);
    _schemaChecked = true;
  } catch (err) {
    console.error('[service-config] Warning: Failed to ensure organizations.features column:', err);
  }
}

/**
 * Retrieves the feature configuration for a specific organization by ID.
 */
export async function getOrganizationFeatures(organizationId: string): Promise<OrganizationFeatureConfig> {
  await ensureOrganizationFeaturesSchema();
  try {
    const rows = await query<{ features: Record<string, boolean> | null }>(
      `SELECT features FROM organizations WHERE id = $1;`,
      [organizationId]
    );
    if (rows.length === 0 || !rows[0].features) {
      return { ...DEFAULT_FULL_FEATURES };
    }
    return normalizeFeatures(rows[0].features);
  } catch (e) {
    console.error('[service-config] Error reading organization features:', e);
    return { ...DEFAULT_FULL_FEATURES };
  }
}

/**
 * Updates the feature configuration for an organization.
 */
export async function updateOrganizationFeatures(
  organizationId: string,
  updates: Partial<OrganizationFeatureConfig>
): Promise<OrganizationFeatureConfig> {
  await ensureOrganizationFeaturesSchema();
  const current = await getOrganizationFeatures(organizationId);
  const merged: OrganizationFeatureConfig = {
    ...current,
    ...updates,
  };

  await query(
    `UPDATE organizations 
     SET features = $1, updated_at = NOW() 
     WHERE id = $2;`,
    [JSON.stringify(merged), organizationId]
  );

  return merged;
}
