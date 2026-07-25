import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email?.trim() ?? "";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Validazione email sul server
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Inserisci un indirizzo email valido." },
        { status: 400 }
      );
    }

    // 1. Cerca lo studente nel database
    const { data: student, error: fetchError } = await supabase
      .from("students")
      .select("*")
      .ilike("email", email)
      .single();

    if (fetchError || !student) {
      return NextResponse.json(
        { error: "Nessun allievo associato a questo indirizzo email." },
        { status: 404 }
      );
    }

    // 2. Genera una nuova password provvisoria
    const randomNums = Math.floor(Math.random() * 900 + 100);
    const letters = "abcdefghjkmnpqrstuvwxyz"; 
    const randomLets = letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)];
    const newTempPassword = `${student.name.toLowerCase().trim()}.${student.surname.toLowerCase().trim()}.${randomNums}${randomLets}`;

    // 3. Aggiorna il database
    const { error: updateError } = await supabase
      .from("students")
      .update({ 
        password: newTempPassword, 
        has_changed_password: false 
      })
      .eq("id", student.id);

    if (updateError) {
      throw new Error("Errore durante l'aggiornamento della password nel database.");
    }

    // 4. Invia l'email con Resend
    const { error: sendError } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: [email],
      subject: "Recupero Password - Galleria Privata N.A.T.",
      html: `
        <div style="font-family: sans-serif; background-color: #000; color: #fff; padding: 30px; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 25px;">
            <img src="https://nat-foto.vercel.app/logo.png" alt="Nuova Accademia Toscanini" width="130" style="display: block; margin: 0 auto;" />
          </div>
          <p>Ciao <strong>${student.name}</strong>,</p>
          <p>Hai richiesto il recupero della password per accedere alla tua galleria privata.</p>
          <p>La tua nuova <strong>password provvisoria</strong> è:</p>
          <div style="background: #1a1a1a; padding: 15px; border: 1px solid #333; border-radius: 8px; font-family: monospace; font-size: 16px; color: #c9b074; margin: 20px 0; text-align: center;">
            ${newTempPassword}
          </div>
          <p>Accedi al sito inserendo il tuo nome, cognome e questa password provvisoria. Ti verrà chiesto di impostare una nuova password definitiva.</p>
          <p style="color: #888; font-size: 12px; margin-top: 30px;">Se non hai richiesto tu il recupero, puoi ignorare questa email.</p>
        </div>
      `,
    });

    if (sendError) {
      throw new Error(sendError.message);
    }

    return NextResponse.json({ success: true, message: "Email inviata con successo!" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Errore interno del server." },
      { status: 500 }
    );
  }
}