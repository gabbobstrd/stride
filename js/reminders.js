/* Compagno - Notifiche: promemoria tramite Calendario dell'iPhone (file .ics) */
(function () {
  'use strict';
  const esc = UI.esc;
  const ALL = [0, 1, 2, 3, 4, 5, 6];
  let pendingFile = null;   // {file, url}
  let openCard = false;
  try { openCard = sessionStorage.getItem('compagno_notif_open') === '1'; } catch (e) { /* ignora */ }

  function trainDays() {
    const S = Store.s;
    const prog = S.programs.find(p => p.id === S.activeProgram);
    // i giorni vengono dalla scheda attiva; solo senza scheda si usa il valore del profilo
    const n = Math.max(1, Math.min(7, (prog && prog.days.length) || +(S.profile && S.profile.trainDays) || 3));
    const pat = { 1: [2], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5], 7: ALL };
    return pat[n];
  }
  function suppTime(w) {
    const s = Calc.norm(w || '');
    if (/colaz/.test(s)) return '08:30';
    if (/pranz/.test(s)) return '13:00';
    if (/cena|sera/.test(s)) return '21:30';
    if (/pre/.test(s)) return '17:30';
    if (/post/.test(s)) return '20:00';
    return '09:00';
  }

  /* elenco completo delle voci (salvate o predefinite) */
  function items() {
    const S = Store.s;
    const out = [];
    const find = k => S.reminders.find(r => r.key === k);
    const mk = (base, extra) => {
      const st = find(base.key);
      const days = st ? st.days : (base.days === 'train' ? trainDays() : base.days);
      const it = Object.assign({ id: st ? st.id : null, on: false, seq: 0, stored: !!st }, base, st || {}, extra || {});
      it.days = days;
      return it;
    };
    D.REMINDER_PRESETS.forEach(p => out.push(mk(p)));
    S.supps.forEach(s => {
      out.push(mk({
        key: 'supp:' + s.id, title: s.n, emoji: '💊', time: suppTime(s.when), days: ALL,
        note: s.n + (s.dose ? ' – ' + s.dose + (s.unit ? ' ' + D.unitLbl(s.dose, s.unit) : '') : ''), supp: s.id
      }));
    });
    S.reminders.filter(r => /^custom:/.test(r.key)).forEach(r => out.push(Object.assign({ custom: true, stored: true }, r)));
    return out;
  }
  function itemByKey(key) { return items().find(i => i.key === key); }
  function ensure(it) {
    const S = Store.s;
    let st = S.reminders.find(r => r.key === it.key);
    if (!st) {
      st = { id: Store.uid('r'), key: it.key, title: it.title, emoji: it.emoji, on: false, time: it.time || '', days: it.days.slice(), everyH: it.everyH || 0, from: it.from || '', to: it.to || '', seq: 0, note: it.note || '' };
      S.reminders.push(st);
    }
    return st;
  }
  function summary(it) {
    const d = it.days || [];
    const ds = d.length === 7 ? 'ogni giorno' : d.map(i => D.DAYS_IT[i].toLowerCase()).join(' ');
    if (it.everyH > 0) return 'ogni ' + it.everyH + ' h, ' + (it.from || '09:00') + '–' + (it.to || '21:00') + ' · ' + ds;
    return (it.time || '09:00') + ' · ' + ds;
  }

  /* ---------- .ics ---------- */
  function icsEsc(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function fold(line) {
    const enc = new TextEncoder();
    let out = '', cur = '', bytes = 0;
    for (const ch of line) {
      const b = enc.encode(ch).length;
      if (bytes + b > 73) { out += cur + '\r\n '; cur = ''; bytes = 0; }
      cur += ch; bytes += b;
    }
    return out + cur;
  }
  function p2(n) { return n < 10 ? '0' + n : '' + n; }
  function stamp(d) { return d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()) + 'T' + p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + p2(d.getUTCSeconds()) + 'Z'; }
  function slug(s) { return Calc.norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x'; }
  function slots(it) {
    if (it.everyH > 0) {
      const a = (it.from || '09:00').split(':'), b = (it.to || '21:00').split(':');
      let m = (+a[0]) * 60 + (+a[1] || 0);
      const end = (+b[0]) * 60 + (+b[1] || 0);
      const step = Math.max(1, +it.everyH) * 60;
      const arr = [];
      while (m <= end && arr.length < 24) { arr.push(p2(Math.floor(m / 60)) + ':' + p2(m % 60)); m += step; }
      return arr;
    }
    return [it.time || '09:00'];
  }
  function firstDate(days) {
    const d = new Date();
    for (let i = 0; i < 8; i++) {
      const idx = (d.getDay() + 6) % 7;
      if (days.indexOf(idx) >= 0) return Store.dkey(d);
      d.setDate(d.getDate() + 1);
    }
    return Store.today();
  }
  function eventLines(it, seq, now) {
    const days = (it.days && it.days.length ? it.days : ALL).slice().sort();
    const start = firstDate(days).replace(/-/g, '');
    const L = [];
    const title = (it.emoji ? it.emoji + ' ' : '') + it.title + ' — Stride';
    const slotList = slots(it), multi = slotList.length > 1;
    for (let si = 0; si < slotList.length; si++) {
      const hh = slotList[si].split(':');
      const h = +hh[0], m = +hh[1] || 0;
      const dts = start + 'T' + p2(h) + p2(m) + '00';
      // fine = inizio + 5 minuti con aritmetica reale sulle date (dopo le 23:55 passa al giorno dopo)
      const d0 = new Date(+start.slice(0, 4), +start.slice(4, 6) - 1, +start.slice(6, 8), h, m + 5, 0);
      const dte = d0.getFullYear() + p2(d0.getMonth() + 1) + p2(d0.getDate()) + 'T' + p2(d0.getHours()) + p2(d0.getMinutes()) + '00';
      L.push('BEGIN:VEVENT');
      // UID stabile (non dipende dall'orario): se l'ora cambia il Calendario aggiorna l'evento invece di duplicarlo
      L.push('UID:compagno-' + slug(it.key) + (multi ? '-' + si : '') + '@compagno');
      L.push('DTSTAMP:' + now);
      L.push('SEQUENCE:' + seq);
      L.push('DTSTART;TZID=Europe/Rome:' + dts);
      L.push('DTEND;TZID=Europe/Rome:' + dte);
      L.push(days.length === 7 ? 'RRULE:FREQ=DAILY' : 'RRULE:FREQ=WEEKLY;BYDAY=' + days.map(i => D.ICS_DAYS[i]).join(','));
      L.push('SUMMARY:' + icsEsc(title));
      L.push('DESCRIPTION:' + icsEsc((it.note || it.title) + ' (promemoria creato da Stride)'));
      L.push('BEGIN:VALARM');
      L.push('ACTION:DISPLAY');
      L.push('DESCRIPTION:' + icsEsc(title));
      L.push('TRIGGER:PT0M');
      L.push('END:VALARM');
      L.push('END:VEVENT');
    }
    return L;
  }
  function buildICS(list) {
    const now = stamp(new Date());
    const L = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Stride//Promemoria//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'X-WR-TIMEZONE:Europe/Rome',
      'BEGIN:VTIMEZONE', 'TZID:Europe/Rome', 'X-LIC-LOCATION:Europe/Rome',
      'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
      'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
      'END:VTIMEZONE'
    ];
    list.forEach(it => { eventLines(it, it.seq || 0, now).forEach(l => L.push(l)); });
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }

  /* ---------- fogli ---------- */
  function icsSheet(title, intro, list, fname) {
    const text = buildICS(list);
    const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const file = (typeof File === 'function') ? new File([blob], fname, { type: 'text/calendar' }) : null;
    pendingFile = { file, url, name: fname };
    // incrementa la SEQUENCE per la prossima volta
    list.forEach(it => { const st = ensure(it); st.seq = (+st.seq || 0) + 1; });
    Store.change();
    UI.sheet({
      title, onClose() { setTimeout(() => URL.revokeObjectURL(url), 60000); },
      html: '<p class="txt">' + intro + '</p>' +
        '<a class="btn primary block" href="' + url + '" download="' + esc(fname) + '">Aggiungi al Calendario</a>' +
        (file && navigator.canShare ? '<button class="btn block mt8" data-act="rem.share">Condividi il file</button>' : '') +
        '<div class="disc mt12"><b>Come si fa.</b> Tocca il file → <b>Aggiungi tutto</b>. Consiglio: crea prima in Calendario un calendario chiamato «Stride» e scegli quello, così li togli tutti in un colpo.<br>Per toglierli: Calendario → evento → Elimina evento → Tutti gli eventi futuri.</div>'
    });
  }
  UI.on('rem.share', async () => {
    if (!pendingFile || !pendingFile.file) return;
    const ok = await UI.shareFile(pendingFile.file, 'Promemoria Stride');
    if (!ok) UI.toast('Condivisione non disponibile: usa il pulsante verde');
  });

  function addSheet(it) {
    icsSheet('Aggiungi al Calendario', 'Promemoria <b>' + esc((it.emoji || '') + ' ' + it.title) + '</b> — ' + esc(summary(it)) + '.',
      [it], 'Stride-' + slug(it.key) + '.ics');
  }
  function offSheet(it) {
    UI.sheet({
      title: 'Togli dal Calendario', cls: 'small',
      html: '<p class="txt">Ho spento <b>' + esc(it.title) + '</b> nell\'app. Per fermare le notifiche toglilo anche dal Calendario:</p>' +
        '<ol class="steps"><li>Apri <b>Calendario</b>.</li><li>Tocca l\'evento <b>«' + esc((it.emoji ? it.emoji + ' ' : '') + it.title) + ' — Stride»</b>.</li><li>Tocca <b>Elimina evento</b>.</li><li>Scegli <b>Elimina tutti gli eventi futuri</b>.</li></ol>' +
        '<button class="btn primary block" data-act="sheet.close">Fatto</button>'
    });
  }
  UI.on('sheet.close', () => UI.closeSheets());

  /* ---------- pannello ---------- */
  function rowsHtml() {
    return items().map(it => {
      return '<div class="nrow"><span class="em">' + esc(it.emoji || '🔔') + '</span>' +
        '<div class="li-main"><div class="li-t">' + esc(it.title) + '</div><div class="li-s">' + esc(summary(it)) + '</div></div>' +
        '<button class="icon-btn sm" data-act="rem.edit" data-k="' + esc(it.key) + '" aria-label="Modifica ' + esc(it.title) + '">' + UI.icon('edit', 18) + '</button>' +
        '<button class="switch' + (it.on ? ' on' : '') + '" role="switch" aria-checked="' + (it.on ? 'true' : 'false') + '" aria-label="' + esc(it.title) + '" data-act="rem.toggle" data-k="' + esc(it.key) + '"></button></div>';
    }).join('');
  }
  function footHtml() {
    const n = items().filter(i => i.on).length;
    if (Cloud.pushOn()) return '<button class="btn block mt12" data-act="rem.new">+ Promemoria personalizzato</button>';
    return '<div class="row gap mt12"><button class="btn primary grow" data-act="rem.all"' + (n ? '' : ' disabled') + '>Aggiungi al Calendario quelli attivi' + (n ? ' (' + n + ')' : '') + '</button></div>' +
      '<button class="btn block mt8" data-act="rem.new">+ Promemoria personalizzato</button>' +
      '<div class="disc mt12">Senza notifiche dirette i promemoria arrivano dal Calendario dell\'iPhone.</div>';
  }
  /* scheda comprimibile per Oggi */
  function card() {
    const n = items().filter(i => i.on).length;
    return '<section class="card"><button class="collapse-h' + (openCard ? ' open' : '') + '" data-act="rem.collapse" style="min-height:24px"><h3 class="card-h-t" style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--tx2);margin:0">Notifiche' + (n ? ' · ' + n + ' attive' : '') + '</h3><span class="chev-ic">' + UI.icon('chev', 20) + '</span></button>' +
      (openCard ? '<div class="mt8">' + Cloud.pushBlock() + rowsHtml() + footHtml() + '</div>' : '') + '</section>';
  }
  function page() {
    return '<div class="card">' + Cloud.pushBlock() + rowsHtml() + footHtml() + '</div>';
  }

  UI.on('rem.collapse', () => { openCard = !openCard; try { sessionStorage.setItem('compagno_notif_open', openCard ? '1' : '0'); } catch (e) { /* ignora */ } UI.refresh(); });
  UI.on('rem.toggle', el => {
    const it = itemByKey(el.dataset.k);
    if (!it) return;
    const st = ensure(it);
    st.on = !it.on;
    Store.change();
    UI.refresh();
    const upd = itemByKey(it.key);
    if (Cloud.pushOn()) { UI.toast(st.on ? 'Notifica accesa' : 'Notifica spenta'); return; }
    if (st.on) addSheet(upd); else offSheet(upd);
  });
  UI.on('rem.all', () => {
    const list = items().filter(i => i.on);
    if (!list.length) return UI.toast('Nessuna notifica attiva');
    icsSheet('Tutte le notifiche attive', 'Un solo file con <b>' + list.length + '</b> promemoria: ' + esc(list.map(i => i.title).join(', ')) + '.', list, 'Stride-promemoria.ics');
  });

  function editSheet(key, isNew) {
    let it = isNew ? { key: 'custom:' + Store.uid('c'), title: '', emoji: '🔔', time: '09:00', days: ALL.slice(), everyH: 0, from: '09:00', to: '21:00', note: '', custom: true, on: false, seq: 0 } : itemByKey(key);
    if (!it) return;
    const draft = JSON.parse(JSON.stringify(it));
    const before = JSON.stringify([it.time, it.days, it.everyH, it.from, it.to]);
    const interval = () => draft.everyH > 0;
    const sh = UI.sheet({ title: isNew ? 'Nuovo promemoria' : 'Modifica promemoria', cls: 'tall' });
    function draw() {
      sh.set(
        (draft.custom ? UI.field('Titolo', UI.inp({ id: 're-title', value: draft.title, ph: 'es. Vitamina C' })) +
          UI.field('Emoji', UI.inp({ id: 're-emoji', value: draft.emoji, attrs: 'maxlength="4"' })) : '<div class="li-t mb8">' + esc((draft.emoji || '') + ' ' + draft.title) + '</div>') +
        '<div class="seg"><button class="' + (!interval() ? 'on' : '') + '" data-act="rem.kind" data-v="fixed">Orario fisso</button><button class="' + (interval() ? 'on' : '') + '" data-act="rem.kind" data-v="every">Ogni N ore</button></div>' +
        (interval()
          ? '<div class="grid3">' + UI.field('Ogni (ore)', UI.select([[1, '1'], [2, '2'], [3, '3'], [4, '4'], [6, '6']], draft.everyH, 'id="re-every"')) + UI.field('Dalle', UI.inp({ id: 're-from', type: 'time', value: draft.from })) + UI.field('Alle', UI.inp({ id: 're-to', type: 'time', value: draft.to })) + '</div>'
          : UI.field('Orario', UI.inp({ id: 're-time', type: 'time', value: draft.time }))) +
        '<div class="field-l" style="margin-bottom:6px">Giorni</div><div class="chips mb8">' + D.DAYS_IT.map((d, i) => '<button class="chip' + (draft.days.indexOf(i) >= 0 ? ' on' : '') + '" data-act="rem.day" data-v="' + i + '">' + d + '</button>').join('') + '</div>' +
        UI.field('Nota', UI.inp({ id: 're-note', value: draft.note, ph: 'facoltativa' })) +
        '<div class="row gap mt12">' + (draft.custom && !isNew ? '<button class="btn danger" data-act="rem.del">Elimina</button>' : '') + '<button class="btn primary grow" data-act="rem.save">Salva</button></div>'
      );
    }
    function read() {
      const g = id => sh.body.querySelector('#' + id);
      if (g('re-title')) draft.title = g('re-title').value.trim();
      if (g('re-emoji')) draft.emoji = g('re-emoji').value.trim();
      if (g('re-time')) draft.time = g('re-time').value || '09:00';
      if (g('re-every')) draft.everyH = +g('re-every').value;
      if (g('re-from')) draft.from = g('re-from').value || '09:00';
      if (g('re-to')) draft.to = g('re-to').value || '21:00';
      if (g('re-note')) draft.note = g('re-note').value;
    }
    draw();
    sh.body.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const a = b.dataset.act;
      if (a === 'rem.kind') { read(); if (b.dataset.v === 'every') { draft.everyH = draft.everyH || 2; } else draft.everyH = 0; draw(); }
      else if (a === 'rem.day') { read(); const i = +b.dataset.v; const ix = draft.days.indexOf(i); if (ix >= 0) draft.days.splice(ix, 1); else draft.days.push(i); draft.days.sort(); draw(); }
      else if (a === 'rem.save') {
        read();
        if (draft.custom && !draft.title) return UI.toast('Scrivi un titolo');
        if (!draft.days.length) return UI.toast('Scegli almeno un giorno');
        const st = ensure(draft);
        Object.assign(st, { title: draft.title, emoji: draft.emoji, time: draft.time, days: draft.days.slice(), everyH: draft.everyH, from: draft.from, to: draft.to, note: draft.note });
        if (isNew) st.on = false;
        const changed = before !== JSON.stringify([draft.time, draft.days, draft.everyH, draft.from, draft.to]);
        Store.change();
        sh.close();
        UI.refresh();
        if (st.on && changed && !Cloud.pushOn()) {
          const upd = itemByKey(st.key);
          UI.sheet({
            title: 'Aggiorna il Calendario', cls: 'small',
            html: '<p class="txt">Hai cambiato l\'orario di <b>' + esc(upd.title) + '</b>. Riaggiungi il promemoria: l\'evento è lo stesso e viene aggiornato. Se iOS lo duplica, elimina il vecchio (Calendario → evento → Elimina evento → Tutti gli eventi futuri).</p><button class="btn primary block" data-act="rem.readd" data-k="' + esc(upd.key) + '">Riaggiungi al Calendario</button>'
          });
        } else UI.toast('Salvato');
      } else if (a === 'rem.del') {
        UI.confirm({ title: 'Eliminare il promemoria?', msg: 'Verrà tolto dall\'app. Ricorda di eliminarlo anche dal Calendario.', ok: 'Elimina', danger: true }).then(ok => {
          if (!ok) return;
          const S = Store.s; S.reminders = S.reminders.filter(r => r.key !== draft.key);
          Store.change(); sh.close(); UI.refresh();
        });
      }
    });
  }
  UI.on('rem.readd', el => { const it = itemByKey(el.dataset.k); UI.closeSheets(); if (it) setTimeout(() => addSheet(it), 380); });
  UI.on('rem.edit', el => editSheet(el.dataset.k, false));
  UI.on('rem.new', () => editSheet(null, true));

  window.Rem = { items, card, page, buildICS, editSheet, itemByKey, summary, slots };
})();
