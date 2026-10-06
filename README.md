# Tender Document Package Builder

**Name:** Ratul Hasan  
**Registration Number:** NOT GIVEN 
**Live HTTPS Link:** (https://ratulhasan02.github.io/tender-document-package-builder/)

## How to run
```bash
npm install
npm run dev
```

## Production build
```bash
npm run build
```
Build output: `dist/`

## Main features
- Tender details and ordered requirements
- PDF-only multi-file upload, with 30-file / 50 MB limits
- Browser-side PDF page counting
- One-to-one file matching
- Expiry date validation against the submission deadline
- Missing, Expiry date needed, Expired, Not provided, and OK statuses
- SHA-256 exact-content duplicate detection
- Generate button blocked by blocking statuses
- Browser-only combined PDF generation
- English cover page with required tender information and included-document list
- Documents copied in requirement order, preserving all source pages
- Footer on every package page: `T-2026-0417 | Page X of Y`
- Download name: `<tender_id>_Package.pdf`
- Bangla / English language switch

## Bonus features
None added in this final core build.

## Known problems
- Damaged or password-protected PDFs are rejected with an error.
- The generated cover is English, as required by the problem statement.
- Replace the placeholder name, registration number, and live link before submission.

## AI tools used
AI coding assistant.

## Most useful prompt
The contest master prompt plus the AI DevFest Tender Document Package Builder problem statement.

## Frontend-only constraint
PDF processing happens in the browser. No participant-controlled backend, database, or online document storage is used.
