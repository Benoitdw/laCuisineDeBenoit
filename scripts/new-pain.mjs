#!/usr/bin/env node
/**
 * Script pour créer une nouvelle entrée de fournée
 * Usage: node scripts/new-pain.mjs
 */

import { createInterface } from 'readline';
import { writeFileSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const rl = createInterface({ input: process.stdin, output: process.stdout });

const ask = (question, defaultVal) =>
  new Promise((resolve) => {
    const hint = defaultVal !== undefined ? ` [${defaultVal}]` : '';
    rl.question(`${question}${hint}: `, (ans) => {
      resolve(ans.trim() || defaultVal || '');
    });
  });

async function main() {
  console.log('\n=== Nouvelle fournée ===\n');

  const today = new Date().toISOString().split('T')[0];
  const date = await ask('Date', today);

  const titre = await ask('Titre (optionnel)', '');
  const farine_principale = await ask('Farine principale', 'T65');
  const farine_g = await ask('Farine principale (g)', '500');

  // Farines secondaires
  const farines_secondaires = [];
  console.log('Farines secondaires (ligne vide pour terminer) :');
  while (true) {
    const type = await ask('  Type (ex: Seigle)', '');
    if (!type) break;
    const g = await ask(`  ${type} (g)`, '');
    if (g) farines_secondaires.push({ type, g: Number(g) });
  }

  const farine_totale = Number(farine_g) + farines_secondaires.reduce((s, f) => s + f.g, 0);
  const eau_g = await ask('Eau (g)', '375');

  const hydrat = ((Number(eau_g) / farine_totale) * 100).toFixed(1);
  console.log(`  → Hydratation : ${hydrat} %`);

  const sel_g = await ask('Sel (g)', '10');
  const levure = await ask('Levure (levain / levure sèche / levure fraîche)', 'levain');
  const levure_g = await ask('Levure (g, optionnel)', '');
  const poids_g = await ask('Poids du pain sorti du four (g, optionnel)', '');
  const autres = await ask('Autres ingrédients (optionnel)', '');

  // Preset chrono
  const presetsDir = join(new URL('.', import.meta.url).pathname, '../src/data/presets');
  let presetId = '';
  try {
    const files = readdirSync(presetsDir).filter(f => f.endsWith('.json'));
    const presets = files.map(f => JSON.parse(readFileSync(join(presetsDir, f), 'utf-8')));
    if (presets.length > 0) {
      console.log('\nPreset chrono (pour le minuteur de fournée) :');
      presets.forEach((p, i) => console.log(`  ${i + 1}. ${p.label} (${p.id})`));
      console.log('  0. Aucun');
      const choix = await ask('Choix', '0');
      const idx = Number(choix) - 1;
      if (idx >= 0 && idx < presets.length) presetId = presets[idx].id;
    }
  } catch { /* presets dir absent, on ignore */ }
  const note = await ask('Note (1-5)', '3');
  const avis = await ask('Avis', 'TODO');

  // Validation
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    console.error(`Date invalide : ${date} (format attendu : YYYY-MM-DD)`);
    rl.close();
    process.exit(1);
  }

  const noteNum = Number(note);
  if (isNaN(noteNum) || noteNum < 1 || noteNum > 5) {
    console.error('La note doit être un entier entre 1 et 5.');
    rl.close();
    process.exit(1);
  }

  const dest = join(
    new URL('.', import.meta.url).pathname,
    '../src/content/pain',
    `${date}.md`
  );

  if (existsSync(dest)) {
    const overwrite = await ask(`Le fichier "${date}.md" existe déjà. Écraser ? (o/n)`, 'n');
    if (overwrite !== 'o') {
      console.log('Annulé.');
      rl.close();
      return;
    }
  }

  const lines = ['---'];
  lines.push(`date: ${date}`);
  if (titre) lines.push(`titre: "${titre}"`);
  lines.push(`farine_principale: "${farine_principale}"`);
  lines.push(`farine_g: ${Number(farine_g)}`);
  if (farines_secondaires.length > 0) {
    lines.push('farines_secondaires:');
    for (const f of farines_secondaires) {
      lines.push(`  - type: "${f.type}"`);
      lines.push(`    g: ${f.g}`);
    }
  }
  lines.push(`eau_g: ${Number(eau_g)}`);
  lines.push(`sel_g: ${Number(sel_g)}`);
  lines.push(`levure: "${levure}"`);
  if (levure_g) lines.push(`levure_g: ${Number(levure_g)}`);
  if (poids_g) lines.push(`poids_g: ${Number(poids_g)}`);
  if (autres) lines.push(`autres: "${autres}"`);
  if (presetId) lines.push(`preset: "${presetId}"`);
  lines.push(`note: ${noteNum}`);
  lines.push(`avis: "${avis}"`);
  lines.push('---');
  lines.push('');

  writeFileSync(dest, lines.join('\n'));

  console.log(`\nFournée créée : src/content/pain/${date}.md`);
  console.log(`Hydratation : ${hydrat} %`);
  if (poids_g) {
    const base = farine_totale + Number(eau_g) + Number(sel_g) + (levure_g ? Number(levure_g) : 0);
    console.log(`Facteur réel : ×${(Number(poids_g) / base).toFixed(2)} (poids réel vs poids théorique)\n`);
  }
  console.log(`N'oublie pas d'ajouter tes photos dans public/images/pain/ si besoin.\n`);

  rl.close();
}

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});
