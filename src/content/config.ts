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
      quantite: z.number(),
      unite: z.string(),
      note: z.string().optional(),
      variante: z.boolean().default(false),
    })),
    etapes: z.array(z.string()),
  }),
});

export const collections = { recettes };
