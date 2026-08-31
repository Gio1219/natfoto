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

async function getOrCreateSubFolder(parentFolderId: string, folderName: string) {
  const sanitizedName = folderName.trim().replace(/'/g, "\\'");
  const query = `'${parentFolderId}' in parents and name = '${sanitizedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  
  const search = await drive.files.list({ q: query, fields: 'files(id, name)' });

  if (search.data.files && search.data.files.length > 0) {
    return search.data.files[0].id!;
  }

  try {
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    };
    const create = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });
    return create.data.id!;
  } catch (err: any) {
    // Gestione della concorrenza in caso di richieste multiple parallele
    const retrySearch = await drive.files.list({ q: query, fields: 'files(id, name)' });
    if (retrySearch.data.files && retrySearch.data.files.length > 0) {
      return retrySearch.data.files[0].id!;
    }
    throw err;
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const studentName = formData.get('studentName') as string;
    const courseName = formData.get('courseName') as string;

    if (!file || !studentName || !courseName) {
      return NextResponse.json({ error: 'File, nome allievo o corso mancanti' }, { status: 400 });
    }

    const mainFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!mainFolderId) {
      return NextResponse.json({ error: 'Cartella principale Google Drive non configurata' }, { status: 500 });
    }

    // 1. Trova o crea la cartella dell'allievo dentro la principale
    const studentFolderId = await getOrCreateSubFolder(mainFolderId, studentName);
    
    // 2. Trova o crea la sottocartella del corso specifico dentro quella dell'allievo
    const courseFolderId = await getOrCreateSubFolder(studentFolderId, courseName);

    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const fileMetadata = {
      name: `${Date.now()}-${file.name.replace(/\s+/g, '_')}`,
      parents: [courseFolderId],
    };

    const media = {
      mimeType: file.type || 'image/jpeg',
      body: stream,
    };

    const uploadResponse = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id',
    });

    const fileId = uploadResponse.data.id!;

    // Rendi il file accessibile pubblicamente per l'anteprima rapida
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    const publicUrl = `https://lh3.googleusercontent.com/d/${fileId}`;

    return NextResponse.json({
      success: true,
      fileUrl: publicUrl,
    });
  } catch (error: any) {
    console.error('Errore upload Google Drive OAuth:', error);
    return NextResponse.json({ error: error.message || 'Errore interno' }, { status: 500 });
  }
}