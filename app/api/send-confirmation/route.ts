import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { name, surname, email } = await request.json();

    if (!email) {
      return NextResponse.json({ success: true, message: 'Nessuna email registrata per lo studente.' });
    }

    await resend.emails.send({
      from: 'Nuova Accademia Toscanini <no-reply@accademiatoscanini.it>',
      to: email,
      subject: 'Conferma attivazione account - Nuova Accademia Toscanini',
      html: `
        <div style="font-family: sans-serif; background-color: #020617; color: #f8fafc; padding: 32px; border-radius: 12px;">
          <h2 style="color: #fbbf24; font-family: serif;">Nuova Accademia Toscanini</h2>
          <p>Gentile <strong>${name} ${surname}</strong>,</p>
          <p>Ti confermiamo che il tuo primo accesso alla piattaforma delle gallerie e dei recital è stato completato con successo e la tua password personale è stata aggiornata.</p>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">Per motivi di sicurezza, la tua password non è inclusa in questa comunicazione.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Errore API email:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}