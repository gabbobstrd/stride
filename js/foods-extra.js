/* Alimenti aggiunti a mano (valori per 100 g, medie da etichetta). Si aggiungono a window.FOODS dopo foods.js */
(function (g) {
  'use strict';
  if (!g.FOODS) g.FOODS = [];
  [
    { id: 'x-fette-biscottate', n: 'Fette biscottate', cat: 'Cereali', src: 'valori medi da etichetta', v: { kcal: 410, prot: 11, carb: 75, fat: 6, fib: 3.5, na: 600 } },
    { id: 'x-whey', n: 'Proteine whey in polvere', cat: 'Latticini', src: 'valori medi da etichetta', v: { kcal: 380, prot: 78, carb: 6, fat: 5 } }
  ].forEach(f => { if (!g.FOODS.some(x => x.id === f.id)) g.FOODS.push(f); });
})(typeof window !== 'undefined' ? window : globalThis);
