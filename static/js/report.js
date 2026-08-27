(async () => {
  const node = document.querySelector('#reportData'); if (!node) return;
  const report = JSON.parse(node.textContent), pages = report.document_pages || [], matches = report.matches || [];
  const viewer = document.querySelector('.evidence-viewer'), pdfUrl = viewer.dataset.pdfUrl;
  let activePage = 1, activeSource = null, pdfDocument = null, zoomFactor = 1;
  const make = (tag, cls, text) => { const el=document.createElement(tag); if(cls)el.className=cls; if(text!==undefined)el.textContent=text; return el; };
  const filtered = page => matches.filter(match => match.document_page===page && (!activeSource || match.source_name===activeSource));
  const normalize = value => value.toLowerCase().replace(/\s+/g,' ').trim();

  async function loadPdf() {
    if (!pdfUrl) return;
    try {
      const pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
      pdfDocument = await pdfjs.getDocument(pdfUrl).promise;
    } catch (error) { console.warn('Original PDF renderer unavailable; using extracted-text fallback.', error); }
  }

  function highlightTextLayer(layer, pageNumber) {
    const targets=filtered(pageNumber).map(match=>({text:normalize(match.text),score:match.score,source:match.source_name}));
    const spans=[...layer.querySelectorAll('span')];
    spans.forEach(span=>{const value=normalize(span.textContent);const hit=targets.find(target=>value.length>3&&(target.text.includes(value)||value.includes(target.text.slice(0,Math.min(45,target.text.length)))));if(hit){span.classList.add('pdf-match-highlight');span.title=`${hit.score}% match · ${hit.source}`;span.dataset.score=`${hit.score}%`;span.onclick=()=>selectSource(hit.source)}});
  }

  async function renderOriginalPdfPage() {
    if (!pdfDocument) return false;
    const page=await pdfDocument.getPage(activePage), baseViewport=page.getViewport({scale:1});
    const stage=document.querySelector('.paper-stage');
    const availableWidth=Math.max(320,stage.clientWidth-40);
    const availableHeight=Math.max(320,stage.clientHeight-105);
    const fitScale=Math.min(1.6,availableWidth/baseViewport.width,availableHeight/baseViewport.height);
    const scale=fitScale*zoomFactor;
    const viewport=page.getViewport({scale});
    const canvas=document.querySelector('#pdfCanvas'), wrap=document.querySelector('#pdfCanvasWrap'), layer=document.querySelector('#pdfTextLayer'), context=canvas.getContext('2d');
    canvas.width=viewport.width;canvas.height=viewport.height;canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;wrap.style.width=`${viewport.width}px`;wrap.style.height=`${viewport.height}px`;layer.replaceChildren();layer.style.width=`${viewport.width}px`;layer.style.height=`${viewport.height}px`;
    await page.render({canvasContext:context,viewport}).promise;
    const textContent=await page.getTextContent();
    textContent.items.forEach(item=>{const tx=pdfDocument ? item.transform : null;if(!tx)return;const span=make('span','',item.str);const fontHeight=Math.hypot(tx[2],tx[3])*scale;span.style.left=`${tx[4]*scale}px`;span.style.top=`${viewport.height-tx[5]*scale-fontHeight}px`;span.style.fontSize=`${fontHeight}px`;span.style.transform=`scaleX(${item.width*scale/Math.max(span.textContent.length*fontHeight*.5,1)})`;span.style.transformOrigin='left top';layer.appendChild(span)});
    highlightTextLayer(layer,activePage);document.querySelector('#evidencePageText').classList.add('d-none');wrap.classList.remove('d-none');return true;
  }

  function renderFallback(){const page=pages.find(item=>item.number===activePage)||{text:''},box=document.querySelector('#evidencePageText');box.replaceChildren();document.querySelector('#pdfCanvasWrap').classList.add('d-none');box.classList.remove('d-none');const hits=filtered(activePage).map(match=>({start:page.text.indexOf(match.text),end:page.text.indexOf(match.text)+match.text.length,match})).filter(hit=>hit.start>=0).sort((a,b)=>a.start-b.start);let cursor=0;hits.forEach(hit=>{if(hit.start<cursor)return;box.appendChild(document.createTextNode(page.text.slice(cursor,hit.start)));const mark=make('mark','evidence-highlight',page.text.slice(hit.start,hit.end));mark.dataset.score=`${hit.match.score}%`;mark.onclick=()=>selectSource(hit.match.source_name);box.appendChild(mark);cursor=hit.end});box.appendChild(document.createTextNode(page.text.slice(cursor)))}
  async function renderPage(){if(!(await renderOriginalPdfPage()))renderFallback();document.querySelector('#activePageLabel').textContent=`Page ${activePage} of ${pdfDocument?.numPages||pages.length}`;document.querySelector('#paperNumber').textContent=activePage;document.querySelector('#previousPage').disabled=activePage<=1;document.querySelector('#nextPage').disabled=activePage>=(pdfDocument?.numPages||pages.length);document.querySelectorAll('.page-thumb').forEach(el=>el.classList.toggle('active',+el.dataset.page===activePage))}
  function renderThumbnails(){const rail=document.querySelector('#pageThumbnails');rail.replaceChildren();pages.forEach(page=>{const btn=make('button','page-thumb');btn.dataset.page=page.number;const sheet=make('span','mini-sheet');sheet.append(make('i','bi bi-file-earmark-pdf'),make('small','',`${filtered(page.number).length} matches`));btn.append(sheet,make('b','',page.number));btn.onclick=()=>{activePage=page.number;renderPage()};rail.appendChild(btn)})}
  function renderReferencePane(name){const pane=document.querySelector('#sourceReferencePane'),workspace=document.querySelector('#comparisonWorkspace'),list=document.querySelector('#referenceEvidenceList'),source=(report.sources||[]).find(item=>item.name===name);list.replaceChildren();if(!name||!source){pane.classList.add('d-none');workspace.classList.remove('comparing');return}document.querySelector('#referenceSourceTitle').textContent=source.name;const link=document.querySelector('#referenceSourceLink');link.href=source.url||'#';link.classList.toggle('d-none',!source.url);matches.filter(match=>match.source_name===name).forEach((match,index)=>{const card=make('article','reference-evidence-card');card.append(make('strong','',`Match ${index+1} · ${match.score}%`),make('small','',`Your PDF: page ${match.document_page}, line ${match.document_line}`),make('p','',match.source));card.onclick=()=>{activePage=match.document_page;renderPage();document.querySelector('.paper-stage').scrollTop=0};list.appendChild(card)});pane.classList.remove('d-none');workspace.classList.add('comparing')}
  function selectSource(name){activeSource=activeSource===name?null:name;document.querySelectorAll('.viewer-source').forEach(el=>el.classList.toggle('active',el.dataset.source===activeSource));const first=matches.find(match=>!activeSource||match.source_name===activeSource);if(first){activePage=first.document_page;document.querySelector('.paper-stage').scrollTop=0}renderReferencePane(activeSource);renderThumbnails();renderPage()}
  function renderSources(){const list=document.querySelector('#viewerSources');list.replaceChildren();if(!(report.sources||[]).length){list.appendChild(make('div','viewer-no-source','No verified web sources were found.'));return}report.sources.forEach((source,index)=>{const row=make('div','viewer-source');row.dataset.source=source.name;const info=make('span','source-info');info.append(make('strong','',source.name),make('small','',`${source.domain||''} · ${source.matches} highlighted passages`));row.append(make('span','source-index',String(index+1)),info,make('b','',`${source.similarity}%`));const link=make('a','bi bi-box-arrow-up-right');link.href=source.url||'#';link.target='_blank';link.rel='noopener noreferrer';link.title='Open website and show its highlighted PDF page';link.onclick=event=>{event.stopPropagation();if(activeSource!==source.name)selectSource(source.name)};row.appendChild(link);row.onclick=()=>selectSource(source.name);list.appendChild(row)})}
  document.querySelector('#previousPage').onclick=()=>{if(activePage>1){activePage--;renderPage()}};document.querySelector('#nextPage').onclick=()=>{if(activePage<(pdfDocument?.numPages||pages.length)){activePage++;renderPage()}};document.querySelector('#zoomIn').onclick=()=>{zoomFactor=Math.min(2.2,zoomFactor+.15);renderPage()};document.querySelector('#zoomOut').onclick=()=>{zoomFactor=Math.max(.55,zoomFactor-.15);renderPage()};
  document.querySelector('#closeReferencePane').onclick=()=>{activeSource=null;document.querySelectorAll('.viewer-source').forEach(el=>el.classList.remove('active'));renderReferencePane(null);renderThumbnails();renderPage()};
  let resizeTimer; window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(renderPage,180)});
  await loadPdf();renderSources();renderThumbnails();await renderPage();
})();
