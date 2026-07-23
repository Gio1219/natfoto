import { z } from "zod";

export const recoverySchema = z.object({
  email: z
    .string()
    .min(1, { message: "L'indirizzo email è obbligatorio." })
    .email({ message: "Inserisci un indirizzo email valido (es. nome@dominio.it)." }),
});

export type RecoveryInput = z.infer<typeof recoverySchema>;