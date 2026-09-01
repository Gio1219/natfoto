import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('id');

  if (!fileId) {
    return NextResponse.json({ error: 'ID file mancante' }, { status: 400 });
  }

  try {
    const response = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    const headers = new Headers();
    headers.set('Content-Type', 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    return new NextResponse(response.data as any, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('Errore proxy immagine Drive:', error);
    return NextResponse.json({ error: 'Impossibile caricare l\'immagine' }, { status: 500 });
  }
}