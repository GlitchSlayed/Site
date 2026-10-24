import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
const common = { title:z.string(), description:z.string(), date:z.coerce.date(), tags:z.array(z.string()), draft:z.boolean().default(false), sample:z.boolean().default(false), featured:z.boolean().default(false) };
export const collections = {
 writing: defineCollection({loader:glob({pattern:'**/*.{md,mdx}',base:'./src/content/writing'}),schema:z.object(common)}),
 projects: defineCollection({loader:glob({pattern:'**/*.{md,mdx}',base:'./src/content/projects'}),schema:z.object({...common,status:z.string(),art:z.enum(['wing','orbit','code'])})})
};
