/* Compagno - porzioni casalinghe italiane (scritte a mano) + porzioni personali */
(function (g) {
  'use strict';
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, ' ').replace(/\s+/g, ' ').trim(); }

  /* re  = regex sul nome normalizzato dell'alimento (a cui la porzione si applica)
     say = regex sul testo normalizzato, senza «di/d'/del...», che segue il numero ("fetta pane", "cucchiaio olio")
     pick = nomi (prefissi normalizzati) dell'alimento preferito, in ordine
     pc = pezzo naturale (per la lista della spesa) */
  const LIST = [
    { id: 'sottiletta', label: 'sottiletta', plural: 'sottilette', g: 20, re: /sottilett/, say: /^sottilett[ae]/, pick: ['formaggio fuso a fette'], pc: true },
    { id: 'uovo', label: 'uovo medio', plural: 'uova medie', g: 55, re: /^uov[oa] (intero|sodo|fritto|in camicia)|^uova strapazzate/, say: /^uov[oa]\b/, pick: ['uovo intero'], pc: true },
    { id: 'albume', label: 'albume', plural: 'albumi', g: 33, re: /^albume/, say: /^album[ei]/, pick: ['albume d uovo, crudo'], pc: true },
    { id: 'tuorlo', label: 'tuorlo', plural: 'tuorli', g: 18, re: /^tuorlo/, say: /^tuorl[oi]/, pick: ['tuorlo'], pc: true },
    { id: 'pane', label: 'fetta di pane', plural: 'fette di pane', g: 30, re: /^pane/, say: /^fett[ae] pane/, q: 'pane', pick: ['pane bianco in cassetta'], pc: true },
    { id: 'biscottata', label: 'fetta biscottata', plural: 'fette biscottate', g: 8, re: /biscottat|crispbread/, say: /^fett[ae] biscottat[ae]/, pick: ['fette biscottate', 'fette di pane di segale croccanti'], approx: true, pc: true },
    { id: 'biscotto', label: 'biscotto', plural: 'biscotti', g: 8, re: /^biscotti secchi|^frollini/, say: /^biscott[oi]\b/, pick: ['biscotti secchi'], pc: true },
    { id: 'olio-cucchiaio', label: 'cucchiaio d\'olio', plural: 'cucchiai d\'olio', g: 10, re: /^olio/, say: /^cucchiai[oi] olio/, q: 'olio', pick: ['olio extravergine'] },
    { id: 'olio-cucchiaino', label: 'cucchiaino d\'olio', plural: 'cucchiaini d\'olio', g: 4, re: /^olio/, say: /^cucchiain[oi] olio/, q: 'olio', pick: ['olio extravergine'] },
    { id: 'zucchero-cucchiaino', label: 'cucchiaino di zucchero', plural: 'cucchiaini di zucchero', g: 5, re: /^zucchero/, say: /^cucchiain[oi] zucchero/, q: 'zucchero', pick: ['zucchero semolato'] },
    { id: 'zucchero-cucchiaio', label: 'cucchiaio di zucchero', plural: 'cucchiai di zucchero', g: 12, re: /^zucchero/, say: /^cucchiai[oi] zucchero/, q: 'zucchero', pick: ['zucchero semolato'] },
    { id: 'yogurt', label: 'vasetto di yogurt', plural: 'vasetti di yogurt', g: 125, re: /^yogurt/, say: /^(vasett[oi] )?yogurt/, pick: ['yogurt greco 0', 'yogurt bianco magro'], pc: true },
    { id: 'latte-tazza', label: 'tazza di latte', plural: 'tazze di latte', g: 200, re: /^latte (intero|parzialmente|scremato)/, say: /^tazz[ae] latte/, pick: ['latte parzialmente scremato (2', 'latte intero'] },
    { id: 'tazza', label: 'tazza', plural: 'tazze', g: 200, cat: /^bevande/, say: /^tazz[ae]\b/, pick: [] },
    { id: 'bicchiere', label: 'bicchiere', plural: 'bicchieri', g: 200, cat: /^bevande/, say: /^bicchier[ei]\b/, pick: [] },
    { id: 'bicchiere-vino', label: 'bicchiere di vino', plural: 'bicchieri di vino', g: 125, re: /^vino/, say: /^bicchier[ei] vino/, pick: ['vino rosso'] },
    { id: 'tazzina', label: 'tazzina di caffè', plural: 'tazzine di caffè', g: 30, re: /^caffe espresso/, say: /^tazzin[ae]/, q: 'caffe espresso', pick: ['caffe espresso'] },
    { id: 'mela', label: 'mela media', plural: 'mele medie', g: 180, re: /^mele (con|senza) buccia/, say: /^mel[ae]\b/, pick: ['mele con buccia'], pc: true },
    { id: 'banana', label: 'banana media', plural: 'banane medie', g: 120, re: /^banane/, say: /^banan[ae]/, pick: ['banane'], pc: true },
    { id: 'arancia', label: 'arancia media', plural: 'arance medie', g: 150, re: /^arance, crude/, say: /^aranc(ia|e)\b/, pick: ['arance, crude'], pc: true },
    { id: 'prosciutto', label: 'fetta di prosciutto', plural: 'fette di prosciutto', g: 15, re: /^prosciutto/, say: /^fett[ae] prosciutto/, q: 'prosciutto', pick: ['prosciutto cotto magro', 'prosciutto crudo'] },
    { id: 'bresaola', label: 'fetta di bresaola', plural: 'fette di bresaola', g: 10, re: /bresaola/, say: /^fett[ae] bresaola/, pick: ['manzo essiccato'] },
    { id: 'tonno', label: 'scatoletta di tonno (sgocciolato)', plural: 'scatolette di tonno (sgocciolato)', g: 52, re: /^tonno.*sgocciolat/, say: /^scatolett[ae]( tonno)?/, pick: ['tonno al naturale, sgocciolato'], pc: true },
    { id: 'pasta', label: 'porzione di pasta', plural: 'porzioni di pasta', g: 80, re: /^pasta .*(cruda|secca)/, say: /^porzion[ei] pasta/, q: 'pasta', pick: ['pasta di semola, cruda'] },
    { id: 'riso', label: 'porzione di riso', plural: 'porzioni di riso', g: 80, re: /^riso .*crud/, say: /^porzion[ei] riso/, q: 'riso', pick: ['riso bianco, crudo'] },
    { id: 'mozzarella', label: 'mozzarella', plural: 'mozzarelle', g: 125, re: /^mozzarella/, say: /^mozzarell[ae]/, pick: ['mozzarella di latte intero'], pc: true },
    { id: 'parmigiano', label: 'cucchiaio di parmigiano', plural: 'cucchiai di parmigiano', g: 5, re: /^parmigiano/, say: /^cucchiai[oi] (parmigiano|grana)/, pick: ['parmigiano grattugiato'] },
    { id: 'noce', label: 'noce', plural: 'noci', g: 5, re: /^noci$/, say: /^noc[ei]\b/, pick: ['noci'] },
    { id: 'mandorla', label: 'mandorla', plural: 'mandorle', g: 1.2, re: /^mandorle/, say: /^mandorl[ae]/, pick: ['mandorle'] },
    { id: 'cracker', label: 'cracker', plural: 'cracker', g: 5, re: /^cracker/, say: /^cracker/, pick: ['cracker integrali', 'cracker salati'] },
    { id: 'cracker-pacchetto', label: 'pacchetto di cracker', plural: 'pacchetti di cracker', g: 25, re: /^cracker/, say: /^pacchett[oi] cracker/, pick: ['cracker integrali', 'cracker salati'], pc: true },
    { id: 'petto', label: 'fetta di petto di pollo/tacchino', plural: 'fette di petto di pollo/tacchino', g: 100, re: /^petto di (pollo|tacchino)/, say: /^(fett[ae] petto|fettin[ae])/, q: 'petto', pick: ['petto di pollo, crudo'], pc: true },
    { id: 'misurino', label: 'misurino di proteine', plural: 'misurini di proteine', g: 30, re: /whey|proteine (in polvere|del siero)/, say: /^misurin[oi]/, pick: ['proteine whey', 'whey', 'proteine in polvere'] },
    { id: 'miele-cucchiaio', label: 'cucchiaio di miele', plural: 'cucchiai di miele', g: 20, re: /^miele/, say: /^cucchiai[oi] miele/, pick: ['miele'] },
    { id: 'miele-cucchiaino', label: 'cucchiaino di miele', plural: 'cucchiaini di miele', g: 7, re: /^miele/, say: /^cucchiain[oi] miele/, pick: ['miele'] },
    { id: 'marmellata', label: 'cucchiaio di marmellata', plural: 'cucchiai di marmellata', g: 15, re: /^marmellata/, say: /^cucchiai[oi] (marmellata|confettura)/, pick: ['marmellata'] },
    { id: 'burro-arachidi', label: 'cucchiaio di burro di arachidi', plural: 'cucchiai di burro di arachidi', g: 16, re: /burro di arachidi/, say: /^cucchiai[oi] burro arachidi/, pick: ['burro di arachidi'] },
    { id: 'burro', label: 'cucchiaio di burro', plural: 'cucchiai di burro', g: 10, re: /^burro (salato|non salato)/, say: /^cucchiai[oi] burro\b(?! arachidi)/, pick: ['burro non salato', 'burro salato'] }
  ];

  const STOP = /\b(di|d|del|dello|della|dei|degli|delle|al|alla|allo|ai|con|il|lo|la|i|gli|le|un|uno|una|in|a|da|per|tipo|circa)\b/g;
  /* toglie «di/d'/del...» per confrontare "fetta di pane" con "fetta pane" */
  function squash(s) { return norm(s).replace(STOP, ' ').replace(/\s+/g, ' ').trim(); }

  function personal(foodId) {
    try { const p = Store.s.settings.portions; return (p && p[foodId]) || []; } catch (e) { return []; }
  }
  /* porzioni valide per un alimento: personali, poi integrate */
  function forFood(food, pers) {
    if (!food) return [];
    const nn = norm(food.n), cat = norm(food.cat || '');
    const out = [];
    (pers || personal(food.id)).forEach(p => out.push({ label: p.label, plural: p.label, g: +p.g, personal: true }));
    LIST.forEach(p => {
      if ((p.re && p.re.test(nn)) || (p.cat && p.cat.test(cat))) out.push({ id: p.id, label: p.label, plural: p.plural, g: p.g, pc: !!p.pc });
    });
    return out;
  }
  function addPersonal(foodId, label, gr) {
    const s = Store.s.settings;
    if (!s.portions) s.portions = {};
    if (!s.portions[foodId]) s.portions[foodId] = [];
    s.portions[foodId].push({ label: label, g: gr });
  }
  function removePersonal(foodId, i) {
    const a = Store.s.settings.portions && Store.s.settings.portions[foodId];
    if (a) a.splice(i, 1);
  }
  function pluralOf(label, n) {
    if (n === 1) return label;
    const b = LIST.find(p => p.label === label);
    return b ? b.plural : label;
  }
  function fmtN(x) { return String(Math.round(x * 100) / 100).replace('.', ','); }
  /* "1 sottiletta (20 g)" oppure "55 g" */
  function fmtItem(it) {
    if (it && it.pl && +it.pq > 0) return fmtN(+it.pq) + ' ' + pluralOf(it.pl, +it.pq) + ' (' + fmtN(+it.g) + ' g)';
    return fmtN(+it.g) + ' g';
  }
  /* elenco per il prompt di Gemini */
  function promptList() {
    return LIST.filter(p => !p.cat).map(p => p.label + '|' + p.g + ' g').join('\n') + '\nbicchiere|200 g\ntazza|200 g';
  }

  g.Portions = { LIST, norm, squash, forFood, personal, addPersonal, removePersonal, pluralOf, fmtItem, promptList };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.Portions;
})(typeof window !== 'undefined' ? window : globalThis);
