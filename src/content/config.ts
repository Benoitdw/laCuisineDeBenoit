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

export const collections = { recettes };
