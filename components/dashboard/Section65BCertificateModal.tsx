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
    const certElement = document.getElementById('section-65b-printable-certificate');
    if (!certElement) {
      window.print();
      return;
    }

    // 1. Create a dedicated hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!frameDoc) {
      window.print();
      return;
    }

    // 2. Clone CSS links and <style> blocks from main document
    let stylesHtml = '';
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
      stylesHtml += node.outerHTML;
    });

    // 3. Write isolated printable HTML document into the iframe
    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Section 65B Statutory Certificate - ${data?.serialNumber || 'Official'}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
          ${stylesHtml}
          <style>
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
              box-sizing: border-box;
            }
            @page {
              size: A4 portrait;
              margin: 8mm 6mm;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #0f172a !important;
              font-family: 'Times New Roman', Times, Georgia, serif !important;
            }
            #section-65b-printable-certificate,
            #section-65b-printable-certificate * {
              font-family: 'Times New Roman', Times, Georgia, serif !important;
            }
            #section-65b-printable-certificate {
              display: flex !important;
              flex-direction: column !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 auto !important;
              padding: 18px !important;
              background: #ffffff !important;
              border: 4px double #1e293b !important;
              box-shadow: none !important;
            }
            .break-inside-avoid {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            img[alt*="Section 65B Digital Verification QR Code"] {
              width: 140px !important;
              height: 140px !important;
              object-fit: contain !important;
            }
          </style>
        </head>
        <body class="p-1 bg-white">
          ${certElement.outerHTML}
        </body>
      </html>
    `);
    frameDoc.close();

    // 4. Trigger print once fonts/images are parsed
    const trigger = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Iframe print failed, fallback to window.print:', err);
        window.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1500);
      }
    };

    setTimeout(trigger, 250);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#10141A]/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto font-sans text-[#151c27]">
      <div 
        className="bg-white w-full max-w-4xl rounded-[26px] shadow-2xl border border-[#D8DEEA] flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar (Hidden during Print) */}
        <div className="p-4 border-b border-[#D8DEEA]/60 bg-[#f0f3ff]/40 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#3f5e93] text-[22px]">verified</span>
            <span className="text-xs font-bold text-[#151c27] uppercase tracking-wider">
              Statutory Evidence Act Certificate (Section 65B)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || !data}
              className="h-8 px-4 bg-[#000000] hover:bg-[#181c22] text-white text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>Print Certificate</span>
            </button>
            <button
              onClick={onClose}
              className="text-[#9CA3AF] hover:text-[#151c27] p-1.5 rounded-full cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Certificate Body (Printable Sheet) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white print:p-0 print:overflow-visible">
          {loading ? (
            <div className="p-16 text-center text-[#9CA3AF] flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-[#3f5e93] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-medium">Assembling cryptographic custody parameters &amp; Section 65B attestation...</p>
            </div>
          ) : error || !data ? (
            <div className="p-12 text-center text-red-600 text-xs">
              <p className="font-bold">Error: {error || 'Failed to assemble certificate'}</p>
            </div>
          ) : (
            <div 
              id="section-65b-printable-certificate" 
              className="border-4 border-double border-slate-800 p-6 sm:p-8 flex flex-col gap-6 text-slate-900 bg-white"
              style={{ fontFamily: '"Times New Roman", Times, Georgia, serif' }}
            >
              {/* Header Crest */}
              <div className="text-center border-b-2 border-slate-800 pb-5 space-y-1 break-inside-avoid">
                <img src="/nirman-logo.png" alt="NIRMAN DMS" className="w-16 h-16 object-contain mx-auto mb-1 drop-shadow-sm" />
                <h1 className="text-base sm:text-lg font-bold uppercase tracking-widest text-slate-950 mt-2">
                  NIRMAN DMS &bull; SOVEREIGN DIGITAL RECORD REPOSITORY
                </h1>
                <p className="text-[12px] text-amber-800 uppercase tracking-wider font-bold">
                  ORGANISE &bull; SECURE &bull; PROGRESS
                </p>
                <h2 className="text-base font-bold uppercase tracking-wide text-slate-900 pt-2">
                  CERTIFICATE OF ELECTRONIC EVIDENCE UNDER SECTION 65B(4)
                </h2>
                <p className="text-[11px] text-slate-600 italic">
                  (Indian Evidence Act, 1872 / Section 63, Bharatiya Sakshya Adhiniyam, 2023)
                </p>
              </div>

              {/* Certificate Metadata Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#f0f3ff]/60 p-3.5 rounded-2xl border border-[#D8DEEA] text-xs break-inside-avoid">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">CERTIFICATE SERIAL</span>
                  <span className="font-bold text-[#3f5e93]">{data.serialNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">ISSUANCE DATE</span>
                  <span className="font-medium">{new Date(data.generatedAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">JURISDICTION</span>
                  <span className="font-medium truncate block">{data.certifyingOfficer.department}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">EVIDENTIARY STATUS</span>
                  <span className="font-bold text-emerald-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    Court Admissible
                  </span>
                </div>
              </div>

              {/* Certified Evidence Particulars Table */}
              <div className="space-y-2 break-inside-avoid">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
                  1. Schedule of Electronic Records Produced
                </h3>
                <table className="w-full text-xs border-collapse border border-slate-300">
                  <tbody className="divide-y divide-slate-200">
                    <tr className="bg-slate-50">
                      <td className="p-2 font-bold w-1/3 border-r border-slate-300">Document / Docket ID</td>
                      <td className="p-2 font-bold text-[#3f5e93]">{data.document.documentNumber}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold border-r border-slate-300">Evidence Title &amp; Summary</td>
                      <td className="p-2">{data.document.title} — {data.document.description}</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="p-2 font-bold border-r border-slate-300">File Name &amp; Stored Size</td>
                      <td className="p-2">{data.document.fileName} ({(data.document.fileSize / 1024).toFixed(1)} KB, v{data.document.versionNumber}.0)</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold border-r border-slate-300">Classification Tier</td>
                      <td className="p-2 font-semibold text-amber-900">{data.document.securityTier} ({data.document.securityTierName})</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="p-2 font-bold border-r border-slate-300 text-emerald-900">Bit-Exact SHA-256 Hash Digest</td>
                      <td className="p-2 text-[11px] font-bold break-all bg-emerald-50 text-emerald-950 p-2 rounded">
                        {data.document.sha256Hash}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold border-r border-slate-300">Cryptographic Cipher &amp; Storage</td>
                      <td className="p-2 text-[11px]">{data.document.encryptionAlgorithm} with {data.document.keyWrapAlgorithm}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Statutory Legal Affirmation */}
              <div className="space-y-2 break-inside-avoid">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
                  2. Statutory Declaration of Certifying Custodian
                </h3>
                <div className="text-xs leading-relaxed whitespace-pre-wrap p-4 bg-slate-50/70 border border-slate-200 rounded-xl italic text-slate-800">
                  {data.statutoryDeclaration}
                </div>
              </div>

              {/* Forensic Chain of Custody Audit Trail Summary */}
              <div className="space-y-2 break-inside-avoid">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
                  3. Forensic Chain of Custody &amp; Hash Audit Ledger
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] border-collapse border border-slate-200 text-left">
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
                          <td className="p-1.5">{new Date(a.timestamp).toLocaleString()}</td>
                          <td className="p-1.5 font-semibold">{a.eventType}</td>
                          <td className="p-1.5">{a.actor}</td>
                          <td className="p-1.5 text-emerald-800 font-bold">{a.result}</td>
                          <td className="p-1.5 text-[10px] truncate max-w-xs">{a.eventHash ? a.eventHash.substring(0, 16) + '...' : 'SEC-CHAIN'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sign-off & Verification QR Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t-2 border-slate-800 items-center break-inside-avoid">
                {/* QR Code Verification */}
                <div className="flex flex-col items-center text-center">
                  <div className="p-2 bg-white rounded-2xl border-2 border-slate-800 shadow-md">
                    <img
                      src={data.qrCodeDataUrl}
                      alt="Section 65B Digital Verification QR Code"
                      className="w-36 h-36 sm:w-40 sm:h-40 object-contain"
                    />
                  </div>
                  <span className="text-[11px] text-slate-800 mt-2 font-bold tracking-wider">
                    SCAN TO VERIFY LEDGER
                  </span>
                  <span className="text-[9.5px] font-mono text-slate-600">
                    ID: {data.serialNumber}
                  </span>
                </div>

                {/* System Repository Attestation */}
                <div className="text-xs text-slate-600 space-y-1 bg-[#f0f3ff]/60 p-3.5 rounded-2xl border border-[#D8DEEA]">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">SYSTEM REPOSITORY ATTESTATION</span>
                  <div>Node: <strong className="text-slate-900">{data.systemNode.nodeId}</strong></div>
                  <div>Database: <span className="text-slate-700">{data.systemNode.databaseEngine}</span></div>
                  <div>Vault: <span className="text-slate-700">{data.systemNode.keyManagementService}</span></div>
                </div>

                {/* Officer Digital Signature Block */}
                <div className="text-right flex flex-col items-end gap-1">
                  <div className="p-2 border-2 border-dashed border-emerald-700 bg-emerald-50/60 rounded-xl text-center w-full max-w-xs">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block tracking-wider">
                      ✓ CRYPTOGRAPHICALLY SIGNED
                    </span>
                    <span className="text-[10px] text-emerald-900 font-semibold block">
                      TOKEN: {data.certifyingOfficer.hardwareTokenId}
                    </span>
                  </div>

                  <div className="pt-2 text-xs">
                    <strong className="block text-slate-900 text-sm">{data.certifyingOfficer.name}</strong>
                    <span className="text-slate-600 block">{data.certifyingOfficer.designation}</span>
                    <span className="text-slate-500 block text-[11px]">Employee Code: {data.certifyingOfficer.employeeCode}</span>
                    <span className="text-slate-700 font-semibold block">{data.certifyingOfficer.organization}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer (Hidden during Print) */}
        <div className="p-4 bg-[#f0f3ff]/40 border-t border-[#D8DEEA]/60 flex items-center justify-between text-xs text-[#45474b] print:hidden">
          <span className="text-[11px] font-mono">
            Compliant with Section 65B Indian Evidence Act 1872 / Section 63 BSA 2023
          </span>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || !data}
              className="h-8 px-4 bg-[#000000] hover:bg-[#181c22] text-white text-xs font-semibold rounded-full flex items-center gap-1 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">print</span>
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="h-8 px-4 bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] text-xs font-semibold rounded-full cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
