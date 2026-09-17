'use client';

import React, { useState, useEffect } from 'react';

interface CertificateData {
  serialNumber: string;
  generatedAt: string;
  document: {
    id: string;
    documentNumber: string;
    title: string;
    description: string;
    documentType: string;
    securityTier: string;
    securityTierName: string;
    fileName: string;
    fileSize: number;
    versionNumber: number;
    sha256Hash: string;
    encryptionAlgorithm: string;
    keyWrapAlgorithm: string;
    minioBucket: string;
    filingDate: string;
  };
  certifyingOfficer: {
    name: string;
    designation: string;
    employeeCode: string;
    department: string;
    organization: string;
    hardwareTokenId: string;
  };
  systemNode: {
    nodeId: string;
    operatingSystem: string;
    databaseEngine: string;
    storageCluster: string;
    keyManagementService: string;
  };
  statutoryDeclaration: string;
  qrCodeDataUrl: string;
  auditTrail: Array<{
    id: string;
    eventType: string;
    actor: string;
    actorDesignation: string;
    timestamp: string;
    result: string;
    eventHash: string;
  }>;
}

interface Section65BCertificateModalProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function Section65BCertificateModal({
  documentId,
  isOpen,
  onClose,
}: Section65BCertificateModalProps) {
  const [data, setData] = useState<CertificateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && documentId) {
      setLoading(true);
      setError(null);
      fetch(`/api/documents/${documentId}/certificate`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to generate Section 65B certificate');
          return res.json();
        })
        .then((d) => setData(d.certificate))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [isOpen, documentId]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static">
      <div 
        className="bg-white w-full max-w-4xl rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar (Hidden during Print) */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-[22px]">verified</span>
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Statutory Judicial Evidence Act Certificate
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || !data}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>Print Certificate</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1 rounded"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Certificate Body (Printable Sheet) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white print:p-0 print:overflow-visible">
          {loading ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-medium">Assembling cryptographic custody parameters & Section 65B attestation...</p>
            </div>
          ) : error || !data ? (
            <div className="p-12 text-center text-red-600 text-xs">
              <p className="font-bold">Error: {error || 'Failed to assemble certificate'}</p>
            </div>
          ) : (
            <div className="border-4 border-double border-slate-800 p-6 sm:p-8 flex flex-col gap-6 text-slate-900 font-serif">
              {/* Header Crest & Republic of India */}
              <div className="text-center border-b-2 border-slate-800 pb-5 space-y-1">
                <div className="w-12 h-12 rounded-full bg-slate-900 text-white mx-auto flex items-center justify-center font-sans font-bold shadow-xs">
                  <span className="material-symbols-outlined text-[26px]">shield</span>
                </div>
                <h1 className="text-base sm:text-lg font-bold uppercase tracking-widest text-slate-950 font-sans mt-2">
                  CENTRAL INVESTIGATION BUREAU
                </h1>
                <p className="text-[11px] font-sans text-slate-600 uppercase tracking-wider font-semibold">
                  GOVERNMENT OF INDIA • STATUTORY EVIDENCE DEPOSITORY
                </p>
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900 pt-2 font-sans">
                  CERTIFICATE OF ELECTRONIC EVIDENCE UNDER SECTION 65B(4)
                </h2>
                <p className="text-[10px] text-slate-500 font-sans italic">
                  (Indian Evidence Act, 1872 / Section 63, Bharatiya Sakshya Adhiniyam, 2023)
                </p>
              </div>

              {/* Certificate Metadata Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-200 font-sans text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">CERTIFICATE SERIAL</span>
                  <span className="font-mono font-bold text-blue-900">{data.serialNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">ISSUANCE DATE</span>
                  <span className="font-medium">{new Date(data.generatedAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">JURISDICTION</span>
                  <span className="font-medium truncate block">{data.certifyingOfficer.department}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">EVIDENTIARY STATUS</span>
                  <span className="font-bold text-emerald-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    Primary Court Admissible
                  </span>
                </div>
              </div>

              {/* Certified Evidence Particulars Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold font-sans uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
                  1. Schedule of Electronic Records Produced
                </h3>
                <table className="w-full text-xs font-sans border-collapse border border-slate-300">
                  <tbody className="divide-y divide-slate-200">
                    <tr className="bg-slate-50">
                      <td className="p-2 font-bold w-1/3 border-r border-slate-300">Document / Docket ID</td>
                      <td className="p-2 font-mono font-bold text-blue-900">{data.document.documentNumber}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold border-r border-slate-300">Evidence Title & Summary</td>
                      <td className="p-2">{data.document.title} — {data.document.description}</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="p-2 font-bold border-r border-slate-300">File Name & Stored Size</td>
                      <td className="p-2 font-mono">{data.document.fileName} ({(data.document.fileSize / 1024).toFixed(1)} KB, v{data.document.versionNumber}.0)</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold border-r border-slate-300">Classification Tier</td>
                      <td className="p-2 font-semibold text-amber-900">{data.document.securityTier} ({data.document.securityTierName})</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="p-2 font-bold border-r border-slate-300 text-emerald-900">Bit-Exact SHA-256 Hash Digest</td>
                      <td className="p-2 font-mono text-[11px] font-bold break-all bg-emerald-50 text-emerald-950 p-2 rounded">
                        {data.document.sha256Hash}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold border-r border-slate-300">Cryptographic Cipher & Key Management</td>
                      <td className="p-2 font-mono text-[11px]">{data.document.encryptionAlgorithm} with {data.document.keyWrapAlgorithm}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Statutory Legal Affirmation */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold font-sans uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
                  2. Statutory Declaration of Certifying Custodian
                </h3>
                <div className="text-xs leading-relaxed whitespace-pre-wrap p-4 bg-slate-50/70 border border-slate-200 rounded italic text-slate-800">
                  {data.statutoryDeclaration}
                </div>
              </div>

              {/* Chain of Custody Audit Trail Summary */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold font-sans uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
                  3. Forensic Chain of Custody & Hash Audit Ledger
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] font-sans border-collapse border border-slate-200 text-left">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-1.5">Timestamp (UTC)</th>
                        <th className="p-1.5">Operational Event</th>
                        <th className="p-1.5">Actor / Officer</th>
                        <th className="p-1.5">Result</th>
                        <th className="p-1.5">Tamper-Evident Event Hash</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {data.auditTrail.slice(0, 5).map((a) => (
                        <tr key={a.id}>
                          <td className="p-1.5 font-mono">{new Date(a.timestamp).toLocaleString()}</td>
                          <td className="p-1.5 font-semibold">{a.eventType}</td>
                          <td className="p-1.5">{a.actor}</td>
                          <td className="p-1.5 text-emerald-800 font-bold">{a.result}</td>
                          <td className="p-1.5 font-mono text-[10px] truncate max-w-xs">{a.eventHash ? a.eventHash.substring(0, 16) + '...' : 'SEC-CHAIN'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sign-off, Hardware HSM Stamp & Verification QR Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t-2 border-slate-800 items-center font-sans">
                {/* QR Code Verification */}
                <div className="flex flex-col items-center text-center">
                  <img
                    src={data.qrCodeDataUrl}
                    alt="Section 65B Digital Verification QR Code"
                    className="w-28 h-28 border border-slate-300 p-1 bg-white rounded shadow-2xs"
                  />
                  <span className="text-[10px] font-mono text-slate-500 mt-1 font-semibold">
                    SCAN TO VERIFY LEDGER
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono">
                    ID: {data.serialNumber}
                  </span>
                </div>

                {/* Hardware Server Attestation */}
                <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">SYSTEM REPOSITORY ATTESTATION</span>
                  <div>Node: <strong className="font-mono text-slate-900">{data.systemNode.nodeId}</strong></div>
                  <div>Database: <span className="font-mono text-slate-700">{data.systemNode.databaseEngine}</span></div>
                  <div>Vault: <span className="font-mono text-slate-700">{data.systemNode.keyManagementService}</span></div>
                  <div>Storage: <span className="font-mono text-slate-700">{data.systemNode.storageCluster}</span></div>
                </div>

                {/* Officer Digital Signature Block */}
                <div className="text-right flex flex-col items-end gap-1">
                  <div className="p-2 border-2 border-dashed border-emerald-700 bg-emerald-50/60 rounded text-center w-full max-w-xs">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block tracking-wider">
                      ✓ CRYPTOGRAPHICALLY SIGNED
                    </span>
                    <span className="font-mono text-[10px] text-emerald-900 font-semibold block">
                      TOKEN: {data.certifyingOfficer.hardwareTokenId}
                    </span>
                    <span className="font-mono text-[9px] text-slate-500 block">
                      {new Date(data.generatedAt).toUTCString()}
                    </span>
                  </div>

                  <div className="pt-2 text-xs">
                    <strong className="block text-slate-900 text-sm">{data.certifyingOfficer.name}</strong>
                    <span className="text-slate-600 block">{data.certifyingOfficer.designation}</span>
                    <span className="text-slate-500 block text-[11px] font-mono">Employee Code: {data.certifyingOfficer.employeeCode}</span>
                    <span className="text-slate-700 font-semibold block">{data.certifyingOfficer.organization}</span>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Modal Footer (Hidden during Print) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 print:hidden">
          <span className="text-[11px] font-mono">
            Compliant with Section 65B Indian Evidence Act 1872 / Section 63 BSA 2023
          </span>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || !data}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded flex items-center gap-1 shadow-xs disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[15px]">print</span>
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
