import * as fs from 'fs';
import * as path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  convertInchesToTwip,
} from 'docx';

async function generateDocx() {
  console.log('Generating NIRMAN DMS Master Pitch & Judge Defense Report (.docx)...');

  const borderNone = {
    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  };

  const borderThin = {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
  };

  const createCell = (text: string, bold = false, bg = 'FFFFFF', widthPercent = 50, color = '0F172A') => {
    return new TableCell({
      width: { size: widthPercent, type: WidthType.PERCENTAGE },
      shading: { fill: bg, type: ShadingType.CLEAR },
      margins: { top: convertInchesToTwip(0.08), bottom: convertInchesToTwip(0.08), left: convertInchesToTwip(0.12), right: convertInchesToTwip(0.12) },
      borders: borderThin,
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              bold,
              size: 20, // 10pt
              color,
              font: 'Calibri',
            }),
          ],
        }),
      ],
    });
  };

  const createHeaderCell = (text: string, widthPercent = 50) => {
    return new TableCell({
      width: { size: widthPercent, type: WidthType.PERCENTAGE },
      shading: { fill: '0B1C30', type: ShadingType.CLEAR },
      margins: { top: convertInchesToTwip(0.1), bottom: convertInchesToTwip(0.1), left: convertInchesToTwip(0.12), right: convertInchesToTwip(0.12) },
      borders: borderThin,
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              bold: true,
              size: 21, // 10.5pt
              color: 'FFFFFF',
              font: 'Calibri',
            }),
          ],
        }),
      ],
    });
  };

  const createHeading1 = (title: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360, after: 120 },
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 32, // 16pt
          color: '0B1C30',
          font: 'Calibri',
        }),
      ],
    });

  const createHeading2 = (title: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 80 },
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 26, // 13pt
          color: 'F37021',
          font: 'Calibri',
        }),
      ],
    });

  const createHeading3 = (title: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 180, after: 60 },
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 22, // 11pt
          color: '1E293B',
          font: 'Calibri',
        }),
      ],
    });

  const createParagraph = (text: string, bold = false) =>
    new Paragraph({
      spacing: { before: 60, after: 100 },
      children: [
        new TextRun({
          text,
          bold,
          size: 21, // 10.5pt
          color: '334155',
          font: 'Calibri',
        }),
      ],
    });

  const createBullet = (label: string, text: string) =>
    new Paragraph({
      bullet: { level: 0 },
      spacing: { before: 40, after: 60 },
      children: [
        new TextRun({ text: label + ': ', bold: true, size: 21, color: '0F172A', font: 'Calibri' }),
        new TextRun({ text, size: 21, color: '334155', font: 'Calibri' }),
      ],
    });

  const createCallout = (title: string, content: string, bg = 'F8FAFC', borderColor = 'F37021') => {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: borderNone.top,
        bottom: borderNone.bottom,
        right: borderNone.right,
        left: { style: BorderStyle.SINGLE, size: 24, color: borderColor },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              shading: { fill: bg, type: ShadingType.CLEAR },
              margins: { top: convertInchesToTwip(0.1), bottom: convertInchesToTwip(0.1), left: convertInchesToTwip(0.15), right: convertInchesToTwip(0.15) },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: title, bold: true, size: 22, color: '0B1C30', font: 'Calibri' })],
                }),
                new Paragraph({
                  spacing: { before: 40 },
                  children: [new TextRun({ text: content, size: 20, color: '475569', font: 'Calibri' })],
                }),
              ],
            }),
          ],
        }),
      ],
    });
  };

  const createQAItem = (qNum: string, question: string, answer: string, category: string) => {
    return [
      new Paragraph({
        spacing: { before: 180, after: 40 },
        children: [
          new TextRun({ text: `[${category}] `, bold: true, size: 20, color: 'F37021', font: 'Calibri' }),
          new TextRun({ text: `${qNum}. Question: `, bold: true, size: 22, color: '0B1C30', font: 'Calibri' }),
          new TextRun({ text: `"${question}"`, bold: true, italics: true, size: 22, color: '0F172A', font: 'Calibri' }),
        ],
      }),
      new Paragraph({
        spacing: { before: 40, after: 140 },
        children: [
          new TextRun({ text: 'Winning Answer: ', bold: true, size: 21, color: '059669', font: 'Calibri' }),
          new TextRun({ text: answer, size: 21, color: '334155', font: 'Calibri' }),
        ],
      }),
    ];
  };

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.8),
              bottom: convertInchesToTwip(0.8),
              left: convertInchesToTwip(0.8),
              right: convertInchesToTwip(0.8),
            },
          },
        },
        children: [
          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 60 },
            children: [
              new TextRun({
                text: 'NIRMAN DMS',
                bold: true,
                size: 48, // 24pt
                color: '0B1C30',
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: 'National Sovereign Institutional Document Management System',
                bold: true,
                size: 26,
                color: 'F37021',
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: 'Motto: Organise • Secure • Progress  |  Master Pitch & Judge Defense Dossier',
                italics: true,
                size: 20,
                color: '64748B',
                font: 'Calibri',
              }),
            ],
          }),

          createCallout(
            '🌟 Executive Project Summary',
            'NIRMAN DMS is a defense-grade, legally compliant document management ecosystem built specifically for government administration, judiciary dockets, and law enforcement. It combines FIPS 140-3 compliant Envelope Encryption (AES-256-GCM + HashiCorp Vault KMS), sovereign Hyperledger Fabric blockchain ledger anchoring, Maker-Checker dual-custody change approvals, automated Section 65B/BSA 2023 legal certificates, and full-text OCR intelligence with sub-millisecond lexical search.',
            'F8FAFC',
            '0B1C30'
          ),

          // Section 1
          createHeading1('1. Executive Overview & Problem Statement'),
          createHeading2('1.1 The Critical Problem in Current Systems'),
          createParagraph('Government record rooms and public administration systems suffer from acute vulnerabilities:'),
          createBullet('Tamper Vulnerability', 'Electronic documents in standard relational databases can be quietly modified, deleted, or backdated by malicious insiders or compromised system administrators with direct database access.'),
          createBullet('Judicial Inadmissibility', 'Under Section 65B of the Indian Evidence Act, 1872 (and Section 63 of Bharatiya Sakshya Adhiniyam, 2023 - BSA 2023), digital evidence is routinely rejected in courts without contemporaneous machine attestation, certified hash integrity, and chain of custody logs.'),
          createBullet('Absence of Dual-Custody Controls', 'Sensitive case records (FIRs, legal dockets, tender sanctions) are often updated by a single operator with zero second-party verification, enabling unilateral corruption.'),
          createBullet('Retention & Destruction Gaps', 'Offices lack automated enforcement of statutory retention schedules (BNSS / GFR) and cannot enforce immutable Judicial Legal Holds during ongoing trials.'),
          createBullet('Siloed Scanned Paperwork', 'Scanned physical orders, memos, and handwritten reports remain non-searchable static images.'),

          createHeading2('1.2 The NIRMAN DMS Solution'),
          createParagraph('NIRMAN DMS provides a unified, sovereign architecture that turns ordinary document storage into a tamper-evident, court-ready institutional vault.'),
          createBullet('Envelope Encryption', 'Every document has a dedicated 256-bit DEK generated by Vault KMS; ciphertext stored in private MinIO S3 with AAD docket number binding.'),
          createBullet('Hyperledger Fabric Ledger', 'Every ingestion, edit, and approval is anchored to an immutable permissioned blockchain with Merkle proofs.'),
          createBullet('Maker-Checker Dual Approval', 'Enforces strict separation of duties—requesters cannot approve their own changes on sensitive tiers.'),
          createBullet('Automated Section 65B / BSA 2023 Certificates', 'Generates court-admissible certificates with officer sworn declarations, node custody logs, and high-DPI QR codes.'),
          createBullet('Statutory Retention & Legal Holds', 'Provides statutory retention schedules, immutable freeze under court orders, and DoD 5220.22-M crypto-shredding on expiry.'),
          createBullet('Deep OCR & Lexical Search', 'Extracts and indexes text from scanned files into PostgreSQL GIN search vectors for sub-millisecond search.'),
          createBullet('Public Sovereign Verifier (/verify)', 'Allows citizens, courts, and auditors to verify raw documents, hashes, and QR codes directly against the blockchain.'),

          // Section 2
          createHeading1('2. Complete Technical Stack & Architecture'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('Layer / Component', 30),
                  createHeaderCell('Technology Stack', 30),
                  createHeaderCell('Purpose & Engineering Rationale', 40),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Frontend Framework', true, 'F8FAFC', 30),
                  createCell('Next.js 16.3.4 (App Router), React 19.2.8, TypeScript 5', false, 'FFFFFF', 30),
                  createCell('Server-side rendering, instant client hydration, strict type safety, zero layout shifts.', false, 'FFFFFF', 40),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Styling & 3D UI', true, 'F8FAFC', 30),
                  createCell('TailwindCSS v4, Three.js, @shadergradient/react, @react-three/fiber', false, 'FFFFFF', 30),
                  createCell('Modern glassmorphism, responsive data grids, 3D animated WebGL canvas backgrounds.', false, 'FFFFFF', 40),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Database Engine', true, 'F8FAFC', 30),
                  createCell('PostgreSQL 18 via node-postgres (pg) connection pool', false, 'FFFFFF', 30),
                  createCell('ACID compliance, relational integrity, JSONB feature configs, GIN full-text search indexing.', false, 'FFFFFF', 40),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Encrypted Object Storage', true, 'F8FAFC', 30),
                  createCell('MinIO Private S3 Cluster (@aws-sdk/client-s3)', false, 'FFFFFF', 30),
                  createCell('S3-compatible, high-throughput on-premise encrypted document storage (WORM compliant).', false, 'FFFFFF', 40),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Key Management & Cipher', true, 'F8FAFC', 30),
                  createCell('HashiCorp Vault Transit Engine + AES-256-GCM', false, 'FFFFFF', 30),
                  createCell('256-bit DEK per file, wrapped by Vault Master KEK; AAD docket number binding prevents ciphertext substitution.', false, 'FFFFFF', 40),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Sovereign Blockchain', true, 'F8FAFC', 30),
                  createCell('Hyperledger Fabric 2.5 (Raft Consensus, Docker)', false, 'FFFFFF', 30),
                  createCell('Enterprise permissioned ledger for tamper-evident audit anchoring and Merkle verification without gas fees.', false, 'FFFFFF', 40),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Queues & Rate Limiting', true, 'F8FAFC', 30),
                  createCell('Redis 7 (ioredis)', false, 'FFFFFF', 30),
                  createCell('Sliding-window rate limiting and 5 FIFO background job queues with automatic worker retry.', false, 'FFFFFF', 40),
                ],
              }),
              new TableRow({
                children: [
                  createCell('OCR & Text Intelligence', true, 'F8FAFC', 30),
                  createCell('Tesseract.js 7.0 + pdf-parse 2.4', false, 'FFFFFF', 30),
                  createCell('OCR text extraction of scanned PDFs/images with SHA-256 text checksum attestation.', false, 'FFFFFF', 40),
                ],
              }),
              new TableRow({
                children: [
                  createCell('QR & Barcode Engine', true, 'F8FAFC', 30),
                  createCell('qrcode & jsqr', false, 'FFFFFF', 30),
                  createCell('Generates high-DPI judicial verification QR codes; client-side camera barcode detection.', false, 'FFFFFF', 40),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Auth & Security Matrix', true, 'F8FAFC', 30),
                  createCell('Stateless JWT (jose), bcryptjs, Custom RBAC & Admin Guards', false, 'FFFFFF', 30),
                  createCell('Defense-in-depth authorization, sliding-window rate limiting, tamper-evident audit logging.', false, 'FFFFFF', 40),
                ],
              }),
            ],
          }),

          // Section 3
          createHeading1('3. Detailed 10-Module Feature Breakdown'),
          createHeading2('3.1 Module 1: Overview & Telemetry Dashboard'),
          createParagraph('Displays real-time KPI metrics, total document counts, encryption statuses, pending Maker-Checker approvals, storage quota per department, and live health probes for PostgreSQL, MinIO, Redis, and Vault KMS.'),

          createHeading2('3.2 Module 2: Evidence Ingestion & Cryptographic Vault'),
          createParagraph('Supports single and bulk drag-and-drop uploads. Client browser computes raw SHA-256 hash before upload. Backend generates a 256-bit DEK via HashiCorp Vault, encrypts the payload with AES-256-GCM bound to the docket number with AAD, and stores the ciphertext in MinIO.'),

          createHeading2('3.3 Module 3: Document Repository & Version History'),
          createParagraph('Provides a comprehensive docket explorer with pagination, classification filters (T1 to T5), multi-version tree inspection, instant cryptographic file diffs, and secure on-the-fly decryption download upon RBAC clearance.'),

          createHeading2('3.4 Module 4: Maker-Checker Dual-Custody Approval System'),
          createParagraph('Enforces strict separation of duties. When an officer proposes an update to a T4 (Sensitive) or T5 (Highly Sensitive) docket, it enters a dual-custody queue. Self-approval is strictly blocked. A designated Department Head must review the cryptographic diff, provide a mandatory justification, and sign the approval.'),

          createHeading2('3.5 Module 5: Section 65B / BSA 2023 Judicial Certificate Generator'),
          createParagraph('Generates legally admissible Certificates of Electronic Evidence under Section 65B(4) of the Indian Evidence Act, 1872 / Section 63 of the Bharatiya Sakshya Adhiniyam, 2023. Includes sworn custodian affirmation, system node custody details (OS, PostgreSQL, MinIO, Vault), bit-exact SHA-256 digest, and a high-DPI verification QR code.'),

          createHeading2('3.6 Module 6: Statutory Retention Schedules & Legal Hold Studio'),
          createParagraph('Automates document lifecycle policies (BNSS Schedule I, GFR, Public Records Act). Features Judicial Legal Hold freezing to protect case evidence under active court orders from deletion, and executes DoD 5220.22-M / NIST SP 800-88 crypto-shredding on approved disposal of expired records.'),

          createHeading2('3.7 Module 7: Hyperledger Fabric Blockchain & Public Verifier'),
          createParagraph('Anchors every document and audit event hash to a Hyperledger Fabric permissioned ledger. Computes real-time Merkle proofs. The Public Verifier (/verify) allows direct transaction lookup, raw file drag-and-drop hash matching, and mobile camera QR code scanning without exposing confidential file contents.'),

          createHeading2('3.8 Module 8: Deep OCR Intelligence & Lexical Search'),
          createParagraph('Processes scanned PDFs and images in background queues using Tesseract.js. Commits extracted text to PostgreSQL tsvector search vectors with GIN indexing for sub-millisecond keyword lookups across thousands of pages.'),

          createHeading2('3.9 Module 9: Auditor 360 & Forensic Vigilance Inspector'),
          createParagraph('Provides an immutable, tamper-evident audit trail explorer with chained SHA-256 event hashes. Features Officer Dossiers tracking ingested files, key unwraps, approval history, and anomaly alerts with 1-click forensic CSV/JSON export.'),

          createHeading2('3.10 Module 10: Multi-Sector Institutional Provisioner'),
          createParagraph('Enables 1-click provisioning of customized DMS instances for Police HQs, High Courts, Revenue Collectorates, or Citizen Grievance desks with modular feature toggling (approvals, Section 65B, retention holds, blockchain, OCR).'),

          // Section 4
          createHeading1('4. Pitch Script & 5-Minute Live Demo Flow'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('Time', 15),
                  createHeaderCell('Demo Step', 25),
                  createHeaderCell('Action & Screen', 25),
                  createHeaderCell('Key Pitch Line for Judges', 35),
                ],
              }),
              new TableRow({
                children: [
                  createCell('0:00 - 0:45', true, 'F8FAFC', 15),
                  createCell('Introduction & Problem', false, 'FFFFFF', 25),
                  createCell('Login Page with 3D WebGL Shader Gradient', false, 'FFFFFF', 25),
                  createCell('"Respected judges, official records in India suffer from insider tampering and courtroom inadmissibility under Section 65B. NIRMAN DMS solves this with Envelope Encryption, Blockchain, and Maker-Checker governance."', false, 'FFFFFF', 35),
                ],
              }),
              new TableRow({
                children: [
                  createCell('0:45 - 1:45', true, 'F8FAFC', 15),
                  createCell('Ingestion & Envelope Encryption', false, 'FFFFFF', 25),
                  createCell('Login as Dealing Officer -> Ingest New Document', false, 'FFFFFF', 25),
                  createCell('"The browser hashes the file with SHA-256, Vault KMS generates a unique 256-bit DEK, and AES-256-GCM ciphertext is saved to MinIO. The hash is instantly anchored to our Hyperledger blockchain."', false, 'FFFFFF', 35),
                ],
              }),
              new TableRow({
                children: [
                  createCell('1:45 - 2:45', true, 'F8FAFC', 15),
                  createCell('Maker-Checker Dual Custody', false, 'FFFFFF', 25),
                  createCell('Login as Dept Head -> Sensitive Approvals Queue', false, 'FFFFFF', 25),
                  createCell('"Notice that an officer cannot approve their own changes. The Department Head inspects the cryptographic diff, adds a statutory comment, and digitally signs the approval."', false, 'FFFFFF', 35),
                ],
              }),
              new TableRow({
                children: [
                  createCell('2:45 - 3:45', true, 'F8FAFC', 15),
                  createCell('Section 65B Certificate & QR', false, 'FFFFFF', 25),
                  createCell('Document Details -> Section 65B Certificate Modal', false, 'FFFFFF', 25),
                  createCell('"With one click, NIRMAN DMS generates a court-admissible certificate under Bharatiya Sakshya Adhiniyam, with officer affirmation, server node custody logs, and a high-DPI verification QR code."', false, 'FFFFFF', 35),
                ],
              }),
              new TableRow({
                children: [
                  createCell('3:45 - 4:30', true, 'F8FAFC', 15),
                  createCell('Public Sovereign Verifier', false, 'FFFFFF', 25),
                  createCell('Navigate to /verify -> File Verify / QR Scan', false, 'FFFFFF', 25),
                  createCell('"Any judge or citizen can verify the raw document against our sovereign ledger without exposing confidential file contents."', false, 'FFFFFF', 35),
                ],
              }),
              new TableRow({
                children: [
                  createCell('4:30 - 5:00', true, 'F8FAFC', 15),
                  createCell('Retention & Auditor 360', false, 'FFFFFF', 25),
                  createCell('Retention Studio & Auditor 360 Views', false, 'FFFFFF', 25),
                  createCell('"Active court dockets receive an immutable Legal Hold, while Auditor 360 tracks every decryption and event for complete vigilance accountability."', false, 'FFFFFF', 35),
                ],
              }),
            ],
          }),

          // Section 5
          createHeading1('5. Comprehensive Judge Q&A Defense Matrix'),
          ...createQAItem(
            'Q1',
            'How is your envelope encryption implemented and why is it superior to standard database encryption?',
            'Standard database encryption uses a single master key for all records; if compromised, everything is lost. In NIRMAN DMS, we use Envelope Encryption (FIPS 140-3 architecture): for every document, a fresh 256-bit Data Encryption Key (DEK) is generated by HashiCorp Vault Transit KMS. The payload is encrypted with AES-256-GCM using Additional Authenticated Data (AAD) bound to the docket number. The DEK is encrypted (wrapped) by Vault’s Master KEK. MinIO stores only ciphertext, while the wrapped key resides in PostgreSQL. Stolen disks or databases yield zero plaintexts.',
            'CRYPTOGRAPHY'
          ),

          ...createQAItem(
            'Q2',
            'What is crypto-shredding and how does NIRMAN DMS handle document disposal?',
            'In compliance with DoD 5220.22-M and NIST SP 800-88 standards, NIRMAN DMS executes Cryptographic Zeroization (Crypto-Shredding): when an expired document without legal hold is approved for disposal, the system destroys the wrapped DEK in Vault and the database. Without the 256-bit key, the AES-256-GCM ciphertext in MinIO becomes mathematically irrecoverable noise (2^256 brute-force complexity), eliminating the need for complex physical disk degaussing in distributed cloud nodes.',
            'DATA DISPOSAL'
          ),

          ...createQAItem(
            'Q3',
            'Why did you choose Hyperledger Fabric instead of a public blockchain like Ethereum or Polygon?',
            'Public blockchains violate sovereign data mandates: transaction metadata and timestamps are exposed publicly, and public gas fees impose unpredictable costs on government budgets. Hyperledger Fabric is an enterprise permissioned blockchain with Raft consensus, zero gas fees, high throughput (thousands of TPS), sub-second finality, and complete national data sovereignty.',
            'BLOCKCHAIN'
          ),

          ...createQAItem(
            'Q4',
            'How does public verification work without leaking confidential file contents?',
            'We use Zero-Knowledge / Hash-Only Anchoring: only the bit-exact SHA-256 cryptographic digest of the document and audit event are anchored into the blockchain ledger. When an external auditor or court uploads a file into /verify, the verifier re-calculates the local SHA-256 hash and verifies the Merkle proof against the ledger root. The confidential document content never leaves the secure boundary.',
            'SECURITY'
          ),

          ...createQAItem(
            'Q5',
            'How does your system satisfy Section 65B of the Indian Evidence Act / Section 63 of Bharatiya Sakshya Adhiniyam (BSA 2023)?',
            'The Supreme Court of India (Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal, 2020) mandates that electronic evidence must be accompanied by a contemporaneous certificate signed by the lawful custodian identifying the machine operating condition, hash digest, and output device. NIRMAN DMS automatically generates this certificate with officer designation, system node custody logs, SHA-256 fingerprint, sworn statutory declaration, and a high-DPI verification QR code.',
            'LEGAL COMPLIANCE'
          ),

          ...createQAItem(
            'Q6',
            'What happens if an officer tries to delete or alter a file that is currently evidence in a court trial?',
            'NIRMAN DMS enforces the Judicial Legal Hold Studio: when a court order (e.g., HC-DEL-ORD-2026/991) is linked to a docket, the record is placed in a FROZEN state. Database triggers, API middleware, and background retention workers enforce an absolute immutability lock. Deletion requests are rejected, expiry timers are suspended, and any modification attempts trigger high-severity alerts in Auditor 360.',
            'LEGAL HOLDS'
          ),

          ...createQAItem(
            'Q7',
            'How does the system handle high-volume OCR and blockchain operations without slowing down?',
            'Heavy operations are completely decoupled from user API requests using 5 Distributed Redis FIFO Job Queues (ocr-queue, blockchain-queue, retention-queue, cleanup-queue, notification-queue). When a 50-page docket is uploaded, the API responds immediately (HTTP 201), while asynchronous worker fleets process OCR extraction, full-text GIN indexation, and blockchain batch anchoring in the background.',
            'SCALABILITY'
          ),

          ...createQAItem(
            'Q8',
            'How does NIRMAN DMS adapt to different government departments with varying requirements?',
            'We built a Dynamic Multi-Sector Institutional Provisioner. A High Court or Police Department can enable full Maker-Checker approvals, Section 65B certificates, and Blockchain anchoring. Meanwhile, a municipal tax receipt desk can provision a lightweight tenant disabling judicial certificates while retaining deep OCR and full-text search.',
            'MODULARITY'
          ),

          // Section 6
          createHeading1('6. Pre-Configured Demo Accounts Reference Table'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('Role Title', 25),
                  createHeaderCell('Email / Username', 25),
                  createHeaderCell('Password', 25),
                  createHeaderCell('Access Tier & Key Privileges', 25),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Principal Administrator', true, 'F8FAFC', 25),
                  createCell('admin@dms.gov.in', false, 'FFFFFF', 25),
                  createCell('Admin@DMS2026!', false, 'FFFFFF', 25),
                  createCell('Tier 5 (SuperAdmin): Full system control, user provisioning, role matrices, system health telemetry.', false, 'FFFFFF', 25),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Department Head / Approver', true, 'F8FAFC', 25),
                  createCell('depthead@dms.gov.in', false, 'FFFFFF', 25),
                  createCell('Head@DMS2026!', false, 'FFFFFF', 25),
                  createCell('Tier 4 (Approver): Maker-Checker dual-custody queue, review & digital approval of sensitive dockets.', false, 'FFFFFF', 25),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Dealing Officer', true, 'F8FAFC', 25),
                  createCell('officer@dms.gov.in', false, 'FFFFFF', 25),
                  createCell('Officer@DMS2026!', false, 'FFFFFF', 25),
                  createCell('Tier 3 (Operator): Ingests evidentiary files, requests modifications, manages active dockets.', false, 'FFFFFF', 25),
                ],
              }),
              new TableRow({
                children: [
                  createCell('Compliance & Vigilance Auditor', true, 'F8FAFC', 25),
                  createCell('auditor@dms.gov.in', false, 'FFFFFF', 25),
                  createCell('Auditor@DMS2026!', false, 'FFFFFF', 25),
                  createCell('Tier 5 (Auditor): Read-only Auditor 360, Officer dossiers, Section 65B certificate generation, forensic exports.', false, 'FFFFFF', 25),
                ],
              }),
            ],
          }),

          // Section 7
          createHeading1('7. Pitch Closer & Summary for Judges'),
          createParagraph('NIRMAN DMS bridges the critical gap between institutional security, software scalability, and Indian judicial mandates:'),
          createBullet('Defense-in-Depth Security', 'Envelope Encryption (AES-256-GCM + Vault KMS) ensures data confidentiality; Hyperledger Fabric ensures mathematical immutability; Maker-Checker workflows eliminate rogue insider threats.'),
          createBullet('Built for Indian Judicial Mandates', 'Native Section 65B (IEA 1872) and Section 63 (BSA 2023) compliance makes digital records instantly admissible in any court of law.'),
          createBullet('Enterprise Scalability & Modularity', 'Powered by Next.js 16, PostgreSQL 18, Redis distributed queues, and MinIO S3, NIRMAN DMS scales effortlessly from a single district office to a national sovereign repository.'),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPathDocx = path.resolve(process.cwd(), 'NIRMAN_DMS_Master_Judge_Pitch_Report.docx');
  fs.writeFileSync(outputPathDocx, buffer);
  console.log(`✅ Word Document (.docx) created successfully at: ${outputPathDocx}`);

  // Also create a Word-compatible .doc file (HTML-MIME format)
  const outputPathDoc = path.resolve(process.cwd(), 'NIRMAN_DMS_Master_Judge_Pitch_Report.doc');
  const htmlContent = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<title>NIRMAN DMS - Master Pitch & Judge Defense Report</title>
<style>
  body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.5; color: #1e293b; margin: 1in; }
  h1 { color: #0b1c30; font-size: 18pt; border-bottom: 2px solid #0b1c30; padding-bottom: 4px; margin-top: 24pt; }
  h2 { color: #f37021; font-size: 14pt; margin-top: 18pt; }
  h3 { color: #0f172a; font-size: 12pt; margin-top: 12pt; }
  p { margin-bottom: 8pt; }
  table { width: 100%; border-collapse: collapse; margin: 12pt 0; font-size: 10pt; }
  th { background-color: #0b1c30; color: #ffffff; padding: 8pt; text-align: left; border: 1px solid #cbd5e1; }
  td { padding: 6pt 8pt; border: 1px solid #cbd5e1; vertical-align: top; }
  tr:nth-child(even) { background-color: #f8fafc; }
  .callout { background-color: #f8fafc; border-left: 4px solid #f37021; padding: 10pt 14pt; margin: 12pt 0; }
  .qa-box { background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #059669; padding: 8pt 12pt; margin: 10pt 0; }
  .badge { display: inline-block; background-color: #f37021; color: white; padding: 2px 6px; font-size: 8pt; font-weight: bold; border-radius: 4px; }
  .title-block { text-align: center; margin-bottom: 20pt; }
  .motto { color: #64748b; font-style: italic; font-size: 11pt; }
</style>
</head>
<body>
<div class="title-block">
  <h1 style="border:none; font-size: 24pt; margin-bottom: 4pt; color: #0b1c30;">NIRMAN DMS</h1>
  <div style="font-size: 14pt; font-weight: bold; color: #f37021; margin-bottom: 6pt;">National Sovereign Institutional Document Management System</div>
  <div class="motto">Motto: Organise • Secure • Progress | Master Pitch & Judge Defense Dossier</div>
</div>

<div class="callout">
  <strong>🌟 Executive Project Summary:</strong> NIRMAN DMS is a defense-grade, legally compliant document management ecosystem built specifically for government administration, judiciary dockets, and law enforcement. It combines FIPS 140-3 compliant Envelope Encryption (AES-256-GCM + HashiCorp Vault KMS), sovereign Hyperledger Fabric blockchain ledger anchoring, Maker-Checker dual-custody change approvals, automated Section 65B/BSA 2023 legal certificates, and full-text OCR intelligence with sub-millisecond lexical search.
</div>

<h1>1. Executive Overview & Problem Statement</h1>
<h2>1.1 The Critical Problem in Current Systems</h2>
<p>Government record rooms and public administration systems suffer from acute vulnerabilities:</p>
<ul>
  <li><strong>Tamper Vulnerability:</strong> Electronic documents in standard relational databases can be quietly modified, deleted, or backdated by malicious insiders or compromised system administrators with direct database access.</li>
  <li><strong>Judicial Inadmissibility:</strong> Under Section 65B of the Indian Evidence Act, 1872 (and Section 63 of Bharatiya Sakshya Adhiniyam, 2023 - BSA 2023), digital evidence is routinely rejected in courts without contemporaneous machine attestation, certified hash integrity, and chain of custody logs.</li>
  <li><strong>Absence of Dual-Custody Controls:</strong> Sensitive case records (FIRs, legal dockets, tender sanctions) are often updated by a single operator with zero second-party verification, enabling unilateral corruption.</li>
  <li><strong>Retention & Destruction Gaps:</strong> Offices lack automated enforcement of statutory retention schedules (BNSS / GFR) and cannot enforce immutable Judicial Legal Holds during ongoing trials.</li>
  <li><strong>Siloed Scanned Paperwork:</strong> Scanned physical orders, memos, and handwritten reports remain non-searchable static images.</li>
</ul>

<h2>1.2 The NIRMAN DMS Solution</h2>
<p>NIRMAN DMS provides a unified, sovereign architecture that turns ordinary document storage into a tamper-evident, court-ready institutional vault.</p>
<ul>
  <li><strong>Envelope Encryption:</strong> Every document has a dedicated 256-bit DEK generated by Vault KMS; ciphertext stored in private MinIO S3 with AAD docket number binding.</li>
  <li><strong>Hyperledger Fabric Ledger:</strong> Every ingestion, edit, and approval is anchored to an immutable permissioned blockchain with Merkle proofs.</li>
  <li><strong>Maker-Checker Dual Approval:</strong> Enforces strict separation of duties—requesters cannot approve their own changes on sensitive tiers.</li>
  <li><strong>Automated Section 65B / BSA 2023 Certificates:</strong> Generates court-admissible certificates with officer sworn declarations, node custody logs, and high-DPI QR codes.</li>
  <li><strong>Statutory Retention & Legal Holds:</strong> Provides statutory retention schedules, immutable freeze under court orders, and DoD 5220.22-M crypto-shredding on expiry.</li>
  <li><strong>Deep OCR & Lexical Search:</strong> Extracts and indexes text from scanned files into PostgreSQL GIN search vectors for sub-millisecond search.</li>
  <li><strong>Public Sovereign Verifier (/verify):</strong> Allows citizens, courts, and auditors to verify raw documents, hashes, and QR codes directly against the blockchain.</li>
</ul>

<h1>2. Complete Technical Stack & Architecture</h1>
<table>
  <thead>
    <tr>
      <th>Layer / Component</th>
      <th>Technology Stack</th>
      <th>Purpose & Engineering Rationale</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Frontend Framework</strong></td>
      <td>Next.js 16.3.4 (App Router), React 19.2.8, TypeScript 5</td>
      <td>Server-side rendering, instant client hydration, strict type safety, zero layout shifts.</td>
    </tr>
    <tr>
      <td><strong>Styling & 3D UI</strong></td>
      <td>TailwindCSS v4, Three.js, @shadergradient/react, @react-three/fiber</td>
      <td>Modern glassmorphism, responsive data grids, 3D animated WebGL canvas backgrounds.</td>
    </tr>
    <tr>
      <td><strong>Database Engine</strong></td>
      <td>PostgreSQL 18 via node-postgres (pg) connection pool</td>
      <td>ACID compliance, relational integrity, JSONB feature configs, GIN full-text search indexing.</td>
    </tr>
    <tr>
      <td><strong>Encrypted Object Storage</strong></td>
      <td>MinIO Private S3 Cluster (@aws-sdk/client-s3)</td>
      <td>S3-compatible, high-throughput on-premise encrypted document storage (WORM compliant).</td>
    </tr>
    <tr>
      <td><strong>Key Management & Cipher</strong></td>
      <td>HashiCorp Vault Transit Engine + AES-256-GCM</td>
      <td>256-bit DEK per file, wrapped by Vault Master KEK; AAD docket number binding prevents ciphertext substitution.</td>
    </tr>
    <tr>
      <td><strong>Sovereign Blockchain</strong></td>
      <td>Hyperledger Fabric 2.5 (Raft Consensus, Docker)</td>
      <td>Enterprise permissioned ledger for tamper-evident audit anchoring and Merkle verification without gas fees.</td>
    </tr>
    <tr>
      <td><strong>Queues & Rate Limiting</strong></td>
      <td>Redis 7 (ioredis)</td>
      <td>Sliding-window rate limiting and 5 FIFO background job queues with automatic worker retry.</td>
    </tr>
    <tr>
      <td><strong>OCR & Text Intelligence</strong></td>
      <td>Tesseract.js 7.0 + pdf-parse 2.4</td>
      <td>OCR text extraction of scanned PDFs/images with SHA-256 text checksum attestation.</td>
    </tr>
    <tr>
      <td><strong>QR & Barcode Engine</strong></td>
      <td>qrcode & jsqr</td>
      <td>Generates high-DPI judicial verification QR codes; client-side camera barcode detection.</td>
    </tr>
    <tr>
      <td><strong>Auth & Security Matrix</strong></td>
      <td>Stateless JWT (jose), bcryptjs, Custom RBAC & Admin Guards</td>
      <td>Defense-in-depth authorization, sliding-window rate limiting, tamper-evident audit logging.</td>
    </tr>
  </tbody>
</table>

<h1>3. Detailed 10-Module Feature Breakdown</h1>
<h3>3.1 Module 1: Overview & Telemetry Dashboard</h3>
<p>Displays real-time KPI metrics, total document counts, encryption statuses, pending Maker-Checker approvals, storage quota per department, and live health probes for PostgreSQL, MinIO, Redis, and Vault KMS.</p>

<h3>3.2 Module 2: Evidence Ingestion & Cryptographic Vault</h3>
<p>Supports single and bulk drag-and-drop uploads. Client browser computes raw SHA-256 hash before upload. Backend generates a 256-bit DEK via HashiCorp Vault, encrypts the payload with AES-256-GCM bound to the docket number with AAD, and stores the ciphertext in MinIO.</p>

<h3>3.3 Module 3: Document Repository & Version History</h3>
<p>Provides a comprehensive docket explorer with pagination, classification filters (T1 to T5), multi-version tree inspection, instant cryptographic file diffs, and secure on-the-fly decryption download upon RBAC clearance.</p>

<h3>3.4 Module 4: Maker-Checker Dual-Custody Approval System</h3>
<p>Enforces strict separation of duties. When an officer proposes an update to a T4 (Sensitive) or T5 (Highly Sensitive) docket, it enters a dual-custody queue. Self-approval is strictly blocked. A designated Department Head must review the cryptographic diff, provide a mandatory justification, and sign the approval.</p>

<h3>3.5 Module 5: Section 65B / BSA 2023 Judicial Certificate Generator</h3>
<p>Generates legally admissible Certificates of Electronic Evidence under Section 65B(4) of the Indian Evidence Act, 1872 / Section 63 of the Bharatiya Sakshya Adhiniyam, 2023. Includes sworn custodian affirmation, system node custody details (OS, PostgreSQL, MinIO, Vault), bit-exact SHA-256 digest, and a high-DPI verification QR code.</p>

<h3>3.6 Module 6: Statutory Retention Schedules & Legal Hold Studio</h3>
<p>Automates document lifecycle policies (BNSS Schedule I, GFR, Public Records Act). Features Judicial Legal Hold freezing to protect case evidence under active court orders from deletion, and executes DoD 5220.22-M / NIST SP 800-88 crypto-shredding on approved disposal of expired records.</p>

<h3>3.7 Module 7: Hyperledger Fabric Blockchain & Public Verifier</h3>
<p>Anchors every document and audit event hash to a Hyperledger Fabric permissioned ledger. Computes real-time Merkle proofs. The Public Verifier (/verify) allows direct transaction lookup, raw file drag-and-drop hash matching, and mobile camera QR code scanning without exposing confidential file contents.</p>

<h3>3.8 Module 8: Deep OCR Intelligence & Lexical Search</h3>
<p>Processes scanned PDFs and images in background queues using Tesseract.js. Commits extracted text to PostgreSQL tsvector search vectors with GIN indexing for sub-millisecond keyword lookups across thousands of pages.</p>

<h3>3.9 Module 9: Auditor 360 & Forensic Vigilance Inspector</h3>
<p>Provides an immutable, tamper-evident audit trail explorer with chained SHA-256 event hashes. Features Officer Dossiers tracking ingested files, key unwraps, approval history, and anomaly alerts with 1-click forensic CSV/JSON export.</p>

<h3>3.10 Module 10: Multi-Sector Institutional Provisioner</h3>
<p>Enables 1-click provisioning of customized DMS instances for Police HQs, High Courts, Revenue Collectorates, or Citizen Grievance desks with modular feature toggling (approvals, Section 65B, retention holds, blockchain, OCR).</p>

<h1>4. Pitch Script & 5-Minute Live Demo Flow</h1>
<table>
  <thead>
    <tr>
      <th>Time</th>
      <th>Demo Step</th>
      <th>Action & Screen</th>
      <th>Key Pitch Line for Judges</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>0:00 - 0:45</strong></td>
      <td>Introduction & Problem</td>
      <td>Login Page with 3D WebGL Shader Gradient</td>
      <td>"Respected judges, official records in India suffer from insider tampering and courtroom inadmissibility under Section 65B. NIRMAN DMS solves this with Envelope Encryption, Blockchain, and Maker-Checker governance."</td>
    </tr>
    <tr>
      <td><strong>0:45 - 1:45</strong></td>
      <td>Ingestion & Envelope Encryption</td>
      <td>Login as Dealing Officer -> Ingest New Document</td>
      <td>"The browser hashes the file with SHA-256, Vault KMS generates a unique 256-bit DEK, and AES-256-GCM ciphertext is saved to MinIO. The hash is instantly anchored to our Hyperledger blockchain."</td>
    </tr>
    <tr>
      <td><strong>1:45 - 2:45</strong></td>
      <td>Maker-Checker Dual Custody</td>
      <td>Login as Dept Head -> Sensitive Approvals Queue</td>
      <td>"Notice that an officer cannot approve their own changes. The Department Head inspects the cryptographic diff, adds a statutory comment, and digitally signs the approval."</td>
    </tr>
    <tr>
      <td><strong>2:45 - 3:45</strong></td>
      <td>Section 65B Certificate & QR</td>
      <td>Document Details -> Section 65B Certificate Modal</td>
      <td>"With one click, NIRMAN DMS generates a court-admissible certificate under Bharatiya Sakshya Adhiniyam, with officer affirmation, server node custody logs, and a high-DPI verification QR code."</td>
    </tr>
    <tr>
      <td><strong>3:45 - 4:30</strong></td>
      <td>Public Sovereign Verifier</td>
      <td>Navigate to /verify -> File Verify / QR Scan</td>
      <td>"Any judge or citizen can verify the raw document against our sovereign ledger without exposing confidential file contents."</td>
    </tr>
    <tr>
      <td><strong>4:30 - 5:00</strong></td>
      <td>Retention & Auditor 360</td>
      <td>Retention Studio & Auditor 360 Views</td>
      <td>"Active court dockets receive an immutable Legal Hold, while Auditor 360 tracks every decryption and event for complete vigilance accountability."</td>
    </tr>
  </tbody>
</table>

<h1>5. Comprehensive Judge Q&A Defense Matrix</h1>

<div class="qa-box">
  <span class="badge">CRYPTOGRAPHY</span>
  <p><strong>Q1: "How is your envelope encryption implemented and why is it superior to standard database encryption?"</strong></p>
  <p><strong>Winning Answer:</strong> Standard database encryption uses a single master key for all records; if compromised, everything is lost. In NIRMAN DMS, we use Envelope Encryption (FIPS 140-3 architecture): for every document, a fresh 256-bit Data Encryption Key (DEK) is generated by HashiCorp Vault Transit KMS. The payload is encrypted with AES-256-GCM using Additional Authenticated Data (AAD) bound to the docket number. The DEK is encrypted (wrapped) by Vault’s Master KEK. MinIO stores only ciphertext, while the wrapped key resides in PostgreSQL. Stolen disks or databases yield zero plaintexts.</p>
</div>

<div class="qa-box">
  <span class="badge">DATA DISPOSAL</span>
  <p><strong>Q2: "What is crypto-shredding and how does NIRMAN DMS handle document disposal?"</strong></p>
  <p><strong>Winning Answer:</strong> In compliance with DoD 5220.22-M and NIST SP 800-88 standards, NIRMAN DMS executes Cryptographic Zeroization (Crypto-Shredding): when an expired document without legal hold is approved for disposal, the system destroys the wrapped DEK in Vault and the database. Without the 256-bit key, the AES-256-GCM ciphertext in MinIO becomes mathematically irrecoverable noise (2^256 brute-force complexity), eliminating the need for complex physical disk degaussing in distributed cloud nodes.</p>
</div>

<div class="qa-box">
  <span class="badge">BLOCKCHAIN</span>
  <p><strong>Q3: "Why did you choose Hyperledger Fabric instead of a public blockchain like Ethereum or Polygon?"</strong></p>
  <p><strong>Winning Answer:</strong> Public blockchains violate sovereign data mandates: transaction metadata and timestamps are exposed publicly, and public gas fees impose unpredictable costs on government budgets. Hyperledger Fabric is an enterprise permissioned blockchain with Raft consensus, zero gas fees, high throughput (thousands of TPS), sub-second finality, and complete national data sovereignty.</p>
</div>

<div class="qa-box">
  <span class="badge">SECURITY</span>
  <p><strong>Q4: "How does public verification work without leaking confidential file contents?"</strong></p>
  <p><strong>Winning Answer:</strong> We use Zero-Knowledge / Hash-Only Anchoring: only the bit-exact SHA-256 cryptographic digest of the document and audit event are anchored into the blockchain ledger. When an external auditor or court uploads a file into /verify, the verifier re-calculates the local SHA-256 hash and verifies the Merkle proof against the ledger root. The confidential document content never leaves the secure boundary.</p>
</div>

<div class="qa-box">
  <span class="badge">LEGAL COMPLIANCE</span>
  <p><strong>Q5: "How does your system satisfy Section 65B of the Indian Evidence Act / Section 63 of Bharatiya Sakshya Adhiniyam (BSA 2023)?"</strong></p>
  <p><strong>Winning Answer:</strong> The Supreme Court of India (Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal, 2020) mandates that electronic evidence must be accompanied by a contemporaneous certificate signed by the lawful custodian identifying the machine operating condition, hash digest, and output device. NIRMAN DMS automatically generates this certificate with officer designation, system node custody logs, SHA-256 fingerprint, sworn statutory declaration, and a high-DPI verification QR code.</p>
</div>

<div class="qa-box">
  <span class="badge">LEGAL HOLDS</span>
  <p><strong>Q6: "What happens if an officer tries to delete or alter a file that is currently evidence in a court trial?"</strong></p>
  <p><strong>Winning Answer:</strong> NIRMAN DMS enforces the Judicial Legal Hold Studio: when a court order (e.g., HC-DEL-ORD-2026/991) is linked to a docket, the record is placed in a FROZEN state. Database triggers, API middleware, and background retention workers enforce an absolute immutability lock. Deletion requests are rejected, expiry timers are suspended, and any modification attempts trigger high-severity alerts in Auditor 360.</p>
</div>

<div class="qa-box">
  <span class="badge">SCALABILITY</span>
  <p><strong>Q7: "How does the system handle high-volume OCR and blockchain operations without slowing down?"</strong></p>
  <p><strong>Winning Answer:</strong> Heavy operations are completely decoupled from user API requests using 5 Distributed Redis FIFO Job Queues (ocr-queue, blockchain-queue, retention-queue, cleanup-queue, notification-queue). When a 50-page docket is uploaded, the API responds immediately (HTTP 201), while asynchronous worker fleets process OCR extraction, full-text GIN indexation, and blockchain batch anchoring in the background.</p>
</div>

<div class="qa-box">
  <span class="badge">MODULARITY</span>
  <p><strong>Q8: "How does NIRMAN DMS adapt to different government departments with varying requirements?"</strong></p>
  <p><strong>Winning Answer:</strong> We built a Dynamic Multi-Sector Institutional Provisioner. A High Court or Police Department can enable full Maker-Checker approvals, Section 65B certificates, and Blockchain anchoring. Meanwhile, a municipal tax receipt desk can provision a lightweight tenant disabling judicial certificates while retaining deep OCR and full-text search.</p>
</div>

<h1>6. Pre-Configured Demo Accounts Reference Table</h1>
<table>
  <thead>
    <tr>
      <th>Role Title</th>
      <th>Email / Username</th>
      <th>Password</th>
      <th>Access Tier & Key Privileges</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Principal Administrator</strong></td>
      <td>admin@dms.gov.in</td>
      <td>Admin@DMS2026!</td>
      <td><strong>Tier 5 (SuperAdmin):</strong> Full system control, user provisioning, role matrices, system health telemetry.</td>
    </tr>
    <tr>
      <td><strong>Department Head / Approver</strong></td>
      <td>depthead@dms.gov.in</td>
      <td>Head@DMS2026!</td>
      <td><strong>Tier 4 (Approver):</strong> Maker-Checker dual-custody queue, review & digital approval of sensitive dockets.</td>
    </tr>
    <tr>
      <td><strong>Dealing Officer</strong></td>
      <td>officer@dms.gov.in</td>
      <td>Officer@DMS2026!</td>
      <td><strong>Tier 3 (Operator):</strong> Ingests evidentiary files, requests modifications, manages active dockets.</td>
    </tr>
    <tr>
      <td><strong>Compliance & Vigilance Auditor</strong></td>
      <td>auditor@dms.gov.in</td>
      <td>Auditor@DMS2026!</td>
      <td><strong>Tier 5 (Auditor):</strong> Read-only Auditor 360, Officer dossiers, Section 65B certificate generation, forensic exports.</td>
    </tr>
  </tbody>
</table>

<h1>7. Pitch Closer & Summary for Judges</h1>
<p>NIRMAN DMS bridges the critical gap between institutional security, software scalability, and Indian judicial mandates:</p>
<ul>
  <li><strong>Defense-in-Depth Security:</strong> Envelope Encryption (AES-256-GCM + Vault KMS) ensures data confidentiality; Hyperledger Fabric ensures mathematical immutability; Maker-Checker workflows eliminate rogue insider threats.</li>
  <li><strong>Built for Indian Judicial Mandates:</strong> Native Section 65B (IEA 1872) and Section 63 (BSA 2023) compliance makes digital records instantly admissible in any court of law.</li>
  <li><strong>Enterprise Scalability & Modularity:</strong> Powered by Next.js 16, PostgreSQL 18, Redis distributed queues, and MinIO S3, NIRMAN DMS scales effortlessly from a single district office to a national sovereign repository.</li>
</ul>

</body>
</html>
`;

  fs.writeFileSync(outputPathDoc, htmlContent);
  console.log(`✅ Word Document (.doc) created successfully at: ${outputPathDoc}`);
}

generateDocx().catch((err) => {
  console.error('Error generating document:', err);
  process.exit(1);
});
