/* Maxence Peptides — fil « Côté recherche » par peptide (études PubMed réelles, cadre en français).
   Renders a curated list of REAL published studies (sourced from PubMed) for the
   peptide on this product page. Click a study to open a full, beautifully
   formatted summary (structured abstract) in a modal; close to return to the
   feed; or open the full study on PubMed.

   Data: /studies.json (keyed by product slug). Each study =
   {title, journalFull, journal, year, authors, segments:[{label,text}], url, pmid}
   pulled from PubMed — no fabricated findings.

   Research framing only: published scientific literature. NOT medical advice and
   NOT a claim that these products are for human use. */
(function () {
  var mount = document.getElementById('mxp-research');
  if (!mount) return;
  var slug = mount.getAttribute('data-slug') ||
    (location.pathname.replace(/\/$/, '').split('/').pop() || '').replace(/\.html$/, '');
  var name = mount.getAttribute('data-name') ||
    (document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : 'ce peptide');
  if (!slug) return;

  if (!document.getElementById('rf-style')) {
    var st = document.createElement('style');
    st.id = 'rf-style';
    st.textContent =
      '.research-band{background:var(--bone,#ECE7DC);padding:clamp(44px,6vw,76px) clamp(20px,5vw,56px)}' +
      '.rf-wrap{max-width:760px;margin:0 auto}' +
      '.rf-head-block{text-align:center;margin-bottom:28px}' +
      '.rf-eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--oise-deep,#3B5661);font-weight:600;margin:0 0 10px}' +
      '.rf-title{font-family:var(--serif,"Cormorant Garamond",Georgia,serif);font-weight:500;font-size:clamp(23px,3.2vw,31px);line-height:1.15;color:var(--ink,#1F2A33);margin:0 0 12px}' +
      '.rf-note{font-size:13.5px;line-height:1.55;color:var(--ink-soft,#55606A);margin:0 auto;max-width:60ch}' +
      '.rf-list{display:flex;flex-direction:column;gap:12px;margin-top:6px}' +
      '.rf-item{display:block;width:100%;text-align:left;background:var(--paper,#FFFFFF);border:1px solid var(--line,#DCD6C9);border-radius:14px;padding:18px 20px;cursor:pointer;font:inherit;transition:border-color .2s,box-shadow .2s,transform .15s}' +
      '.rf-item:hover{border-color:var(--lys-deep,#8F6F27);box-shadow:0 20px 50px -34px rgba(40,58,72,.5);transform:translateY(-1px)}' +
      '.rf-itemtitle{font-family:var(--serif,"Cormorant Garamond",Georgia,serif);font-size:16.5px;font-weight:500;color:var(--ink,#1F2A33);line-height:1.3;margin:0 0 6px}' +
      '.rf-itemmeta{font-size:12px;color:var(--ink-soft,#55606A);margin-bottom:8px}' +
      '.rf-teaser{font-size:13.5px;line-height:1.5;color:var(--ink-soft,#55606A);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:0 0 8px}' +
      '.rf-more{font-size:12.5px;font-weight:600;color:var(--lys-deep,#8F6F27);letter-spacing:.02em}' +
      '.rf-disc{font-size:11.5px;color:var(--ink-soft,#7A858E);text-align:center;margin-top:22px;line-height:1.5}' +
      /* modal */
      '.rf-modal{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(20,28,36,.62);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .25s ease}' +
      '.rf-modal.in{opacity:1}' +
      '.rf-card{position:relative;width:100%;max-width:640px;max-height:86vh;overflow-y:auto;background:var(--paper,#FFFFFF);border:1px solid var(--line,#DCD6C9);border-radius:20px;padding:36px 34px 30px;box-shadow:0 50px 100px -30px rgba(0,0,0,.55);transform:translateY(12px) scale(.98);transition:transform .28s cubic-bezier(.2,.8,.2,1)}' +
      '.rf-modal.in .rf-card{transform:none}' +
      '.rf-close{position:absolute;top:16px;right:16px;width:34px;height:34px;border:none;border-radius:50%;background:var(--bone,#ECE7DC);color:var(--ink,#1F2A33);font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}' +
      '.rf-close:hover{background:#DCD6C9}' +
      '.rf-ceyebrow{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--oise-deep,#3B5661);font-weight:600;margin:0 0 10px}' +
      '.rf-ctitle{font-family:var(--serif,"Cormorant Garamond",Georgia,serif);font-weight:500;font-size:23px;line-height:1.22;color:var(--ink,#1F2A33);margin:0 0 10px;padding-right:30px}' +
      '.rf-cmeta{font-size:12.5px;color:var(--ink-soft,#55606A);margin:0 0 22px;padding-bottom:18px;border-bottom:1px solid var(--line,#DCD6C9)}' +
      '.rf-cmeta b{color:var(--ink,#1F2A33);font-weight:600}' +
      '.rf-seg{margin:0 0 16px}' +
      '.rf-seglabel{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--lys-deep,#8F6F27);font-weight:700;margin:0 0 5px}' +
      '.rf-segtext{font-size:14.5px;line-height:1.68;color:var(--ink,#2A3640);margin:0}' +
      '.rf-cfoot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:24px;padding-top:18px;border-top:1px solid var(--line,#DCD6C9)}' +
      '.rf-csrc{font-size:11.5px;color:var(--ink-soft,#7A858E)}' +
      '.rf-clink{display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:600;color:#F6F3EC;background:var(--ink,#1F2A33);padding:11px 18px;border-radius:100px;text-decoration:none}' +
      '.rf-clink:hover{background:#161E25}' +
      /* sidebar variant: feed sits in the left product column, beside the COA */
      '.pd-research .rf-wrap{max-width:none}' +
      '.pd-research .rf-head-block{text-align:left;margin-bottom:16px}' +
      '.pd-research .rf-eyebrow{margin-bottom:7px}' +
      '.pd-research .rf-title{font-size:19px;line-height:1.2}' +
      '.pd-research .rf-note{margin:0;font-size:12px;max-width:none}' +
      '.pd-research .rf-itemtitle{font-size:15.5px}' +
      '.pd-research .rf-disc{text-align:left;font-size:10.5px;margin-top:16px}' +
      '@media(min-width:861px){' +
        '.pd-grid.has-research .pd-media{position:static;grid-column:1;grid-row:1;align-self:start}' +
        '.pd-grid.has-research .pd-info{grid-column:2;grid-row:1 / span 2}' +
        '.pd-grid.has-research .pd-research{grid-column:1;grid-row:2;align-self:start;margin-top:30px}' +
      '}' +
      /* prominent date badge + original-title transparency line */
      '.rf-yearbadge{display:inline-block;background:var(--lys-deep,#8F6F27);color:#F6F3EC;font-size:11px;font-weight:700;letter-spacing:.05em;padding:3px 10px;border-radius:100px;margin-bottom:9px}' +
      '.rf-yearbadge.big{font-size:12.5px;padding:4px 12px;margin:0}' +
      '.rf-ctop{display:flex;align-items:center;gap:12px;margin-bottom:12px}' +
      '.rf-ctop .rf-ceyebrow{margin:0}' +
      '.rf-orig{font-size:11.5px;color:var(--ink-soft,#7A858E);font-style:italic;line-height:1.45;margin:20px 0 0;padding-top:14px;border-top:1px dashed var(--line,#DCD6C9)}' +
      /* key-fact highlights strip */
      '.rf-highlights{display:flex;flex-direction:column;gap:10px;margin:0 0 26px}' +
      '.rf-stat{display:block;width:100%;text-align:left;background:var(--paper,#FFFFFF);border:1px solid var(--line,#DCD6C9);border-left:3px solid var(--lys-deep,#8F6F27);border-radius:12px;padding:14px 16px;cursor:pointer;font:inherit;transition:box-shadow .2s,transform .15s}' +
      '.rf-stat:hover{box-shadow:0 16px 40px -30px rgba(40,58,72,.55);transform:translateY(-1px)}' +
      '.rf-stat.static,.rf-stat.static:hover{cursor:default;transform:none;box-shadow:none}' +
      '.rf-statnum{display:block;font-family:var(--serif,"Cormorant Garamond",Georgia,serif);font-size:23px;font-weight:600;color:var(--lys-deep,#8F6F27);line-height:1.1;margin-bottom:4px}' +
      '.rf-statctx{display:block;font-size:12.5px;line-height:1.4;color:var(--ink-soft,#55606A)}';
    document.head.appendChild(st);
  }

  function esc(s) { return (s || '').replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  Promise.all([
    fetch('studies.json?v=1').then(function (r) { return r.json(); }),
    fetch('highlights.json?v=1').then(function (r) { return r.json(); }).catch(function () { return {}; })
  ]).then(function (res) {
    var all = res[0] || {}, allHl = res[1] || {};
    var studies = (all && all[slug]) || [];
    if (!studies.length) { mount.remove(); return; }
    var highlights = (allHl && allHl[slug]) || [];
    var byPmid = {}; studies.forEach(function (s) { byPmid[String(s.pmid)] = s; });

    var hlHtml = highlights.length ? ('<div class="rf-highlights">' + highlights.map(function (h) {
      var live = h.pmid && byPmid[String(h.pmid)];
      return '<button type="button" class="rf-stat' + (live ? '' : ' static') + '"' + (live ? ' data-pmid="' + esc(String(h.pmid)) + '"' : '') + '>' +
        '<span class="rf-statnum">' + esc(h.stat) + '</span>' +
        '<span class="rf-statctx">' + esc(h.context) + '</span>' +
      '</button>';
    }).join('') + '</div>') : '';

    var cards = studies.map(function (s, i) {
      var dispTitle = s.title2 || s.title;
      var meta = [esc(s.authors), esc(s.journal)].filter(Boolean).join(' · ');
      var teaser = ((s.summary && s.summary[0] && s.summary[0].text) ||
                    (s.segments && s.segments[0] && s.segments[0].text) || '');
      return '<button type="button" class="rf-item" data-i="' + i + '">' +
        (s.year ? '<span class="rf-yearbadge">' + esc(s.year) + '</span>' : '') +
        '<span class="rf-itemtitle">' + esc(dispTitle) + '</span>' +
        (meta ? '<span class="rf-itemmeta">' + meta + '</span>' : '') +
        '<p class="rf-teaser">' + esc(teaser) + '</p>' +
        '<span class="rf-more">Lire le résumé →</span>' +
      '</button>';
    }).join('');

    var sec = document.createElement('section');
    sec.id = 'research';
    sec.innerHTML =
      '<div class="rf-wrap">' +
        '<div class="rf-head-block">' +
          '<p class="rf-eyebrow">Côté recherche</p>' +
          '<h2 class="rf-title">Ce que dit la recherche sur ' + esc(name) + '</h2>' +
          '<p class="rf-note">Une sélection d’études publiées et relues par les pairs, à titre de référence scientifique uniquement. Les résumés sont en anglais, langue de publication. Ni avis médical, ni allégation d’efficacité ou de sécurité chez l’humain.</p>' +
        '</div>' +
        hlHtml +
        '<div class="rf-list">' + cards + '</div>' +
        '<p class="rf-disc">Études issues de la National Library of Medicine (PubMed). Réservé à la recherche in vitro. Non destiné à la consommation humaine.</p>' +
      '</div>';

    // Desktop: drop the feed into the empty left product column, beside the COA.
    // Mobile (single-column grid): it naturally stacks below the product info.
    var grid = document.querySelector('.pd-grid');
    if (grid) {
      sec.className = 'pd-research';
      grid.classList.add('has-research');
      grid.appendChild(sec);
    } else {
      sec.className = 'band research-band';
      var faq = document.querySelector('.faq-section');
      var f = document.querySelector('footer');
      if (faq && faq.parentNode) faq.parentNode.insertBefore(sec, faq);
      else if (f && f.parentNode) f.parentNode.insertBefore(sec, f);
      else document.body.appendChild(sec);
    }
    mount.remove();

    function openModal(s) {
      var secs = (s.summary && s.summary.length) ? s.summary : (s.segments || []);
      var segHtml = secs.map(function (seg) {
        return '<div class="rf-seg">' +
          (seg.label ? '<span class="rf-seglabel">' + esc(seg.label) + '</span>' : '') +
          '<p class="rf-segtext">' + esc(seg.text) + '</p></div>';
      }).join('');
      var meta = [s.authors ? '<b>' + esc(s.authors) + '</b>' : '', esc(s.journalFull || s.journal)].filter(Boolean).join(' · ');
      var dispTitle = s.title2 || s.title;
      var origLine = (s.title2 && s.title && s.title2 !== s.title) ? '<p class="rf-orig">Titre original : ' + esc(s.title) + '</p>' : '';
      var ov = document.createElement('div');
      ov.className = 'rf-modal';
      ov.innerHTML =
        '<div class="rf-card" role="dialog" aria-modal="true">' +
          '<button type="button" class="rf-close" aria-label="Fermer">✕</button>' +
          '<div class="rf-ctop">' + (s.year ? '<span class="rf-yearbadge big">' + esc(s.year) + '</span>' : '') + '<span class="rf-ceyebrow">Étude publiée</span></div>' +
          '<h3 class="rf-ctitle">' + esc(dispTitle) + '</h3>' +
          (meta ? '<p class="rf-cmeta">' + meta + '</p>' : '') +
          segHtml +
          origLine +
          '<div class="rf-cfoot">' +
            '<span class="rf-csrc">PubMed' + (s.pmid ? ' · PMID ' + esc(s.pmid) : '') + '</span>' +
            '<a class="rf-clink" href="' + esc(s.url) + '" target="_blank" rel="noopener">Ouvrir l’étude sur PubMed →</a>' +
          '</div>' +
        '</div>';
      document.body.appendChild(ov);
      document.documentElement.style.overflow = 'hidden';
      requestAnimationFrame(function () { ov.classList.add('in'); });
      function close() {
        ov.classList.remove('in');
        document.documentElement.style.overflow = '';
        document.removeEventListener('keydown', onKey);
        setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 260);
      }
      function onKey(e) { if (e.key === 'Escape') close(); }
      ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
      ov.querySelector('.rf-close').addEventListener('click', close);
      document.addEventListener('keydown', onKey);
    }

    sec.querySelectorAll('.rf-item').forEach(function (btn) {
      btn.addEventListener('click', function () { openModal(studies[+btn.getAttribute('data-i')]); });
    });
    sec.querySelectorAll('.rf-stat[data-pmid]').forEach(function (b) {
      b.addEventListener('click', function () { var s = byPmid[b.getAttribute('data-pmid')]; if (s) openModal(s); });
    });
  }).catch(function () { if (mount) mount.remove(); });
})();
