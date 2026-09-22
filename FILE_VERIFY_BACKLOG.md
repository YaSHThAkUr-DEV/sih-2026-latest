# File Verify Module (Backlog & Reference)

## Overview
The File Verify module allows users to drag & drop or upload raw evidence files or Section 65B Statutory Certificate PDFs/HTML/images to authenticate them directly against the Hyperledger Fabric sovereign blockchain.

## Backend Endpoint
The backend implementation is located at:
- [`app/api/blockchain/verify-file/route.ts`](file:///c:/Users/YASH/Desktop/sih-26190-latest/app/api/blockchain/verify-file/route.ts)

It accepts `multipart/form-data` with a `file` field and performs:
1. Client/Server SHA-256 computation on raw evidence bytes.
2. Fast `zlib` stream decompression for printed Section 65B Certificate PDFs.
3. Automatic extraction of Document Reference Numbers (`DOC-...`), Certificate Serials (`SEC65B-...`), and Bit-Exact SHA-256 Digests.
4. Resolution against `blockchain_records`, `document_versions`, and `audit_events`.

## Frontend Tab Snippet (To Re-Enable)
In [`app/verify/page.tsx`](file:///c:/Users/YASH/Desktop/sih-26190-latest/app/verify/page.tsx):

1. Change `grid-cols-2` back to `grid-cols-3` in the tab bar.
2. Insert the File Verify button:
```tsx
<button
  type="button"
  onClick={() => setActiveTab('FILE')}
  className={`py-3 px-2 min-h-[48px] rounded-xl text-xs sm:text-sm font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all cursor-pointer text-center touch-manipulation active:scale-95 ${
    activeTab === 'FILE'
      ? 'bg-[#0B1C30] text-white shadow-md'
      : 'text-[#475569] bg-white sm:bg-transparent border border-[#CBD5E1] sm:border-transparent hover:text-[#0B1C30] hover:bg-slate-200/60'
  }`}
>
  <span className="material-symbols-outlined text-[20px] pointer-events-none">upload_file</span>
  <span className="leading-tight pointer-events-none">File Verify</span>
</button>
```
