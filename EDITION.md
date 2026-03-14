# Guide d'édition — La cuisine de Benoît

## Scripts

```bash
npm run dev          # Serveur local  http://localhost:4321
npm run build        # Build de production
npm run preview      # Prévisualiser le build

npm run new-recette  # Assistant CLI → crée src/content/recettes/<slug>/index.md
npm run new-pain     # Assistant CLI → crée src/content/pain/YYYY-MM-DD.md
```

---

## Recettes

**Emplacement :** `src/content/recettes/<slug>/index.md`
**Images :** `public/images/recettes/<slug>/plat.jpg` (et autres)

### Toutes les clés

```yaml
---
# OBLIGATOIRES
title: "Titre de la recette"
date: 2026-03-14               # date de création (YYYY-MM-DD)
description: "Courte description pour les cards et le SEO."
categories: ["plat principal"] # affiché dans les filtres
tags: ["rapide", "hiver"]      # mots-clés libres
difficulte: facile             # facile | moyen | difficile
temps_prep: 15                 # minutes
temps_cuisson: 30              # minutes
vegetarien: false
ingredients:
  - nom: "Oignons"
    quantite: 2
    unite: "pièces"
etapes:
  - "Faire revenir les oignons."
  - "Ajouter le bouillon."

# OPTIONNELS
portions_base: 4               # défaut: 4 — base du calculateur de portions
vegan: false                   # seulement si vegetarien: true
image: "/images/recettes/slug/plat.jpg"

astuces:
  - "Peut se faire la veille."

inspirations:
  - url: "https://..."
    label: "Nom de la source"   # label optionnel

# Archivage — pour garder l'historique d'une recette améliorée
archive_de: "nom-de-la-recette-originale"  # slug de la recette dont celle-ci est l'archive
archive_note: "Version initiale avant ajout du citron."

# Changelog — tracer les évolutions d'une recette
changelog:
  - date: 2026-03-14
    note: "Réduit le sel de 12 g à 10 g."
  - date: 2026-02-01
    note: "Ajout de paprika fumé."
---

## Avis

Notes libres en Markdown sous le frontmatter.
```

### Ingrédient — toutes les options

```yaml
ingredients:
  - nom: "Farine"
    quantite: 200
    unite: "g"
    note: "T65 de préférence"      # affiché en italique
    interchangeable: true          # signale que l'ingrédient est substituable
```

### Archiver une recette (quand tu l'améliores)

1. Copier le fichier original dans un sous-dossier : `<slug>/archives/YYYY-MM-DD.md`
2. Dans l'archive, ajouter `archive_de: "<slug>"` → elle n'apparaît pas dans la liste principale
3. Mettre à jour le fichier `index.md` avec les modifications + entrée `changelog`

---

## Pain

**Emplacement :** `src/content/pain/YYYY-MM-DD.md`
**Images :** `public/images/pain/YYYY-MM-DD-01.jpg`, `-02.jpg`, etc.

### Toutes les clés

```yaml
---
# OBLIGATOIRES
date: 2026-03-14
farine_principale: "T65"   # farine de base, base du calcul d'hydratation
farine_g: 400              # poids de la farine principale (g)
eau_g: 320                 # eau totale (g)
sel_g: 10                  # sel (g)
levure: "levain"           # levain | levure sèche | levure fraîche
note: 4                    # 1 à 5
avis: "Bonne mie, croûte un peu pâle."

# OPTIONNELS
titre: "Miche du dimanche"

farines_secondaires:        # 1 à N farines secondaires avec leur poids
  - type: "Seigle"
    g: 50
  - type: "Benedictine"
    g: 50

levure_g: 4                # poids de la levure/levain (g)
poids_g: 820               # poids du pain sorti du four (sert au calculateur)
autres: "30 g de graines de tournesol"

photos:
  - "/images/pain/2026-03-14-01.jpg"
  - "/images/pain/2026-03-14-02.jpg"
---
```

### Notes sur les calculs

- **Hydratation** = `eau_g / (farine_g + Σ farines_secondaires)` × 100
- **Calculateur de poids** dans la modale : utilise `poids_g` comme cible de départ (sinon somme théorique)
- Les **%** dans le tableau de la modale sont rapportés à la farine totale

---

## Images

| Section  | Dossier                             | Convention de nommage         |
|----------|-------------------------------------|-------------------------------|
| Recettes | `public/images/recettes/<slug>/`    | `plat.jpg`, `etape1.jpg`, … |
| Pain     | `public/images/pain/`               | `YYYY-MM-DD-01.jpg`, `-02.jpg` |

Format recommandé : **JPEG**, largeur ≥ 800 px, < 500 Ko.
