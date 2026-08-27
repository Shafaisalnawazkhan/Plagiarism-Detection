(() => {
  const form = document.querySelector('#analysisForm');
  if (!form) return;
  const text = document.querySelector('#documentText');
  const file = document.querySelector('#documentFile');
  const zone = document.querySelector('#uploadZone');
  const error = document.querySelector('#errorMessage');
  const results = document.querySelector('#results');
  const button = document.querySelector('#analyzeButton');
  const count = () => {
    const value = text.value.trim();
    document.querySelector('#wordCount').textContent = value ? value.split(/\s+/).length : 0;
    document.querySelector('#charCount').textContent = text.value.length;
  };
  text.addEventListener('input', count);
  let previewUrl;
  const showFile = () => {
    const selected = file.files[0];
    document.querySelector('#fileName').textContent = selected?.name || 'TXT or PDF · Maximum 10 MB';
    const preview = document.querySelector('#filePreview');
    const pdfPreview = document.querySelector('#pdfPreview');
    const textPreview = document.querySelector('#textPreview');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    pdfPreview.classList.add('d-none'); textPreview.classList.add('d-none');
    if (!selected) { preview.classList.add('d-none'); return; }
    preview.classList.remove('d-none');
    document.querySelector('#previewType').textContent = selected.type === 'application/pdf' ? 'PDF · use controls to change pages' : 'Text preview';
    if (selected.type === 'application/pdf' || selected.name.toLowerCase().endsWith('.pdf')) {
      previewUrl = URL.createObjectURL(selected); pdfPreview.src = `${previewUrl}#toolbar=1&navpanes=1&view=FitH`; pdfPreview.classList.remove('d-none');
    } else {
      const reader = new FileReader(); reader.onload = () => { textPreview.textContent = reader.result; textPreview.classList.remove('d-none'); }; reader.readAsText(selected);
    }
  };
  file.addEventListener('change', showFile);
  const referenceFiles = document.querySelector('#referenceFiles');
  referenceFiles?.addEventListener('change', () => {
    const names = Array.from(referenceFiles.files).map(item => item.name);
    document.querySelector('#referenceFileName').textContent = names.length ? `${names.length} selected: ${names.join(', ')}` : 'Multiple TXT/PDF files supported';
  });
  ['dragenter', 'dragover'].forEach(name => zone.addEventListener(name, event => { event.preventDefault(); zone.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach(name => zone.addEventListener(name, event => { event.preventDefault(); zone.classList.remove('dragging'); }));
  zone.addEventListener('drop', event => { if (event.dataTransfer.files.length) { file.files = event.dataTransfer.files; showFile(); } });

  const addText = (parent, tag, className, value) => { const node = document.createElement(tag); node.className = className; node.textContent = value; parent.appendChild(node); return node; };
  const renderMatches = matches => {
    const list = document.querySelector('#matchesList'); list.replaceChildren();
    if (!matches.length) { const empty = document.createElement('div'); empty.className = 'empty-state'; addText(empty, 'i', 'bi bi-check-circle', ''); addText(empty, 'strong', '', 'No strong sentence-level matches were found.'); list.appendChild(empty); return; }
    matches.forEach((match, index) => { const card = document.createElement('article'); card.className = 'match-card'; const top = document.createElement('div'); top.className = 'match-top'; addText(top, 'strong', '', `Matched passage ${index + 1}`); addText(top, 'span', '', `${match.score}% match`); card.appendChild(top); addText(card, 'small', 'location-label', `Your document · line ${match.document_line}`); addText(card, 'p', 'document-passage', match.text); addText(card, 'small', 'source-location', `${match.source_name}${match.source_page ? ` · page ${match.source_page}` : ''} · line ${match.source_line}`); addText(card, 'blockquote', '', match.source); list.appendChild(card); });
  };
  const renderSources = sources => {
    const list = document.querySelector('#sourcesList'); list.replaceChildren();
    if (!sources.length) { addText(list, 'div', 'empty-state', 'No reference source supplied. Add reference files or paste source content to locate matches.'); return; }
    sources.forEach((source, index) => { const row = document.createElement(source.url ? 'a' : 'div'); row.className = 'source-row'; if (source.url) { row.href = source.url; row.target = '_blank'; row.rel = 'noopener noreferrer'; } addText(row, 'span', 'source-rank', String(index + 1)); const info = document.createElement('div'); addText(info, 'strong', '', source.name); addText(info, 'small', '', `${source.domain || ''} · ${source.matches} matched passage${source.matches === 1 ? '' : 's'}`); row.appendChild(info); addText(row, 'b', '', `${source.similarity}%`); list.appendChild(row); });
  };
  let evidencePages = [], evidenceMatches = [], evidencePage = 1;
  const renderActiveEvidencePage = () => {
    const container = document.querySelector('#documentPages'); container.replaceChildren();
    const page = evidencePages.find(item => item.number === evidencePage);
    if (!page) return;
    const article = document.createElement('article'); article.className = 'document-page';
    const heading = document.createElement('div'); heading.className = 'page-heading'; addText(heading, 'strong', '', `Page ${page.number}`); const pageMatches = evidenceMatches.filter(match => match.document_page === page.number); addText(heading, 'span', '', `${pageMatches.length} highlighted match${pageMatches.length === 1 ? '' : 'es'}`); article.appendChild(heading);
    const content = document.createElement('div'); content.className = 'page-text';
    const hits = pageMatches.map(match => ({ start: page.text.indexOf(match.text), end: page.text.indexOf(match.text) + match.text.length, score: match.score, source: match.source_name })).filter(hit => hit.start >= 0).sort((a, b) => a.start - b.start); let cursor = 0;
    hits.forEach(hit => { if (hit.start < cursor) return; content.appendChild(document.createTextNode(page.text.slice(cursor, hit.start))); const mark = document.createElement('mark'); mark.textContent = page.text.slice(hit.start, hit.end); mark.title = `${hit.score}% match · ${hit.source}`; mark.dataset.score = `${hit.score}%`; content.appendChild(mark); cursor = hit.end; });
    content.appendChild(document.createTextNode(page.text.slice(cursor))); article.appendChild(content); container.appendChild(article);
    document.querySelector('#pageTotal').textContent = `Page ${evidencePage} of ${evidencePages.length}`;
    document.querySelector('#evidencePrevious').disabled = evidencePage <= 1; document.querySelector('#evidenceNext').disabled = evidencePage >= evidencePages.length;
    document.querySelectorAll('.checker-page-button').forEach(button => button.classList.toggle('active', Number(button.dataset.page) === evidencePage));
  };
  const renderDocumentPages = (pages, matches) => {
    evidencePages = pages; evidenceMatches = matches; evidencePage = 1;
    const rail = document.querySelector('#checkerPageRail'); rail.replaceChildren();
    pages.forEach(page => { const button = document.createElement('button'); button.type = 'button'; button.className = 'checker-page-button'; button.dataset.page = page.number; addText(button, 'i', 'bi bi-file-text', ''); addText(button, 'span', '', `Page ${page.number}`); addText(button, 'small', '', `${matches.filter(match => match.document_page === page.number).length} matches`); button.addEventListener('click', () => { evidencePage = page.number; renderActiveEvidencePage(); }); rail.appendChild(button); });
    renderActiveEvidencePage();
  };
  document.querySelector('#evidencePrevious').addEventListener('click', () => { if (evidencePage > 1) { evidencePage--; renderActiveEvidencePage(); } });
  document.querySelector('#evidenceNext').addEventListener('click', () => { if (evidencePage < evidencePages.length) { evidencePage++; renderActiveEvidencePage(); } });
  form.addEventListener('submit', async event => {
    event.preventDefault(); error.classList.add('d-none'); results.classList.add('d-none');
    button.disabled = true; button.querySelector('span').textContent = 'Analyzing…'; button.querySelector('i').className = 'spinner-border spinner-border-sm';
    try {
      const response = await fetch('/api/analyze', { method: 'POST', body: new FormData(form) });
      const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || 'Analysis could not be completed.');
      document.querySelector('#similarityValue').textContent = `${data.similarity}%`; const label = document.querySelector('#similarityLabel'); label.textContent = data.comparison_provided ? data.label : 'No reference supplied'; label.className = `tone-${data.tone}`;
      if (data.saved && data.report_id) {
        button.querySelector('span').textContent = 'Opening evidence viewer…';
        window.location.assign(`/reports/${data.report_id}`);
        return;
      }
      document.querySelector('#aiSignalValue').textContent = data.ai_detection?.available ? `${data.ai_detection.score}%` : '—'; document.querySelector('#grammarValue').textContent = data.grammar?.available ? `${data.grammar.score}%` : '—'; document.querySelector('#resultWords').textContent = data.words.toLocaleString(); document.querySelector('#matchCount').textContent = data.matches.length; document.querySelector('#resultNote').textContent = `${data.note} AI-writing signals are experimental and are not proof of authorship. Sign in before analysis to save and open the full evidence viewer.`; renderDocumentPages(data.document_pages || [], data.matches); renderSources(data.sources || []); renderMatches(data.matches); results.classList.remove('d-none'); results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (problem) { error.textContent = problem.message; error.classList.remove('d-none'); error.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    finally { button.disabled = false; button.querySelector('span').textContent = 'Search & Analyze'; button.querySelector('i').className = 'bi bi-globe-americas'; }
  });
  document.querySelector('#printReport').addEventListener('click', () => window.print());
})();
