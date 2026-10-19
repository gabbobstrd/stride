/* Compagno - lettura del testo copiato dal Comando rapido «Stride Salute» (puro, provabile in node) */
(function (g) {
  'use strict';
  /* "8432", "8.432", "8,432", "8432,0", "12.345,0" -> numero intero */
  function parseSteps(raw) {
    let s = String(raw || '').replace(/[.,]+$/, '');
    if (!s) return NaN;
    const ci = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    if (ci >= 0 && /^\d{1,2}$/.test(s.slice(ci + 1))) s = s.slice(0, ci);
    s = s.replace(/[.,](?=\d{3}(?!\d))/g, '');
    s = s.replace(/[.,]/g, '');
    return /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
  }
  /* primo numero decimale (virgola o punto) */
  function dec(v) {
    const m = String(v == null ? '' : v).match(/-?\d+(?:[.,]\d+)?/);
    return m ? parseFloat(m[0].replace(',', '.')) : NaN;
  }
  function parseSleep(v) {
    const s = String(v || '').toLowerCase();
    let m = s.match(/(\d+(?:[.,]\d+)?)\s*(?:h|ore|ora)\s*(?:e\s*)?(?:(\d{1,2})\s*(?:m|min\w*)?)?/);
    if (m && /[a-z]/.test(s)) { const h = parseFloat(m[1].replace(',', '.')); return h + (m[2] ? parseInt(m[2], 10) / 60 : 0); }
    m = s.match(/^(\d{1,2}):(\d{2})/);
    if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
    return dec(s);
  }
  function parseDate(v) {
    const s = String(v || '').trim();
    let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = s.match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);
    if (m) return m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
    return null;
  }
  const KEYMAP = { data: 'date', date: 'date', peso: 'w', weight: 'w', grasso: 'bf', fat: 'bf', bodyfat: 'bf', passi: 'steps', steps: 'steps', sonno: 'sleep', sleep: 'sleep', fc: 'hr', hr: 'hr', heartrate: 'hr' };
  const R2 = x => Math.round(x * 10) / 10;

  /* risultato: {kind:'compagno'|'passi', date|null, w, bf, steps, sleep, hr} (chiavi mancanti assenti) oppure null */
  function parse(txt) {
    txt = String(txt == null ? '' : txt);
    if (/(^|\s)(STRIDE|COMPAGNO)\b/i.test(txt)) {
      const out = { kind: 'compagno', date: null };
      const re = /([A-Za-zÀ-ÿ_]+)\s*[=:]\s*([^=\n\r;]*?)(?=\s+[A-Za-zÀ-ÿ_]+\s*[=:]|[\n\r;]|$)/g;
      let m;
      while ((m = re.exec(txt))) {
        const key = KEYMAP[m[1].toLowerCase()];
        const val = m[2].trim();
        if (!key || val === '') continue;
        if (key === 'date') { const d = parseDate(val); if (d) out.date = d; continue; }
        let x;
        if (key === 'steps') x = parseSteps(val.replace(/\s*(passi|steps).*/i, ''));
        else if (key === 'sleep') x = parseSleep(val);
        else x = dec(val);
        if (!isFinite(x)) continue;
        if (key === 'w' && x >= 20 && x <= 400) out.w = R2(x);
        else if (key === 'bf') { if (x > 0 && x <= 1) x *= 100; if (x >= 2 && x <= 70) out.bf = R2(x); }
        else if (key === 'steps' && x >= 0 && x <= 100000) out.steps = Math.round(x);
        else if (key === 'sleep' && x > 0 && x <= 24) out.sleep = R2(x);
        else if (key === 'hr' && x >= 25 && x <= 220) out.hr = Math.round(x);
      }
      return ['w', 'bf', 'steps', 'sleep', 'hr'].some(k => out[k] !== undefined) ? out : null;
    }
    const m = txt.match(/PASSI\s+([\d.,]+)\s+(\d{4}-\d{2}-\d{2})/i);
    if (m) { const n = parseSteps(m[1]); if (n >= 0) return { kind: 'passi', date: m[2], steps: n }; }
    return null;
  }
  g.Salute = { parse, parseSteps };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.Salute;
})(typeof window !== 'undefined' ? window : globalThis);
