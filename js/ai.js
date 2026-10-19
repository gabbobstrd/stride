/* Compagno - AI.json: chiamata Gemini con risposta JSON strutturata (chiave solo nell'header x-goog-api-key, mai nell'URL né nei log) */
(function () {
  'use strict';
  function fail(code, msg) { const e = new Error(msg); e.code = code; return e; }
  function hasKey() { return !!(Store.s && Store.s.settings && Store.s.settings.geminiKey); }

  /* o = {prompt, schema, image?: base64 | {mime, data}, system?, temperature?} -> oggetto JSON */
  async function json(o) {
    const st = Store.s.settings;
    if (!st.geminiKey) throw fail('nokey', 'Serve la chiave Gemini (gratis): aggiungila in Altro → Impostazioni AI.');
    if (!navigator.onLine) throw fail('offline', 'Sei offline: l\'AI ha bisogno di internet.');
    const parts = [{ text: o.prompt }];
    if (o.image) {
      const img = typeof o.image === 'string' ? { mime: 'image/jpeg', data: o.image } : o.image;
      parts.push({ inline_data: { mime_type: img.mime || 'image/jpeg', data: img.data } });
    }
    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: o.schema, temperature: o.temperature == null ? 0.2 : o.temperature }
    };
    if (o.system) body.systemInstruction = { parts: [{ text: o.system }] };
    let r;
    try {
      r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(st.model || 'gemini-3.5-flash') + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': st.geminiKey }, body: JSON.stringify(body)
      });
    } catch (e) { throw fail('network', 'Non riesco a contattare Gemini. Controlla la connessione.'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (j.error && j.error.message) || '';
      if (r.status === 429) throw fail('quota', quotaMsg(j, st.model));
      if (r.status === 400 && /API key/i.test(msg)) throw fail('key', 'La chiave Gemini non è valida. Controllala in Altro → Impostazioni AI.');
      if (r.status === 403) throw fail('key', 'Chiave non autorizzata per questo modello. Controllala in Altro → Impostazioni AI.');
      if (r.status === 404) throw fail('model', 'Modello «' + st.model + '» non trovato. Usa «Prova chiave» in Impostazioni AI.');
      throw fail('http', 'Errore ' + r.status + (msg ? ': ' + msg : ''));
    }
    const cand = j.candidates && j.candidates[0];
    if (!cand || !cand.content) throw fail('empty', j.promptFeedback && j.promptFeedback.blockReason ? 'Richiesta bloccata dal filtro di sicurezza.' : 'Risposta vuota. Riprova.');
    let txt = (cand.content.parts || []).map(x => x.text || '').join('').trim();
    txt = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { return JSON.parse(txt); } catch (e) { throw fail('json', 'La risposta dell\'AI non era leggibile. Riprova.'); }
  }
  /* spiega il 429 di Google: modello non gratuito, limite del giorno o del minuto */
  function quotaMsg(j, model) {
    const e = j && j.error || {}, msg = e.message || '';
    const det = JSON.stringify(e.details || []);
    const m = model || 'questo modello';
    if (/limit:\s*0\b/.test(msg)) return 'Il modello «' + m + '» non è nel piano gratuito della tua chiave. In Altro → Impostazioni AI premi «Prova chiave» e scegli un modello «flash-lite».';
    if (/PerDay|per day|RPD/i.test(msg + det)) return 'Limite gratuito di oggi finito per «' + m + '». Riprova domani o scegli un modello «flash-lite» in Altro → Impostazioni AI.';
    const rd = det.match(/"retryDelay":"(\d+)/);
    return 'Troppe richieste in poco tempo su «' + m + '». Riprova tra ' + (rd ? rd[1] + ' secondi' : 'un minuto') + '.';
  }
  window.AI = { json, hasKey, quotaMsg };
})();
