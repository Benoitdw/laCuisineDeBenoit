#!/usr/bin/env node
/**
 * Script pour créer une nouvelle recette
 * Usage: node scripts/new-recette.mjs
 */

import { createInterface } from "readline";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const rl = createInterface({ input: process.stdin, output: process.stdout });

const ask = (question, defaultVal) =>
  new Promise((resolve) => {
    const hint = defaultVal !== undefined ? ` [${defaultVal}]` : "";
    rl.question(`${question}${hint}: `, (ans) => {
      resolve(ans.trim() || defaultVal || "");
    });
  });

const askList = async (label) => {
  console.log(`${label} (ligne vide pour terminer)`);
  const items = [];
  while (true) {
    const item = await ask(`  - `);
    if (!item) break;
    items.push(item);
  }
  return items;
};

const toSlug = (str) =>
  str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function main() {
  console.log("\n=== Nouvelle recette ===\n");

  const title = await ask("Titre");
  if (!title) {
    console.error("Le titre est obligatoire.");
    rl.close();
    process.exit(1);
  }

  const slug = toSlug(title);
  const date = new Date().toISOString().split("T")[0];

  const description = await ask("Description", "TODO");
  const categoriesRaw = await ask(
    "Catégories (séparées par virgule)",
    "plat principal"
  );
  const categories = categoriesRaw.split(",").map((c) => c.trim());
  const tagsRaw = await ask("Tags (séparés par virgule)", "");
  const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()) : [];

  const difficulte = await ask("Difficulté (facile/moyen/difficile)", "moyen");
  const temps_prep = await ask("Temps de préparation (minutes)", "15");
  const temps_cuisson = await ask("Temps de cuisson (minutes)", "30");
  const portions_base = await ask("Portions", "4");
  const vegetarien = (await ask("Végétarien ? (o/n)", "n")) === "o";
  const vegan = vegetarien
    ? (await ask("Vegan ? (o/n)", "n")) === "o"
    : false;

  console.log("\n--- Ingrédients ---");
  const ingredients = [];
  while (true) {
    const nom = await ask("Nom de l'ingrédient (vide pour terminer)");
    if (!nom) break;
    const quantite = await ask("  Quantité", "0");
    const unite = await ask("  Unité (gr, ml, etc.)", "");
    const note = await ask("  Note (optionnel)", "");
    const interchangeable = (await ask("  Interchangeable ? (o/n)", "n")) === "o";
    const entry = { nom, quantite: Number(quantite), unite };
    if (note) entry.note = note;
    if (interchangeable) entry.interchangeable = true;
    ingredients.push(entry);
  }

  console.log("\n--- Étapes ---");
  const etapes = await askList("Étapes");

  console.log("\n--- Astuces (optionnel) ---");
  const astuces = await askList("Astuces");

  const inspUrl = await ask("URL inspiration (optionnel)", "");

  // Build YAML frontmatter
  const yamlIngredients = ingredients
    .map((ing) => {
      let block = `  - nom: "${ing.nom}"\n    quantite: ${ing.quantite}\n    unite: "${ing.unite}"`;
      if (ing.note) block += `\n    note: "${ing.note}"`;
      if (ing.interchangeable) block += `\n    interchangeable: true`;
      return block;
    })
    .join("\n");

  const yamlEtapes = etapes.map((e) => `  - "${e}"`).join("\n");
  const yamlAstuces =
    astuces.length > 0
      ? `\nastuces:\n${astuces.map((a) => `  - "${a}"`).join("\n")}`
      : "";
  const yamlInspirations = inspUrl
    ? `\ninspirations:\n  - url: "${inspUrl}"`
    : "";
  const yamlVegan = vegetarien ? `\nvegan: ${vegan}` : "";

  const frontmatter = `---
title: "${title}"
date: ${date}
description: "${description}"
categories: [${categories.map((c) => `"${c}"`).join(", ")}]
tags: [${tags.map((t) => `"${t}"`).join(", ")}]
difficulte: ${difficulte}
temps_prep: ${temps_prep}
temps_cuisson: ${temps_cuisson}
portions_base: ${portions_base}
vegetarien: ${vegetarien}
image: "/images/recettes/${slug}/plat.jpg"
${yamlVegan}${yamlInspirations}
ingredients:
${yamlIngredients}

etapes:
${yamlEtapes}
${yamlAstuces}
---

## Avis

`;

  const dir = join(
    new URL(".", import.meta.url).pathname,
    "../src/content/recettes",
    slug
  );

  if (existsSync(dir)) {
    const overwrite = await ask(
      `Le dossier "${slug}" existe déjà. Écraser ? (o/n)`,
      "n"
    );
    if (overwrite !== "o") {
      console.log("Annulé.");
      rl.close();
      return;
    }
  }

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.md"), frontmatter);

  console.log(`\nRecette créée : src/content/recettes/${slug}/index.md`);
  console.log(
    `N'oublie pas d'ajouter l'image : public/images/recettes/${slug}/plat.jpg\n`
  );

  rl.close();
}

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});