/* Compagno - dati statici: nutrienti, esercizi, esami, integratori, schede modello */
(function () {
  'use strict';

  /* Nutrienti (valori per 100 g negli alimenti). u = unita'. g = gruppo. d = decimali. */
  const NUTR = [
    { k: 'kcal', n: 'Energia', u: 'kcal', g: 'macro', d: 0 },
    { k: 'prot', n: 'Proteine', u: 'g', g: 'macro', d: 1 },
    { k: 'carb', n: 'Carboidrati', u: 'g', g: 'macro', d: 1 },
    { k: 'fat', n: 'Grassi', u: 'g', g: 'macro', d: 1 },
    { k: 'fib', n: 'Fibre', u: 'g', g: 'macro', d: 1 },
    { k: 'sug', n: 'Zuccheri', u: 'g', g: 'macro', d: 1 },
    { k: 'sfa', n: 'Grassi saturi', u: 'g', g: 'grassi', d: 1 },
    { k: 'mufa', n: 'Monoinsaturi', u: 'g', g: 'grassi', d: 1 },
    { k: 'pufa', n: 'Polinsaturi', u: 'g', g: 'grassi', d: 1 },
    { k: 'o3', n: 'Omega-3', u: 'g', g: 'grassi', d: 2 },
    { k: 'epadha', n: 'EPA+DHA', u: 'g', g: 'grassi', d: 2 },
    { k: 'chol', n: 'Colesterolo', u: 'mg', g: 'grassi', d: 0 },
    { k: 'vitA', n: 'Vitamina A', u: 'µg', g: 'vit', d: 0 },
    { k: 'vitC', n: 'Vitamina C', u: 'mg', g: 'vit', d: 0 },
    { k: 'vitD', n: 'Vitamina D', u: 'µg', g: 'vit', d: 1 },
    { k: 'vitE', n: 'Vitamina E', u: 'mg', g: 'vit', d: 1 },
    { k: 'vitK', n: 'Vitamina K', u: 'µg', g: 'vit', d: 0 },
    { k: 'b1', n: 'Vitamina B1', u: 'mg', g: 'vit', d: 2 },
    { k: 'b2', n: 'Vitamina B2', u: 'mg', g: 'vit', d: 2 },
    { k: 'b3', n: 'Vitamina B3', u: 'mg', g: 'vit', d: 1 },
    { k: 'b5', n: 'Vitamina B5', u: 'mg', g: 'vit', d: 1 },
    { k: 'b6', n: 'Vitamina B6', u: 'mg', g: 'vit', d: 2 },
    { k: 'b9', n: 'Folati (B9)', u: 'µg', g: 'vit', d: 0 },
    { k: 'b12', n: 'Vitamina B12', u: 'µg', g: 'vit', d: 1 },
    { k: 'coline', n: 'Colina', u: 'mg', g: 'vit', d: 0 },
    { k: 'na', n: 'Sodio', u: 'mg', g: 'min', d: 0 },
    { k: 'k', n: 'Potassio', u: 'mg', g: 'min', d: 0 },
    { k: 'ca', n: 'Calcio', u: 'mg', g: 'min', d: 0 },
    { k: 'mg', n: 'Magnesio', u: 'mg', g: 'min', d: 0 },
    { k: 'p', n: 'Fosforo', u: 'mg', g: 'min', d: 0 },
    { k: 'fe', n: 'Ferro', u: 'mg', g: 'min', d: 1 },
    { k: 'zn', n: 'Zinco', u: 'mg', g: 'min', d: 1 },
    { k: 'cu', n: 'Rame', u: 'mg', g: 'min', d: 2 },
    { k: 'mn', n: 'Manganese', u: 'mg', g: 'min', d: 2 },
    { k: 'se', n: 'Selenio', u: 'µg', g: 'min', d: 0 },
    { k: 'caff', n: 'Caffeina', u: 'mg', g: 'altro', d: 0 },
    { k: 'alc', n: 'Alcol', u: 'g', g: 'altro', d: 1 }
  ];
  const NMAP = {};
  NUTR.forEach(x => { NMAP[x.k] = x; });
  const GROUPS = { macro: 'Macronutrienti', grassi: 'Grassi e colesterolo', vit: 'Vitamine', min: 'Minerali', altro: 'Altro' };

  /* Micronutrienti con obiettivo minimo (LARN 2014 / EFSA) */
  const MICRO_KEYS = ['vitA', 'vitC', 'vitD', 'vitE', 'vitK', 'b1', 'b2', 'b3', 'b5', 'b6', 'b9', 'b12', 'coline', 'k', 'ca', 'mg', 'p', 'fe', 'zn', 'cu', 'mn', 'se'];

  /* Fabbisogni per sesso/eta'. Restituisce {t, ul} (t = obiettivo minimo, ul = limite massimo tollerabile). */
  function rda(k, sex, age) {
    const M = sex !== 'F';
    age = age || 30;
    switch (k) {
      case 'vitA': return { t: M ? 700 : 600, ul: 3000 };
      case 'vitC': return { t: M ? 105 : 85 };
      case 'vitD': return { t: age >= 75 ? 20 : 15, ul: 100 };
      case 'vitE': return { t: M ? 13 : 12, ul: 300 };
      case 'vitK': return { t: 140 };
      case 'b1': return { t: M ? 1.2 : 1.1 };
      case 'b2': return { t: M ? 1.6 : 1.3 };
      case 'b3': return { t: 18 };
      case 'b5': return { t: 5 };
      case 'b6': return { t: age >= 50 ? (M ? 1.7 : 1.5) : 1.3, ul: 12 };
      case 'b9': return { t: 400 };
      case 'b12': return { t: 2.4 };
      case 'coline': return { t: 400 };
      case 'ca': return { t: (age >= 60 || (!M && age >= 50)) ? 1200 : 1000, ul: 2500 };
      case 'p': return { t: 700 };
      case 'mg': return { t: 240 };
      case 'k': return { t: 3900 };
      case 'fe': return { t: M ? 10 : (age >= 50 ? 10 : 18) };
      case 'zn': return { t: M ? 12 : 9, ul: 25 };
      case 'cu': return { t: 0.9, ul: 5 };
      case 'mn': return { t: 3 };
      case 'se': return { t: 55, ul: 255 };
    }
    return null;
  }

  /* Alimenti ricchi (parole chiave) - non usato per i calcoli, solo per testi */
  const VEG_RE = /^(verdur|frutt|legum|cereali integral)/;

  /* Gruppi muscolari */
  const MUSCLES = {
    petto: 'Petto', dorso: 'Dorso', spalle: 'Spalle', bicipiti: 'Bicipiti', tricipiti: 'Tricipiti',
    quadricipiti: 'Quadricipiti', femorali: 'Femorali', glutei: 'Glutei', polpacci: 'Polpacci',
    addome: 'Addome', avambracci: 'Avambracci'
  };
  const EQUIP = { bilanciere: 'Bilanciere', manubri: 'Manubri', cavi: 'Cavi', macchina: 'Macchina', corpo: 'Corpo libero', altro: 'Altro' };

  /* Libreria esercizi: id, nome, primario, secondari, attrezzo */
  const EX = [
    ['panca', 'Panca piana con bilanciere', 'petto', ['tricipiti', 'spalle'], 'bilanciere'],
    ['panca-inc', 'Panca inclinata con bilanciere', 'petto', ['spalle', 'tricipiti'], 'bilanciere'],
    ['panca-man', 'Panca piana con manubri', 'petto', ['tricipiti', 'spalle'], 'manubri'],
    ['panca-inc-man', 'Panca inclinata con manubri', 'petto', ['spalle', 'tricipiti'], 'manubri'],
    ['chest-press', 'Pressa per il petto (chest press)', 'petto', ['tricipiti', 'spalle'], 'macchina'],
    ['croci-man', 'Croci con manubri', 'petto', ['spalle'], 'manubri'],
    ['croci-cavi', 'Croci ai cavi', 'petto', ['spalle'], 'cavi'],
    ['pec-deck', 'Pec deck (macchina a farfalla)', 'petto', [], 'macchina'],
    ['dip', 'Dip alle parallele', 'petto', ['tricipiti', 'spalle'], 'corpo'],
    ['piegamenti', 'Piegamenti sulle braccia', 'petto', ['tricipiti', 'spalle'], 'corpo'],
    ['lat', 'Lat machine presa larga', 'dorso', ['bicipiti'], 'cavi'],
    ['lat-stretta', 'Lat machine presa stretta', 'dorso', ['bicipiti'], 'cavi'],
    ['trazioni', 'Trazioni alla sbarra', 'dorso', ['bicipiti', 'avambracci'], 'corpo'],
    ['rematore-bil', 'Rematore con bilanciere', 'dorso', ['bicipiti', 'spalle'], 'bilanciere'],
    ['rematore-man', 'Rematore con manubrio', 'dorso', ['bicipiti'], 'manubri'],
    ['pulley', 'Pulley basso (rematore ai cavi)', 'dorso', ['bicipiti'], 'cavi'],
    ['row-macchina', 'Rematore alla macchina', 'dorso', ['bicipiti'], 'macchina'],
    ['pullover-cavi', 'Pullover ai cavi', 'dorso', [], 'cavi'],
    ['stacco', 'Stacco da terra', 'femorali', ['glutei', 'dorso', 'avambracci'], 'bilanciere'],
    ['stacco-rum', 'Stacco rumeno', 'femorali', ['glutei', 'dorso'], 'bilanciere'],
    ['shrug', 'Scrollate (shrug) con manubri', 'dorso', ['avambracci'], 'manubri'],
    ['lento', 'Lento avanti con bilanciere', 'spalle', ['tricipiti'], 'bilanciere'],
    ['shoulder-press', 'Lento avanti con manubri (shoulder press)', 'spalle', ['tricipiti'], 'manubri'],
    ['shoulder-macchina', 'Lento alla macchina (shoulder press)', 'spalle', ['tricipiti'], 'macchina'],
    ['alzate-lat', 'Alzate laterali con manubri', 'spalle', [], 'manubri'],
    ['alzate-lat-cavi', 'Alzate laterali ai cavi', 'spalle', [], 'cavi'],
    ['alzate-front', 'Alzate frontali', 'spalle', [], 'manubri'],
    ['alzate-post', 'Alzate posteriori (busto flesso)', 'spalle', ['dorso'], 'manubri'],
    ['face-pull', 'Face pull (tirate al viso ai cavi)', 'spalle', ['dorso'], 'cavi'],
    ['curl-bil', 'Curl con bilanciere', 'bicipiti', ['avambracci'], 'bilanciere'],
    ['curl-man', 'Curl con manubri', 'bicipiti', ['avambracci'], 'manubri'],
    ['curl-martello', 'Curl a martello', 'bicipiti', ['avambracci'], 'manubri'],
    ['curl-panca-sc', 'Curl alla panca Scott', 'bicipiti', [], 'macchina'],
    ['curl-cavi', 'Curl ai cavi', 'bicipiti', [], 'cavi'],
    ['curl-incl', 'Curl su panca inclinata', 'bicipiti', [], 'manubri'],
    ['push-down', 'Pushdown al cavo (spinte in basso)', 'tricipiti', [], 'cavi'],
    ['french', 'French press (skull crusher)', 'tricipiti', [], 'bilanciere'],
    ['tric-sopra', 'Estensioni sopra la testa', 'tricipiti', [], 'manubri'],
    ['tric-sopra-cavi', 'Estensioni sopra la testa ai cavi', 'tricipiti', [], 'cavi'],
    ['panca-presa-stretta', 'Panca presa stretta', 'tricipiti', ['petto', 'spalle'], 'bilanciere'],
    ['kickback', 'Estensioni per tricipiti con manubrio (kickback)', 'tricipiti', [], 'manubri'],
    ['squat', 'Squat con bilanciere', 'quadricipiti', ['glutei', 'femorali'], 'bilanciere'],
    ['squat-front', 'Squat frontale (front squat)', 'quadricipiti', ['glutei'], 'bilanciere'],
    ['goblet', 'Squat con manubrio (goblet squat)', 'quadricipiti', ['glutei'], 'manubri'],
    ['pressa', 'Pressa orizzontale (leg press)', 'quadricipiti', ['glutei', 'femorali'], 'macchina'],
    ['hack', 'Squat alla hack (hack squat)', 'quadricipiti', ['glutei'], 'macchina'],
    ['leg-ext', 'Estensioni per i quadricipiti (leg extension)', 'quadricipiti', [], 'macchina'],
    ['affondi', 'Affondi con manubri', 'quadricipiti', ['glutei', 'femorali'], 'manubri'],
    ['bulgaro', 'Squat bulgaro', 'quadricipiti', ['glutei'], 'manubri'],
    ['step-up', 'Salite su panca (step-up)', 'quadricipiti', ['glutei'], 'manubri'],
    ['leg-curl', 'Curl femorali sdraiato (leg curl)', 'femorali', [], 'macchina'],
    ['leg-curl-seduto', 'Curl femorali da seduto (leg curl)', 'femorali', [], 'macchina'],
    ['good-morning', 'Good morning (flessioni del busto con bilanciere)', 'femorali', ['glutei', 'dorso'], 'bilanciere'],
    ['hip-thrust', "Spinte d'anca (hip thrust)", 'glutei', ['femorali'], 'bilanciere'],
    ['glute-bridge', 'Ponte glutei', 'glutei', ['femorali'], 'corpo'],
    ['abduzioni', 'Abduzioni alla macchina', 'glutei', [], 'macchina'],
    ['kickback-cavo', 'Slanci indietro per i glutei al cavo (kickback)', 'glutei', [], 'cavi'],
    ['calf-piedi', 'Polpacci in piedi (calf)', 'polpacci', [], 'macchina'],
    ['calf-seduto', 'Polpacci da seduto (calf)', 'polpacci', [], 'macchina'],
    ['calf-pressa', 'Polpacci alla pressa (calf)', 'polpacci', [], 'macchina'],
    ['crunch', 'Crunch', 'addome', [], 'corpo'],
    ['crunch-cavi', 'Crunch ai cavi', 'addome', [], 'cavi'],
    ['leg-raise', 'Sollevamento gambe alla sbarra', 'addome', ['avambracci'], 'corpo'],
    ['plank', 'Plank', 'addome', [], 'corpo'],
    ['ab-wheel', 'Ruota addominale', 'addome', ['spalle'], 'altro'],
    ['russian', 'Torsioni russe (russian twist)', 'addome', [], 'altro'],
    ['farmer', 'Camminata del contadino (farmer walk)', 'avambracci', ['dorso', 'addome'], 'manubri'],
    ['curl-polso', 'Curl polsi', 'avambracci', [], 'manubri'],
    ['kb-swing', 'Swing con kettlebell', 'glutei', ['femorali', 'spalle'], 'altro'],
    ['rematore-t', 'Rematore al T-bar', 'dorso', ['bicipiti'], 'macchina'],
    ['trazioni-neg', 'Trazioni assistite', 'dorso', ['bicipiti'], 'macchina'],
    ['push-press', 'Push press (lento con spinta delle gambe)', 'spalle', ['tricipiti', 'quadricipiti'], 'bilanciere'],
    ['dip-macchina', 'Dip alla macchina', 'tricipiti', ['petto'], 'macchina'],
    ['hyperext', 'Iperestensioni', 'dorso', ['glutei', 'femorali'], 'corpo']
  ];
  const EXERCISES = EX.map(a => ({ id: a[0], n: a[1], mg: a[2], sec: a[3], eq: a[4] }));

  /* Esami del sangue: k, nome, unita', range indicativo [lo, hi], variante femminile */
  const LABS = [
    { k: 'emoglobina', n: 'Emoglobina', u: 'g/dL', r: [13, 17], rF: [12, 16] },
    { k: 'mcv', n: 'MCV', u: 'fL', r: [80, 100] },
    { k: 'ferritina', n: 'Ferritina', u: 'ng/mL', r: [30, 400], rF: [15, 150] },
    { k: 'sideremia', n: 'Sideremia', u: 'µg/dL', r: [60, 160] },
    { k: 'transferrina', n: 'Saturazione transferrina', u: '%', r: [20, 45] },
    { k: 'bil-tot', n: 'Bilirubina totale', u: 'mg/dL', r: [0.2, 1.2] },
    { k: 'bil-dir', n: 'Bilirubina diretta', u: 'mg/dL', r: [0, 0.3] },
    { k: 'bil-ind', n: 'Bilirubina indiretta', u: 'mg/dL', r: [0.1, 0.9] },
    { k: 'vitd', n: 'Vitamina D 25-OH', u: 'ng/mL', r: [30, 100] },
    { k: 'b12', n: 'Vitamina B12', u: 'pg/mL', r: [200, 900] },
    { k: 'folati', n: 'Folati', u: 'ng/mL', r: [4, 20] },
    { k: 'glicemia', n: 'Glicemia', u: 'mg/dL', r: [70, 100] },
    { k: 'hba1c', n: 'Emoglobina glicata (HbA1c)', u: 'mmol/mol', r: [20, 42] },
    { k: 'col-tot', n: 'Colesterolo totale', u: 'mg/dL', r: [null, 200] },
    { k: 'hdl', n: 'Colesterolo HDL', u: 'mg/dL', r: [40, null] },
    { k: 'ldl', n: 'Colesterolo LDL', u: 'mg/dL', r: [null, 115] },
    { k: 'trigliceridi', n: 'Trigliceridi', u: 'mg/dL', r: [null, 150] },
    { k: 'ast', n: 'AST (GOT)', u: 'U/L', r: [5, 40] },
    { k: 'alt', n: 'ALT (GPT)', u: 'U/L', r: [5, 41] },
    { k: 'ggt', n: 'GGT', u: 'U/L', r: [8, 61], rF: [5, 36] },
    { k: 'creatinina', n: 'Creatinina', u: 'mg/dL', r: [0.7, 1.2], rF: [0.5, 0.9] },
    { k: 'egfr', n: 'eGFR', u: 'mL/min', r: [90, null] },
    { k: 'urico', n: 'Acido urico', u: 'mg/dL', r: [3.5, 7.2], rF: [2.6, 6] },
    { k: 'tsh', n: 'TSH', u: 'µIU/mL', r: [0.4, 4] },
    { k: 'ft4', n: 'FT4', u: 'ng/dL', r: [0.8, 1.8] },
    { k: 'testosterone', n: 'Testosterone', u: 'ng/dL', r: [270, 1070], rF: [15, 70] },
    { k: 'ck', n: 'CK', u: 'U/L', r: [30, 200], rF: [30, 145] },
    { k: 'pcr', n: 'PCR', u: 'mg/L', r: [0, 5] },
    { k: 'gb', n: 'Globuli bianchi', u: '10³/µL', r: [4, 10] },
    { k: 'piastrine', n: 'Piastrine', u: '10³/µL', r: [150, 400] },
    { k: 'sodio', n: 'Sodio', u: 'mmol/L', r: [136, 145] },
    { k: 'potassio', n: 'Potassio', u: 'mmol/L', r: [3.5, 5.1] },
    { k: 'magnesio', n: 'Magnesio', u: 'mg/dL', r: [1.6, 2.6] },
    { k: 'calcio', n: 'Calcio', u: 'mg/dL', r: [8.6, 10.2] },
    { k: 'omocisteina', n: 'Omocisteina', u: 'µmol/L', r: [5, 15] }
  ];
  const LABMAP = {};
  LABS.forEach(x => { LABMAP[x.k] = x; });

  /* Integratori: schede informative */
  const SUPP_INFO = [
    { id: 'creatina', n: 'Creatina monoidrato', ev: 'forte', dose: '3–5 g al giorno, ogni giorno', t: 'Aumenta forza e massa magra insieme all\'allenamento con i pesi. Non serve la fase di carico. Fonte: posizione ISSN 2017.' },
    { id: 'caffeina', n: 'Caffeina', ev: 'forte', dose: '3–6 mg/kg, 30–60 minuti prima', t: 'Migliora prestazione e percezione dello sforzo. Evita nel pomeriggio tardi se disturba il sonno; attenzione con pressione alta o capogiri. Fonte: posizione ISSN 2021.' },
    { id: 'proteine', n: 'Proteine in polvere', ev: 'è cibo', dose: 'quanto serve per arrivare all\'obiettivo', t: 'Non è un integratore «magico»: è un modo comodo per raggiungere la quota di proteine. Se la raggiungi col cibo, non serve.' },
    { id: 'vitd', n: 'Vitamina D', ev: 'solo se carente', dose: 'dosaggio deciso dal medico', t: 'Utile solo se la 25-OH vitamina D è bassa. Il dosaggio lo stabilisce il medico: oltre certi livelli è dannosa.' },
    { id: 'omega3', n: 'Omega-3 (EPA/DHA)', ev: 'moderata', dose: 'circa 250 mg al giorno di EPA+DHA (EFSA)', t: 'Utile se mangi poco pesce azzurro/grasso. Se mangi pesce 2 volte a settimana di solito non serve.' },
    { id: 'betaalanina', n: 'Beta-alanina', ev: 'moderata', dose: '3,2–6,4 g al giorno', t: 'Efficace per sforzi intensi di 1–4 minuti. Può dare formicolio innocuo (parestesia): dividi la dose in più assunzioni.' },
    { id: 'magnesio', n: 'Magnesio', ev: 'se carente', dose: 'solo se i valori o la dieta lo richiedono', t: 'Utile se l\'apporto dalla dieta è basso o gli esami sono carenti; non migliora la prestazione in chi non è carente. Attenzione in caso di problemi renali.' },
    { id: 'ferro', n: 'Ferro', ev: 'solo con esami', dose: 'solo su indicazione del medico', t: 'Prenderlo senza carenza accertata può fare male. Si valuta con emoglobina, MCV, ferritina e sideremia.' },
    { id: 'citrullina', n: 'Citrullina', ev: 'limitata', dose: '6–8 g di citrullina malato circa un\'ora prima', t: 'Prove limitate e incoerenti su prestazione e resistenza.' },
    { id: 'ashwagandha', n: 'Ashwagandha', ev: 'limitata', dose: 'non standardizzata', t: 'Prove limitate. Cautela con tiroide e fegato (casi di danno epatico segnalati): chiedi al medico.' }
  ];

  /* Antinutrienti: consiglio pratico per tipo */
  const ANTI = {
    fit: { n: 'Fitati', t: 'Ammollo, germinazione o lievito madre riducono i fitati e migliorano l\'assorbimento di ferro e zinco.' },
    oss: { n: 'Ossalati', t: 'La bollitura (buttando l\'acqua) li riduce; alterna le verdure. Attenzione ai calcoli renali: chiedi al medico.' },
    lec: { n: 'Lectine', t: 'I fagioli e i legumi vanno ammollati e bolliti almeno 10 minuti: mai mangiarli crudi o poco cotti.' },
    tan: { n: 'Tannini', t: 'Tè e caffè lontani dai pasti riducono l\'assorbimento del ferro non-eme; la vitamina C lo aiuta.' },
    goi: { n: 'Gozzigeni', t: 'Brassicacee crude e soia: contano solo se lo iodio è scarso. Cuocile e usa sale iodato.' }
  };
  const ANTI_LVL = ['', 'basso', 'medio', 'alto'];

  /* Schede modello */
  function T(ex, sets, rmin, rmax, rest) { return { e: ex, sets: sets, rmin: rmin, rmax: rmax, rest: rest }; }
  const TEMPLATES = [
    {
      id: 'ppl', n: 'Push Pull Legs', d: '3 giorni, da ripetere anche 6 volte a settimana',
      days: [
        { n: 'Push', ex: [T('panca', 4, 6, 8, 150), T('shoulder-press', 3, 8, 10, 120), T('panca-inc-man', 3, 8, 12, 120), T('alzate-lat', 3, 12, 15, 75), T('push-down', 3, 10, 12, 75), T('tric-sopra', 3, 10, 12, 75)] },
        { n: 'Pull', ex: [T('trazioni', 4, 6, 10, 150), T('rematore-bil', 3, 8, 10, 120), T('lat-stretta', 3, 10, 12, 90), T('face-pull', 3, 12, 15, 60), T('curl-bil', 3, 8, 12, 75), T('curl-martello', 3, 10, 12, 75)] },
        { n: 'Legs', ex: [T('squat', 4, 6, 8, 180), T('stacco-rum', 3, 8, 10, 150), T('pressa', 3, 10, 12, 120), T('leg-curl', 3, 10, 12, 90), T('calf-piedi', 4, 10, 15, 60), T('crunch-cavi', 3, 12, 15, 60)] }
      ]
    },
    {
      id: 'ul4', n: 'Upper / Lower 4 giorni', d: 'Parte alta e parte bassa, due volte a settimana',
      days: [
        { n: 'Upper A', ex: [T('panca', 4, 6, 8, 150), T('rematore-bil', 4, 6, 8, 150), T('shoulder-press', 3, 8, 10, 120), T('lat', 3, 10, 12, 90), T('curl-man', 2, 10, 12, 75), T('push-down', 2, 10, 12, 75)] },
        { n: 'Lower A', ex: [T('squat', 4, 6, 8, 180), T('stacco-rum', 3, 8, 10, 150), T('pressa', 3, 10, 12, 120), T('leg-curl', 3, 10, 12, 90), T('calf-piedi', 4, 10, 15, 60)] },
        { n: 'Upper B', ex: [T('panca-inc-man', 4, 8, 10, 120), T('trazioni', 4, 6, 10, 150), T('alzate-lat', 3, 12, 15, 75), T('pulley', 3, 10, 12, 90), T('curl-martello', 3, 10, 12, 75), T('french', 3, 10, 12, 75)] },
        { n: 'Lower B', ex: [T('stacco', 3, 5, 6, 180), T('bulgaro', 3, 8, 10, 120), T('leg-ext', 3, 12, 15, 75), T('hip-thrust', 3, 8, 12, 120), T('calf-seduto', 4, 12, 15, 60)] }
      ]
    },
    {
      id: 'fb3', n: 'Full body 3 giorni', d: 'Tutto il corpo, ideale per iniziare',
      days: [
        { n: 'Full body A', ex: [T('squat', 3, 6, 8, 150), T('panca', 3, 6, 8, 150), T('rematore-bil', 3, 8, 10, 120), T('alzate-lat', 2, 12, 15, 60), T('plank', 2, 30, 60, 60)] },
        { n: 'Full body B', ex: [T('stacco-rum', 3, 6, 8, 150), T('shoulder-press', 3, 8, 10, 120), T('lat', 3, 8, 12, 90), T('affondi', 3, 10, 12, 90), T('curl-man', 2, 10, 12, 60)] },
        { n: 'Full body C', ex: [T('pressa', 3, 8, 12, 120), T('panca-inc-man', 3, 8, 10, 120), T('pulley', 3, 10, 12, 90), T('hip-thrust', 3, 8, 12, 120), T('push-down', 2, 10, 12, 60)] }
      ]
    },
    {
      id: 's5', n: 'Split 5 giorni', d: 'Un gruppo muscolare principale al giorno',
      days: [
        { n: 'Petto', ex: [T('panca', 4, 6, 8, 150), T('panca-inc-man', 3, 8, 10, 120), T('croci-cavi', 3, 12, 15, 75), T('dip', 3, 8, 12, 90)] },
        { n: 'Dorso', ex: [T('trazioni', 4, 6, 10, 150), T('rematore-bil', 3, 8, 10, 120), T('lat-stretta', 3, 10, 12, 90), T('pulley', 3, 10, 12, 90), T('shrug', 3, 10, 12, 75)] },
        { n: 'Gambe', ex: [T('squat', 4, 6, 8, 180), T('stacco-rum', 3, 8, 10, 150), T('pressa', 3, 10, 12, 120), T('leg-curl', 3, 10, 12, 90), T('calf-piedi', 4, 10, 15, 60)] },
        { n: 'Spalle', ex: [T('lento', 4, 6, 8, 150), T('alzate-lat', 4, 12, 15, 60), T('alzate-post', 3, 12, 15, 60), T('face-pull', 3, 12, 15, 60), T('crunch', 3, 12, 20, 60)] },
        { n: 'Braccia', ex: [T('curl-bil', 3, 8, 12, 75), T('panca-presa-stretta', 3, 8, 10, 90), T('curl-martello', 3, 10, 12, 75), T('french', 3, 10, 12, 75), T('curl-cavi', 2, 12, 15, 60), T('push-down', 2, 12, 15, 60)] }
      ]
    }
  ];

  /* Messaggi rapidi predefiniti */
  const DEFAULT_MSGS = [
    'Mi serve aiuto per una serie: {esercizio}, serie {serie} ({kg} kg × {reps}) 🙏',
    'Vieni a farmi da spotter? 💪',
    'Ho finito l\'allenamento! 🔥',
    'Nuovo record su {esercizio}: {kg} kg × {reps} 🏆',
    'Hai bevuto? Io sono a {acqua} 💧',
    'Cosa mangiamo stasera? Mi mancano {proteine_mancanti} g di proteine',
    'Ho preso gli integratori ✅'
  ];

  /* Promemoria: voci predefinite (everyH = ogni N ore tra from e to; days: 0=lun..6=dom, 'train' = giorni di allenamento) */
  const ALLD = [0, 1, 2, 3, 4, 5, 6];
  const REMINDER_PRESETS = [
    { key: 'acqua', title: 'Acqua', emoji: '💧', everyH: 2, from: '09:00', to: '21:00', days: ALLD, note: 'Bevi un bicchiere d\'acqua' },
    { key: 'creatina', title: 'Creatina', emoji: '💊', time: '09:00', days: ALLD, note: '3–5 g di creatina monoidrato' },
    { key: 'multivit', title: 'Multivitaminico', emoji: '🟡', time: '08:30', days: ALLD, note: 'Prendi il multivitaminico a colazione' },
    { key: 'allenamento', title: 'Allenamento', emoji: '🏋️', time: '18:00', days: 'train', note: 'Apri Stride e inizia la sessione' },
    { key: 'pesata', title: 'Pesata mattutina', emoji: '⚖️', time: '08:00', days: ALLD, note: 'Al mattino, dopo il bagno, a digiuno' },
    { key: 'integratori', title: 'Integratori sera', emoji: '✅', time: '21:30', days: ALLD, note: 'Spunta gli integratori in Stride' },
    { key: 'backup', title: 'Backup settimanale', emoji: '💾', time: '20:00', days: [6], note: 'Altro → Backup → Esporta' }
  ];
  const DAYS_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  const ICS_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

  const MEALS = [['colazione', 'Colazione'], ['pranzo', 'Pranzo'], ['cena', 'Cena'], ['spuntini', 'Spuntini']];
  const ACTIVITY = [
    [1.2, 'Sedentario (poco movimento)'],
    [1.375, 'Leggero (1–3 allenamenti)'],
    [1.55, 'Moderato (3–5 allenamenti)'],
    [1.725, 'Attivo (6–7 allenamenti)'],
    [1.9, 'Molto attivo (lavoro fisico + allenamento)']
  ];
  const GOALS = { massa: 'Aumentare massa', definizione: 'Definizione', ricomposizione: 'Ricomposizione', mantenimento: 'Mantenimento' };

  /* unità di un integratore per la visualizzazione: "1 capsula", "2 capsule" (il valore salvato resta «capsule») */
  function unitLbl(dose, unit) {
    if (unit === 'capsule' || unit === 'capsula') return +String(dose == null ? '' : dose).replace(',', '.') === 1 ? 'capsula' : 'capsule';
    return unit || '';
  }

  window.D = {
    NUTR, NMAP, GROUPS, MICRO_KEYS, rda, VEG_RE, MUSCLES, EQUIP, EXERCISES, LABS, LABMAP, SUPP_INFO, ANTI, ANTI_LVL,
    TEMPLATES, DEFAULT_MSGS, REMINDER_PRESETS, DAYS_IT, ICS_DAYS, MEALS, ACTIVITY, GOALS, unitLbl
  };
})();
