import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { email, name, surname, password } = await request.json();

    if (!email || !name || !surname) {
      return NextResponse.json(
        { error: "Dati obbligatori mancanti (email, nome, cognome)." },
        { status: 400 }
      );
    }

    // Template HTML personalizzato con stile grafico N.A.T.
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #030712; color: #f8fafc; margin: 0; padding: 40px 0; }
            .container { max-width: 600px; margin: 0 auto; background: linear-gradient(to bottom, #0f172a, #020617); border: 1px solid rgba(201, 176, 116, 0.2); border-radius: 24px; padding: 40px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
            .header { text-align: center; margin-bottom: 32px; }
            .title { color: #c9b074; font-size: 26px; font-weight: normal; margin-bottom: 8px; font-family: Georgia, serif; letter-spacing: 0.05em; }
            .subtitle { color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 0.2em; }
            .card { background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 24px; margin: 24px 0; }
            .info-row { margin-bottom: 16px; font-size: 14px; color: #cbd5e1; }
            .info-row:last-child { margin-bottom: 0; }
            .label { color: #c9b074; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.15em; display: block; margin-bottom: 4px; }
            .value { font-size: 16px; color: #ffffff; font-family: monospace; }
            .footer { text-align: center; margin-top: 32px; font-size: 11px; color: #64748b; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="title">Nuova Accademia Toscanini</h1>
              <p class="subtitle">Galleria Fotografica Ufficiale</p>
            </div>
            
            <p style="color: #e2e8f0; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
              Gentile <strong>${name} ${surname}</strong>, grazie per aver effettuatto il tuo primo accesso! Di seguito trovi riepilogate le tue credenziali di accesso per consultare e scaricare le foto dei saggi e dei corsi.
            </p>

            <div class="card">
              <div class="info-row">
                <span class="label">Allievo</span>
                <span class="value">${name} ${surname}</span>
              </div>
              <div class="info-row">
                <span class="label">Email di Riferimento</span>
                <span class="value">${email}</span>
              </div>
              ${password ? `
              <div class="info-row">
                <span class="label">Password di Accesso</span>
                <span class="value" style="color: #c9b074; font-weight: bold; font-size: 17px;">${password}</span>
              </div>
              ` : ''}
            </div>

            <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; text-align: center; margin-top: 24px;">
              Conserva con cura queste informazioni. Puoi effettuare il login in qualsiasi momento direttamente dalla piattaforma ufficiale.
            </p>

            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Nuova Accademia Toscanini. Tutti i diritti riservati.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Invio tramite Resend
    const data = await resend.emails.send({
      from: "Nuova Accademia Toscanini <onboarding@resend.dev>", // Sostituire con il dominio verificato in produzione (es. segreteria@tuodominio.it)
      to: [email],
      subject: "Credenziali di Accesso - Galleria Saggi N.A.T.",
      html: htmlContent,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Errore invio email:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}