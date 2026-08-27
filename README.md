# VeritasCheck

VeritasCheck is a free academic demo for comparing a document with user-supplied reference content. It reports a transparent word-frequency cosine-similarity score and sentence-level matching evidence. It does **not** search the internet or make a definitive plagiarism judgment.

## Features

- Paste text or upload TXT, PDF, DOCX, PNG, JPG, JPEG, or WEBP documents (maximum 10 MB)
- Live word and character counts
- Multiple TXT/PDF reference files plus pasted reference-content comparison
- Matched source filename, page/line location, and per-source similarity
- Overall cosine similarity and up to 20 sentence matches
- Responsive, accessible Bootstrap interface
- Printable analysis report and friendly validation errors
- Account registration and secure password hashing
- Private SQLite-backed analysis history with saved report reopening

## Stack and structure

Python 3, Flask, Werkzeug, SQLite, pypdf, python-docx, OpenRouter vision OCR, HTML5, Bootstrap 5, custom CSS, and vanilla JavaScript.

```text
app.py                 Flask routes, extraction, and similarity engine
requirements.txt       Python dependencies
templates/             Base, home, checker, and about templates
static/css/style.css   Responsive visual system
static/js/app.js       Input, upload, API, and result behavior
uploads/               Reserved for future storage (uploads are processed in memory)
```

## Installation

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/macOS
source venv/bin/activate

pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:5000`.

### Vercel runtime storage

On Vercel, VeritasCheck automatically places SQLite and uploaded PDFs under writable `/tmp`; the deployed `/var/task` bundle is read-only. `/tmp` is ephemeral and may disappear between function instances or deployments, so production accounts, history, and documents require an external persistent database/object store. Configure `VERITASCHECK_SECRET` in the Vercel project environment and never commit `.env`.

## API

`POST /api/analyze` accepts `multipart/form-data` fields:

- `text`: document text (a file is used when this is empty)
- `reference`: optional comparison text
- `file`: optional `.txt` or `.pdf`
- `reference_files`: zero or more comparison `.txt`/`.pdf` files

At least 20 document words are required. A successful response includes word/character counts, overall similarity, status, and matching passages. Validation failures return `{ "ok": false, "error": "..." }` with a 4xx status.

## Similarity algorithm

Text is lowercased and tokenized into words. `Counter` frequency vectors are compared with cosine similarity (dot product divided by vector magnitudes). Document sentences are compared with reference sentences; best pairs scoring at least 55% are returned in descending order. Stop-word weighting and semantics are intentionally not implied by this baseline.

The isolated `calculate_similarity()` and `find_matches()` functions are the integration points for a future Sentence Transformer or other embedding model. Possible improvements include multilingual embeddings, a consented document corpus, database-backed history, and semantic passage retrieval.

## Fine-tuned semantic model

Install the optional training stack and train the bundled demonstration sentence-pair dataset:

```powershell
python -m pip install -r requirements-train.txt
python train_model.py --dataset "data\training_dataset.json"
```

Training writes `veritas_trained_model/`. Flask detects and loads that directory automatically at startup, then uses batched Sentence-Transformer embeddings for overall and sentence-level similarity. If it is absent, the application uses the transparent word-frequency cosine baseline. The 10 bundled pairs validate the pipeline only; they are not sufficient evidence of production accuracy.

## Academic disclaimer

Similarity is an automated indicator, not proof of plagiarism. Results depend solely on supplied reference content. Review passages, citations, context, and institutional policy before making academic decisions.
