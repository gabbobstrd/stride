/* Compagno - Messaggi rapidi al partner (WhatsApp) */
(function () {
  'use strict';
  const esc = UI.esc;

  function msgs() {
    const p = Store.s.partner;
    return Array.isArray(p.msgs) && p.msgs.length ? p.msgs : D.DEFAULT_MSGS.slice();
  }
  function editableMsgs() {
    const p = Store.s.partner;
    if (!Array.isArray(p.msgs)) p.msgs = D.DEFAULT_MSGS.slice();
    return p.msgs;
  }
  function cleanPhone(s) {
    let d = String(s || '').replace(/[^\d]/g, '');
    if (d.indexOf('00') === 0) d = d.slice(2);
    return d;
  }
  function validPhone(d) { return /^\d{8,15}$/.test(d); }

  /* dati attuali per i segnaposto */
  function context(ctx) {
    ctx = ctx || {};
    const S = Store.s;
    const a = S.activeSession;
    let exId = ctx.ex, setIdx = ctx.set, st = null, repsFallback = '';
    if (a) {
      let e = exId ? a.ex.find(x => x.e === exId) : null;
      if (!e) e = a.ex.find(x => x.sets.some(s => !s.done)) || a.ex[a.ex.length - 1];
      if (e) {
        exId = e.e;
        if (setIdx == null) { const i = e.sets.findIndex(s => !s.done); setIdx = i >= 0 ? i : e.sets.length - 1; }
        st = e.sets[setIdx] || null;
        const dn = e.sets.filter(x => x.done && x.r > 0);
        if (dn.length) repsFallback = String(dn[dn.length - 1].r);
        else if (e.plan && e.plan.rmin) repsFallback = e.plan.rmin + (e.plan.rmax && e.plan.rmax !== e.plan.rmin ? '–' + e.plan.rmax : '');
      }
    } else if (ctx.name) { exId = ctx.exId; }
    const today = Store.today();
    const tg = Calc.targets(today), dt = Calc.dayTotals(today);
    const day = Store.getDay(today);
    const v = {
      esercizio: ctx.exName || (exId ? Calc.exName(exId) : '—'),
      serie: setIdx != null ? String(setIdx + 1) : '—',
      kg: ctx.kg != null ? UI.fmtA(ctx.kg, 1) : (st && st.w !== '' && st.w != null ? UI.fmtA(UI.parseNum(st.w), 1) : '—'),
      reps: ctx.reps != null ? String(ctx.reps) : (st && st.r !== '' && st.r != null ? String(st.r) : (repsFallback || '—')),
      rpe: st && st.rpe !== '' && st.rpe != null ? String(st.rpe) : '—',
      kcal_rimaste: tg ? UI.fmt(Math.max(0, tg.kcal - dt.tot.kcal)) : '—',
      proteine_mancanti: tg ? UI.fmt(Math.max(0, tg.prot - dt.tot.prot)) : '—',
      acqua: UI.fmt((day.water || 0) / 1000, 1) + ' L',
      nome: (S.profile && S.profile.name) || ''
    };
    return v;
  }
  function fill(text, ctx) {
    const v = context(ctx);
    return String(text).replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m)).replace(/[ \t]+([,.!?;:])/g, '$1').replace(/[ \t]{2,}/g, ' ').trim();
  }

  function openLink(url) {
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function waUrl(text) {
    const ph = cleanPhone(Store.s.partner.phone);
    return 'https://wa.me/' + (validPhone(ph) ? ph : '') + '?text=' + encodeURIComponent(text);
  }

  /* foglio di anteprima con testo modificabile */
  function send(text) {
    const hasPhone = validPhone(cleanPhone(Store.s.partner.phone));
    const name = Store.s.partner.name;
    const sh = UI.sheet({
      title: 'Anteprima messaggio',
      html: '<textarea class="inp" id="pt-text" rows="4">' + esc(text) + '</textarea>' +
        '<p class="hint mb8">' + (hasPhone ? 'Verrà aperto WhatsApp con la chat di ' + esc(name || 'tuo partner') + '.' : 'Nessun numero impostato: in WhatsApp sceglierai tu il contatto (Altro → Partner).') + '</p>' +
        '<button class="btn wa block" id="pt-send">Invia su WhatsApp</button>' +
        '<div class="row gap mt8"><button class="btn grow" id="pt-share">Condividi</button><button class="btn grow" id="pt-copy">Copia</button></div>'
    });
    const val = () => sh.body.querySelector('#pt-text').value.trim();
    sh.body.querySelector('#pt-send').addEventListener('click', () => {
      const t = val(); if (!t) return UI.toast('Scrivi un messaggio');
      openLink(waUrl(t)); sh.close();
    });
    sh.body.querySelector('#pt-share').addEventListener('click', async () => {
      const t = val(); if (!t) return UI.toast('Scrivi un messaggio');
      if (navigator.share) { try { await navigator.share({ text: t }); sh.close(); } catch (e) { /* annullato */ } }
      else { const ok = await UI.copyText(t); UI.toast(ok ? 'Condivisione non disponibile: testo copiato' : 'Condivisione non disponibile'); }
    });
    sh.body.querySelector('#pt-copy').addEventListener('click', async () => { const ok = await UI.copyText(val()); UI.toast(ok ? 'Copiato' : 'Non riesco a copiare'); });
  }

  let lastCtx = null;
  function open(ctx) {
    lastCtx = ctx || null;
    const list = msgs();
    const sh = UI.sheet({
      title: 'Messaggi rapidi',
      html: '<div class="list">' + list.map((m, i) => '<button class="li" data-act="partner.pick" data-i="' + i + '"><div class="li-main"><div class="li-t wrapt">' + esc(fill(m, lastCtx)) + '</div></div>' + UI.icon('right', 18) + '</button>').join('') + '</div>' +
        '<button class="btn block mt12" data-act="partner.write">Scrivi un messaggio libero</button>' +
        (Store.s.partner.phone ? '' : '<p class="hint">Imposta nome e numero in Altro → Partner per aprire direttamente la chat.</p>')
    });
    sh.el.dataset.partner = '1';
  }
  UI.on('partner.open', () => open(null));
  UI.on('partner.pick', el => { const m = msgs()[+el.dataset.i]; if (m != null) send(fill(m, lastCtx)); });
  UI.on('partner.write', () => send(''));

  function sessionSummary(sess, prs) {
    const dur = sess.end && sess.start ? UI.durStr(sess.end - sess.start) : '';
    const vol = Calc.sessionVolume(sess);
    let t = '💪 Allenamento fatto! ' + UI.dateLabel(sess.date) + (sess.name ? ' – ' + sess.name : '') + '\n';
    t += (dur ? 'Durata ' + dur + ' · ' : '') + 'Volume ' + UI.fmt(vol) + ' kg';
    if (prs && prs.length) t += '\n🏆 Record: ' + prs.map(r => r.n + ' ' + UI.fmtA(r.w, 1) + ' kg × ' + r.r).join('; ');
    return t;
  }

  /* ---------- impostazioni (pagina in Altro) ---------- */
  function settingsHtml() {
    const p = Store.s.partner;
    const list = editableMsgs();
    return '<div class="card">' +
      UI.field('Nome del partner', UI.inp({ id: 'pt-name', value: p.name, ph: 'es. Alex' })) +
      UI.field('Numero WhatsApp', UI.inp({ id: 'pt-phone', value: p.phone, ph: '393331234567', attrs: 'inputmode="numeric"' }), 'Formato internazionale, solo cifre (es. 393331234567: 39 è l\'Italia). Senza numero, WhatsApp ti chiede il contatto.') +
      '<button class="btn primary block" data-act="partner.savePhone">Salva</button></div>' +
      '<div class="sec-t">Messaggi</div><div class="card">' +
      '<p class="small mut mb8">Segnaposto: {esercizio} {serie} {kg} {reps} {rpe} {kcal_rimaste} {proteine_mancanti} {acqua} {nome}</p>' +
      list.map((m, i) => '<div class="msgrow mb8"><input class="inp" value="' + esc(m) + '" data-ch="partner.msgEdit" data-i="' + i + '" aria-label="Messaggio ' + (i + 1) + '">' +
        '<button class="icon-btn sm" data-act="partner.up" data-i="' + i + '" aria-label="Su"' + (i === 0 ? ' disabled' : '') + '>' + UI.icon('up', 18) + '</button>' +
        '<button class="icon-btn sm" data-act="partner.down" data-i="' + i + '" aria-label="Giù"' + (i === list.length - 1 ? ' disabled' : '') + '>' + UI.icon('down', 18) + '</button>' +
        '<button class="icon-btn sm" data-act="partner.del" data-i="' + i + '" aria-label="Elimina">' + UI.icon('trash', 18) + '</button></div>').join('') +
      '<div class="row gap mt8"><button class="btn grow" data-act="partner.add">+ Aggiungi</button><button class="btn ghost" data-act="partner.reset">Ripristina</button></div></div>';
  }
  UI.on('partner.savePhone', () => {
    const name = document.getElementById('pt-name').value.trim();
    const raw = document.getElementById('pt-phone').value;
    const ph = cleanPhone(raw);
    if (raw.trim() && !validPhone(ph)) return UI.toast('Numero non valido: servono 8–15 cifre, con prefisso (es. 39…)');
    Store.s.partner.name = name; Store.s.partner.phone = ph;
    Store.change(); UI.toast('Partner salvato'); UI.refresh();
  });
  UI.onChange('partner.msgEdit', el => { const l = editableMsgs(); l[+el.dataset.i] = el.value; Store.change(); });
  UI.on('partner.up', el => { const l = editableMsgs(), i = +el.dataset.i; if (i > 0) { [l[i - 1], l[i]] = [l[i], l[i - 1]]; Store.change(); UI.refresh(); } });
  UI.on('partner.down', el => { const l = editableMsgs(), i = +el.dataset.i; if (i < l.length - 1) { [l[i + 1], l[i]] = [l[i], l[i + 1]]; Store.change(); UI.refresh(); } });
  UI.on('partner.del', el => { const l = editableMsgs(); l.splice(+el.dataset.i, 1); Store.change(); UI.refresh(); });
  UI.on('partner.add', () => { editableMsgs().push('Nuovo messaggio'); Store.change(); UI.refresh(); });
  UI.on('partner.reset', async () => {
    if (await UI.confirm({ title: 'Ripristinare i messaggi?', msg: 'Torni all\'elenco predefinito: i tuoi messaggi vengono persi.', ok: 'Ripristina', danger: true })) { Store.s.partner.msgs = null; Store.change(); UI.refresh(); }
  });

  window.Partner = { open, send, fill, sessionSummary, settingsHtml, cleanPhone, validPhone };
})();
