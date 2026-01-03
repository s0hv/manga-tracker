import z from 'zod';

export const DatabaseIdSchema = z.union([z.string(), z.int()]);
