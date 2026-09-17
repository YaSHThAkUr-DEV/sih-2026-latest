export interface OrganizationFeatureConfig {
  feature_approvals: boolean;       // Maker-Checker dual custody approvals
  feature_section_65b: boolean;     // Section 65B statutory judicial certificates
  feature_retention_holds: boolean; // Retention schedules & legal holds
  feature_blockchain: boolean;      // Blockchain ledger anchoring & attestation
  feature_deep_ocr: boolean;        // Advanced OCR extraction & search studio
}

export const DEFAULT_FULL_FEATURES: OrganizationFeatureConfig = {
  feature_approvals: true,
  feature_section_65b: true,
  feature_retention_holds: true,
  feature_blockchain: true,
  feature_deep_ocr: true,
};

export const MINIMAL_RECEIPTS_FEATURES: OrganizationFeatureConfig = {
  feature_approvals: false,
  feature_section_65b: false,
  feature_retention_holds: false,
  feature_blockchain: false,
  feature_deep_ocr: true,
};

export const MODULE_DESCRIPTIONS: Record<
  keyof OrganizationFeatureConfig,
  { label: string; description: string; icon: string; recommendedFor: string }
> = {
  feature_approvals: {
    label: 'Maker-Checker Dual Approvals',
    description: 'Requires dual-custody officer review and cryptographically signed approval before sensitive documents or versions are published.',
    icon: 'gavel',
    recommendedFor: 'Judicial, High-Security, Police Case Records',
  },
  feature_section_65b: {
    label: 'Section 65B Judicial Certificates',
    description: 'Generates legally admissible Certificate of Electronic Evidence under Section 65B(4) of the Indian Evidence Act with cryptographic seals.',
    icon: 'assured_workload',
    recommendedFor: 'Law Enforcement, Courts, Statutory Regulatory Bodies',
  },
  feature_retention_holds: {
    label: 'Retention Schedules & Legal Holds',
    description: 'Automated lifecycle governance rules (destruction moratoriums, preservation locks, and court-mandated legal holds).',
    icon: 'policy',
    recommendedFor: 'Archives, Collectorates, Government Record Rooms',
  },
  feature_blockchain: {
    label: 'Blockchain Ledger Anchoring',
    description: 'Anchors audit log Merkle roots into an immutable blockchain ledger for tamper-evident mathematical provenance.',
    icon: 'hub',
    recommendedFor: 'Vigilance, Anti-Corruption, Institutional Audit Wings',
  },
  feature_deep_ocr: {
    label: 'Deep OCR & Search Intelligence',
    description: 'Tesseract/Triton OCR extraction pipeline for scanned notices, handwritten forms, receipts, and full-text keyword indexing.',
    icon: 'document_scanner',
    recommendedFor: 'All Offices handling scanned physical paperwork',
  },
};

/**
 * Normalizes an arbitrary object or null into a complete OrganizationFeatureConfig.
 */
export function normalizeFeatures(raw: unknown): OrganizationFeatureConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_FULL_FEATURES };
  }
  const obj = raw as Record<string, boolean | undefined>;
  return {
    feature_approvals: obj.feature_approvals !== false,
    feature_section_65b: obj.feature_section_65b !== false,
    feature_retention_holds: obj.feature_retention_holds !== false,
    feature_blockchain: obj.feature_blockchain !== false,
    feature_deep_ocr: obj.feature_deep_ocr !== false,
  };
}
