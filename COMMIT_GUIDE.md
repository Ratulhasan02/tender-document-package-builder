# Commit Guide

Use the exact AI prompt you actually used in the contest.

## Commit 1
```bash
git add .
git commit -m "Build initial bilingual tender builder UI - Prompt: Create the project skeleton with a bilingual Bangla/English switch, tender details, requirements list, responsive UI, and PDF upload interface."
git push origin main
```

## Commit 2
```bash
git add .
git commit -m "Add document matching and validation - Prompt: Implement PDF upload and page counting, one-to-one document matching, expiry validation, duplicate detection, and Missing/Expiry date needed/Expired/Not provided/OK statuses."
git push origin main
```

## Commit 3 / Final
```bash
git add .
git commit -m "Generate final tender PDF package - Prompt: Generate the final tender package with an English cover page, documents sorted by requirement order, all source pages preserved, and tender ID page X of Y footers on every page."
git push origin main
```
