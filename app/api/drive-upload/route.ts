import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const studentName = formData.get('studentName') as string;
    const courseName = formData.get('courseName') as string;

    if (!file || !studentName || !courseName) {
      return NextResponse.json({ error: 'File, nome allievo o sezione mancanti' }, { status: 400 });
    }

    const mainFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!mainFolderId) {
      return NextResponse.json({ error: 'Cartella principale Google Drive non configurata' }, { status: 500 });
    }

    // Test rapido di scrittura diretta nella cartella principale per isolare il problema
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const stream = Readable.from(buffer);

    const uploadResponse = await drive.files.create({
      requestBody: {
        name: `${Date.now()}-${file.name.replace(/\s+/g, '_')}`,
        parents: [mainFolderId],
      },
      media: {
        mimeType: file.type || 'image/jpeg',
        body: stream,
      },
      fields: 'id',
    });

    const fileId = uploadResponse.data.id!;
    const proxyUrl = `/api/drive-image?id=${fileId}`;

    return NextResponse.json({
      success: true,
      fileUrl: proxyUrl,
    });
  } catch (error: any) {
    console.error('ERRORE CRITICO DRIVE:', error);
    return NextResponse.json({ error: error?.message || 'Errore sconosciuto' }, { status: 500 });
  }
}