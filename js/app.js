/* Compagno - avvio, navigazione, primo avvio */
(function () {
  'use strict';
  window.APP_VERSION = '1.1';
  const esc = UI.esc;
  const TABS = [['oggi', 'Oggi'], ['cibo', 'Cibo'], ['palestra', 'Palestra'], ['grafici', 'Grafici'], ['altro', 'Altro']];

  function drawTabs() {
    document.querySelectorAll('.tabbar button').forEach(b => {
      const t = TABS.find(x => x[0] === b.dataset.tab);
      b.innerHTML = UI.icon(t[0], 24) + '<span>' + t[1] + '</span>';
      b.setAttribute('aria-label', t[1]);
    });
  }

  /* ---------- primo avvio ---------- */
  UI.registerView('onb', {
    title: 'Benvenuto',
    render() {
      return '<div style="padding:6px 4px 14px"><div class="big" style="font-size:28px">Ciao, benvenuto in <span class="acc">Stride</span></div>' +
        '<p class="small mut mt8">Il tuo diario di cibo, allenamento e salute. I dati restano su questo telefono. Dimmi qualcosa di te e calcolo i tuoi numeri: ci metti 1 minuto.</p></div>' +
        Altro.profileForm() + Altro.profileResult() +
        '<button class="btn primary block mb12" data-act="app.start">Inizia</button>' +
        '<p class="xs mut center">Potrai cambiare tutto in Altro → Profilo e obiettivi.</p>';
    }
  });
  function startOnboarding() {
    const s = Store.s;
    if (!s.profile) {
      s.profile = { name: '', sex: 'M', birth: '1995-01-01', height: 175, weight: 75, activity: 1.55, goal: 'massa', rateKg: 0.25, protPerKg: 2.0, fatPerKg: 0.9, trainDays: 4, split: 'PPL', useAdaptive: false, kcalOverride: '', onb: false };
      Store.change();
    }
    document.body.classList.add('onb');
    UI.state.cur = 'onb';
    UI.render();
  }
  UI.on('app.start', () => {
    const p = Store.s.profile;
    p.onb = true;
    const b = Store.ensureBody(Store.today());
    if (!b.w) b.w = +p.weight;
    Store.change();
    document.body.classList.remove('onb');
    UI.go('oggi');
    UI.toast('Tutto pronto' + (p.name ? ', ' + p.name : '') + '!');
  });

  UI.on('nav', el => {
    const t = el.dataset.tab;
    if (UI.state.cur === t) {
      if (t === 'altro') { Altro.sub = null; UI.refresh(); }
      UI.scrollTop();
      return;
    }
    UI.go(t, t === 'altro' ? { reset: true } : undefined);
  });

  async function boot() {
    try {
      await Store.init();
    } catch (e) {
      document.getElementById('view').innerHTML = '<div class="card alert"><b>Non riesco ad aprire l\'archivio dati.</b><p class="small mt8">' + esc(e.message) + '</p></div>';
      return;
    }
    UI.init();
    drawTabs();
    const p = Store.s.profile;
    if (!p || p.onb === false) startOnboarding();
    else {
      let tab = 'oggi';
      try { const t = sessionStorage.getItem('compagno_tab'); if (t && TABS.some(x => x[0] === t)) tab = t; } catch (e) { /* ignora */ }
      UI.go(tab);
    }
    /* sessione ripresa: nulla da fare, il timer riparte solo con una nuova serie */
    let lastDay = Store.today();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      const t = Store.today();
      if (t !== lastDay) { Oggi.date = t; Cibo.date = t; lastDay = t; UI.refresh(); }
    });
    window.addEventListener('error', e => console.error('Errore:', e.message));
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').then(r => { try { r.update(); } catch (e) { /* ignora */ } }).catch(() => { });
    }
  }
  boot();
})();
