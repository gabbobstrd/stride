/* Compagno - check-in settimanale (calcolo locale; i referti non entrano mai) */
(function () {
  'use strict';
  const esc = UI.esc, fmt = UI.fmt, S = () => Store.s;

  function yesterday() { return Store.addDays(Store.today(), -1); }
  function windows() {
    const y = yesterday();
    return { cur: Calc.lastDays(y, 7), prev: Calc.lastDays(Store.addDays(y, -7), 7) };
  }
  function avgOf(a) { return a.length ? Calc.mean(a) : null; }
  function stats(days) {
    const diary = S().diary, body = S().body, well = S().well;
    const logged = days.filter(d => diary[d] && diary[d].items && diary[d].items.length);
    const tots = logged.map(d => Calc.dayTotals(d).tot);
    const pos = (o, k) => (o && Calc.num(+o[k]) && +o[k] > 0 ? +o[k] : null);
    return {
      w: avgOf(days.map(d => pos(body[d], 'w')).filter(x => x !== null)),
      wN: days.filter(d => pos(body[d], 'w') !== null).length,
      logged: logged.length,
      kcal: avgOf(tots.map(t => t.kcal).filter(x => x > 0)),
      prot: avgOf(tots.map(t => t.prot)),
      sessions: S().sessions.filter(s => s.date >= days[0] && s.date <= days[days.length - 1]).length,
      sets: Calc.muscleSets(days[0], days[days.length - 1]),
      sleep: avgOf(days.map(d => pos(well[d], 'sleep')).filter(x => x !== null)),
      energy: avgOf(days.map(d => pos(well[d], 'energy')).filter(x => x !== null)),
      steps: avgOf(days.map(d => pos(diary[d], 'steps')).filter(x => x !== null))
    };
  }
  function planned() {
    const p = S().programs.find(q => q.id === S().activeProgram);
    return (p && p.days.length) || +(S().profile && S().profile.trainDays) || 0;
  }
  /* righe leggibili: {l, t} */
  function summary() {
    const W = windows(), c = stats(W.cur), p = stats(W.prev), tg = Calc.targets(yesterday());
    const rows = [];
    const diff = (a, b, d, u) => (a !== null && b !== null ? ' (' + (a - b >= 0 ? '+' : '−') + fmt(Math.abs(a - b), d) + (u ? ' ' + u : '') + ' sulla settimana prima)' : '');
    rows.push({ l: 'Peso medio', t: c.w === null ? 'nessuna pesata' : fmt(c.w, 1) + ' kg' + diff(c.w, p.w, 1, 'kg') + ' · ' + c.wN + ' pesate' });
    rows.push({ l: 'Giorni registrati', t: c.logged + ' su 7' });
    rows.push({ l: 'Kcal medie', t: c.kcal === null ? 'n.d.' : fmt(c.kcal) + ' / ' + fmt(tg.kcal) + ' obiettivo' + diff(c.kcal, p.kcal, 0, 'kcal') });
    rows.push({ l: 'Proteine medie', t: c.logged ? fmt(c.prot) + ' g / ' + fmt(tg.prot) + ' g obiettivo' : 'n.d.' });
    rows.push({ l: 'Allenamenti', t: c.sessions + ' fatti' + (planned() ? ' su ' + planned() + ' previsti' : '') });
    const m = Object.keys(c.sets).filter(k => c.sets[k] > 0).sort((a, b) => c.sets[b] - c.sets[a]);
    rows.push({ l: 'Serie per muscolo', t: m.length ? m.slice(0, 8).map(k => D.MUSCLES[k].toLowerCase() + ' ' + UI.fmtA(c.sets[k], 1) + (c.sets[k] < 10 ? ' (sotto 10)' : c.sets[k] > 20 ? ' (sopra 20)' : '')).join(', ') + ' · fascia utile 10–20' : 'nessuna serie' });
    rows.push({ l: 'Sonno medio', t: c.sleep === null ? 'n.d.' : fmt(c.sleep, 1) + ' ore' + diff(c.sleep, p.sleep, 1, 'h') });
    rows.push({ l: 'Energia media', t: c.energy === null ? 'n.d.' : fmt(c.energy, 1) + ' su 5' });
    rows.push({ l: 'Passi medi', t: c.steps === null ? 'n.d.' : fmt(c.steps) });
    return { rows, cur: c, from: W.cur[0], to: W.cur[6] };
  }
  function summaryText() {
    const s = summary();
    return 'Check-in della settimana (dal ' + UI.dateShort(s.from) + ' al ' + UI.dateShort(s.to) + '), confronto con la settimana precedente:\n' + s.rows.map(r => '- ' + r.l + ': ' + r.t).join('\n') + '\nCosa va bene, cosa miglioro e cosa cambio la prossima settimana? Massimo 5 punti.';
  }

  function due() {
    const t = Store.today(), list = S().checkins || [];
    const last = list.length ? list[list.length - 1].date : null;
    const since = last ? Store.diffDays(t, last) : 999;
    if (since < 5) return false;
    const logged = Calc.lastDays(t, 14).filter(d => Store.getDay(d).items.length).length;
    const dow = new Date().getDay();
    if ((dow === 0 || dow === 1) && logged >= 1) return true;
    return since > 7 && logged >= 4;
  }
  function card(date) {
    if (date !== Store.today() || !S().profile || !due()) return '';
    const s = summary();
    return UI.card('Check-in della settimana',
      '<div class="list">' + s.rows.map(r => '<div class="li" style="min-height:40px;align-items:flex-start"><div class="li-main"><div class="li-s" style="white-space:normal">' + esc(r.l) + '</div><div style="font-size:14px">' + esc(r.t) + '</div></div></div>').join('') + '</div>' +
      '<div class="row gap mt8"><button class="btn grow" data-act="checkin.done">Fatto</button><button class="btn primary grow" data-act="checkin.coach">Chiedi al Coach</button></div>' +
      '<p class="xs mut mt8">Ultimi 7 giorni completi (' + esc(UI.dateShort(s.from)) + ' – ' + esc(UI.dateShort(s.to)) + ') contro i 7 precedenti. Calcolo fatto sul telefono.</p>',
      { right: UI.dateShort(s.from) + ' – ' + UI.dateShort(s.to) });
  }
  UI.on('checkin.done', () => {
    const s = summary(), c = s.cur;
    S().checkins.push({ date: Store.today(), from: s.from, to: s.to, w: c.w === null ? null : Math.round(c.w * 10) / 10, kcal: c.kcal === null ? null : Math.round(c.kcal), prot: c.logged ? Math.round(c.prot) : null, logged: c.logged, sessions: c.sessions });
    if (S().checkins.length > 104) S().checkins.shift();
    Store.change(); UI.refresh(); UI.toast('Check-in segnato');
  });
  UI.on('checkin.coach', () => {
    if (!S().settings.geminiKey) return UI.toast('Per il Coach serve la chiave Gemini (Altro → Impostazioni AI)');
    Coach.prefill(summaryText());
  });
  window.Checkin = { card, summary, summaryText, due };
})();
