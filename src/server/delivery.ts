import * as fs from 'fs';
import * as path from 'path';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { Episode, DeliveryConfig } from '../types.js';

export class DeliveryService {
  /**
   * Helper internal untuk menginisialisasi Google Drive Client via OAuth2
   */
  private static getDriveClient(delivery: DeliveryConfig) {
    const clientId = delivery.driveClientId || process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = delivery.driveClientSecret || process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const refreshToken = delivery.driveRefreshToken || process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Kredensial Google Drive (Client ID, Client Secret, atau Refresh Token) belum dikonfigurasi.');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  /**
   * Export episode content to plain text (.txt)
   */
  public static async exportToTxt(episode: Episode, delivery: DeliveryConfig): Promise<string> {
    const outputFolder = delivery.outputFolder || path.join(process.cwd(), 'stories');
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    const filename = `Episode_${String(episode.episodeNumber).padStart(3, '0')}_${episode.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    const targetPath = path.join(outputFolder, filename);

    const fullText = `EPISODE ${episode.episodeNumber}: ${episode.title.toUpperCase()}
Generation Date: ${new Date(episode.generationDate).toLocaleString()}
Provider: ${episode.aiProvider} (${episode.modelUsed})
Word Count: ${episode.wordCount} words

================================================================================
${episode.content}

================================================================================
SUMMARY:
${episode.summary}
`;

    fs.writeFileSync(targetPath, fullText, 'utf-8');
    return targetPath;
  }

  /**
   * Export episode content to Word Document (.docx) using the 'docx' library
   */
  public static async exportToDocx(episode: Episode, delivery: DeliveryConfig): Promise<string> {
    const outputFolder = delivery.outputFolder || path.join(process.cwd(), 'stories');
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    const filename = `Episode_${String(episode.episodeNumber).padStart(3, '0')}_${episode.title.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
    const targetPath = path.join(outputFolder, filename);

    // Create a beautiful, polished docx schema
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            // Chapter Number
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 400, after: 100 },
              children: [
                new TextRun({
                  text: `EPISODE ${episode.episodeNumber}`,
                  bold: true,
                  size: 24,
                  color: '888888',
                  font: 'Georgia',
                }),
              ],
            }),
            // Title
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 600 },
              children: [
                new TextRun({
                  text: episode.title.toUpperCase(),
                  bold: true,
                  size: 40,
                  color: '111111',
                  font: 'Georgia',
                }),
              ],
            }),
            // Metadata Block
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 800 },
              children: [
                new TextRun({
                  text: `Generated on ${new Date(episode.generationDate).toLocaleDateString()} | ${episode.wordCount} words`,
                  italics: true,
                  size: 18,
                  color: '666666',
                  font: 'Arial',
                }),
              ],
            }),
            // Divider
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 800 },
              children: [
                new TextRun({
                  text: '*   *   *',
                  bold: true,
                  size: 24,
                  color: '444444',
                }),
              ],
            }),
            // Body Paragraphs
            ...episode.content.split('\n\n').map(para => {
              return new Paragraph({
                spacing: { before: 120, after: 120, line: 360 }, // 1.5 Line Spacing
                alignment: AlignmentType.LEFT,
                indent: { firstLine: 720 }, // Classic narrative paragraph indent
                children: [
                  new TextRun({
                    text: para.trim(),
                    size: 24, // 12pt font
                    color: '222222',
                    font: 'Georgia',
                  }),
                ],
              });
            }),
            // End Indicator
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 1000, after: 100 },
              children: [
                new TextRun({
                  text: '— THE END —',
                  bold: true,
                  size: 18,
                  color: '555555',
                  font: 'Georgia',
                }),
              ],
            }),
          ],
        },
      ],
    });

    // Save Docx to disk
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(targetPath, buffer);
    return targetPath;
  }

  /**
   * Deliver files via SMTP Email attachment
   */
  public static async sendEmailDelivery(
    episode: Episode, 
    delivery: DeliveryConfig, 
    attachmentPaths: string[]
  ): Promise<{ success: boolean; logMessage: string }> {
    
    const smtpHost = delivery.smtpHost || process.env.SMTP_HOST;
    const smtpPort = Number(delivery.smtpPort || process.env.SMTP_PORT || 587);
    const smtpUser = delivery.smtpUser || process.env.SMTP_USER;
    const smtpPass = delivery.smtpPass || process.env.SMTP_PASS;
    const smtpFrom = delivery.smtpFrom || process.env.SMTP_FROM || smtpUser;
    const smtpTo = delivery.smtpTo || process.env.DEFAULT_RECIPIENT;

    if (!smtpHost || !smtpUser || !smtpPass || !smtpTo) {
      return {
        success: false,
        logMessage: 'SMTP Settings are incomplete. Skipping email delivery.'
      };
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass
        },
        tls: { rejectUnauthorized: false }
      });

      const attachments = attachmentPaths
        .filter(p => fs.existsSync(p))
        .map(p => ({
          filename: path.basename(p),
          path: p
        }));

      const mailOptions = {
        from: smtpFrom,
        to: smtpTo,
        subject: `[FASTORY STORY ENGINE] Episode #${episode.episodeNumber}: ${episode.title}`,
        text: `Greetings Story Architect,

Your automated Story Production Engine has compiled a brand new chapter!

Details:
---------------------------------------------
- Episode Number: #${episode.episodeNumber}
- Episode Title: ${episode.title}
- Generation Date: ${new Date(episode.generationDate).toLocaleString()}
- Word Count: ${episode.wordCount} words
- AI Engine: ${episode.aiProvider} (${episode.modelUsed})

Summary:
---------------------------------------------
${episode.summary}

The formatted DOCX and TXT files are attached to this message.

Stay creative,
Fastory Story Engine
`,
        attachments
      };

      await transporter.sendMail(mailOptions);
      return {
        success: true,
        logMessage: `Email successfully sent to ${smtpTo} with ${attachments.length} attachments.`
      };
    } catch (e: any) {
      console.error('SMTP Email failed:', e);
      return {
        success: false,
        logMessage: `SMTP Email delivery failed: ${e.message || e}`
      };
    }
  }

  /**
   * Deliver files directly to Google Drive (Upload Nyata via Google Drive API v3)
   */
  public static async uploadToGoogleDrive(
    episode: Episode, 
    delivery: DeliveryConfig, 
    filePath: string
  ): Promise<{ success: boolean; logMessage: string; webContentLink?: string }> {
    
    const filename = path.basename(filePath);

    try {
      // 1. Simpan salinan lokal ke folder backup sebagai protokol keamanan
      const backupFolder = delivery.backupFolder || path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupFolder)) {
        fs.mkdirSync(backupFolder, { recursive: true });
      }
      const backupPath = path.join(backupFolder, filename);
      fs.copyFileSync(filePath, backupPath);

      // 2. Inisialisasi Google Drive API Client
      const drive = this.getDriveClient(delivery);
      const folderId = delivery.driveFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

      const ext = path.extname(filePath).toLowerCase();
      const mimeType = ext === '.docx' 
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
        : 'text/plain';

      const fileMetadata: any = {
        name: filename
      };

      // Tentukan target folder jika diisi
      if (folderId && folderId.trim() !== '' && folderId !== 'root') {
        fileMetadata.parents = [folderId];
      }

      const media = {
        mimeType,
        body: fs.createReadStream(filePath)
      };

      // 3. Eksekusi pengunggahan ke Google Drive
      const response = await drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id, name, webViewLink'
      });

      const fileId = response.data.id || '';
      const webViewLink = response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

      return {
        success: true,
        logMessage: `File ${filename} berhasil diunggah ke Google Drive (ID: ${fileId}). Backup lokal tersimpan di /backups.`,
        webContentLink: webViewLink
      };

    } catch (e: any) {
      console.error('Google Drive Upload failed:', e);
      return {
        success: false,
        logMessage: `Google Drive Upload failed: ${e.message || e}`
      };
    }
  }
}