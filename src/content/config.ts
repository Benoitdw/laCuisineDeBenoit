import { defineCollection, z } from 'astro:content';

const recettes = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.date(),
    description: z.string(),
    image: z.string().optional(),
    categories: z.array(z.string()),
    tags: z.array(z.string()),
    difficulte: z.enum(['facile', 'moyen', 'difficile']),
    temps_prep: z.number(),
    temps_cuisson: z.number(),
    portions_base: z.number().default(4),
    vegetarien: z.boolean().default(false),
    vegan: z.boolean().default(false),
    ingredients: z.array(z.object({
      nom: z.string(),
      quantite: z.number().optional(),
      unite: z.string().optional(),
      note: z.string().optional(),
      interchangeable: z.boolean().default(false),
    })),
    etapes: z.array(z.string()),
    astuces: z.array(z.string()).optional(),
    inspirations: z.array(z.object({
      url: z.string(),
      label: z.string().optional(),
    })).optional(),
    changelog: z.array(z.object({
      date: z.date(),
      note: z.string(),
    })).optional(),
    archive_de: z.string().optional(),
    archive_note: z.string().optional(),
  }),
});

const pain = defineCollection({
  schema: z.object({
    date: z.date(),
    titre: z.string().optional(),
    farine_principale: z.string(),
    farine_g: z.number(),
    farines_secondaires: z.array(z.object({
      type: z.string(),
      g: z.number(),
    })).optional(),
    eau_g: z.number(),
    sel_g: z.number(),
    levure: z.string(),
    levure_g: z.number().optional(),
    levain_eau_g: z.number().optional(),
    levain_farine_g: z.number().optional(),
    autres: z.string().optional(),
    poids_g: z.number().optional(),
    note: z.number().min(1).max(5),
    avis: z.string(),
    photos: z.array(z.string()).optional(),
    preset: z.string().optional(),
  }),
});

export const collections = { recettes, pain };
