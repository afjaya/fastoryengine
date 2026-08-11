import { dbInstance } from './db.js';
import { AIService } from './ai.js';
import { DeliveryService } from './delivery.js';

export class BackgroundScheduler {
  private timerId: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private lastRunDateString: string | null = null; // Prevent double trigger in the same minute

  public start() {
    if (this.timerId) {
      clearInterval(this.timerId);
    }

    dbInstance.log('INFO', 'Background scheduler daemon started.');
    
    // Check every 30 seconds for scheduled times
    this.timerId = setInterval(() => this.checkSchedule(), 30000);
  }

  public stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    dbInstance.log('INFO', 'Background scheduler daemon stopped.');
  }

  private async checkSchedule() {
    const db = dbInstance.get();
    const config = db.scheduler;

    if (!config.autoGenerate || this.isProcessing) {
      return;
    }

    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeString = `${currentHours}:${currentMinutes}`;
    const todayDateString = now.toDateString(); // e.g. "Fri Aug 07 2026"

    // Check if scheduled time matches and has not been executed today
    if (currentTimeString === config.customTime && this.lastRunDateString !== todayDateString) {
      dbInstance.log('INFO', `Scheduled trigger matched at ${currentTimeString}. Starting story generation...`);
      this.lastRunDateString = todayDateString;
      
      // Execute non-blocking pipeline
      this.runGenerationPipeline();
    }
  }

  public async runGenerationPipeline(customDirection: string = '', targetWords?: number, coverUrl?: string): Promise<boolean> {
    if (this.isProcessing) {
      dbInstance.log('WARNING', 'A story generation pipeline is already running.');
      return false;
    }

    this.isProcessing = true;
    dbInstance.log('INFO', 'Initiating Story Generation Pipeline.');

    try {
      const db = dbInstance.get();

      // Step 1: Query AI Provider
      dbInstance.log('INFO', 'Querying AI Provider to build chapter prose...');
      const result = await AIService.generateStory(db, customDirection, targetWords);
      dbInstance.log('INFO', `Successfully received story: "${result.title}" (~${result.content.split(/\s+/).length} words).`);

      // Step 2: Save to Database & Update lastSummary
      const newEpisode = dbInstance.upsertEpisode({
        title: result.title,
        content: result.content,
        summary: result.summary,
        wordCount: result.content.split(/\s+/).length,
        promptUsed: result.promptUsed,
        aiProvider: result.provider,
        modelUsed: result.model,
        status: 'Draft',
        generationDate: new Date().toISOString(),
        coverUrl: coverUrl
      });

      // Update field lastSummary di root db.json
      dbInstance.updateLastSummary(result.summary);

      dbInstance.log('INFO', `Saved Episode #${newEpisode.episodeNumber} in archive. Saving output files...`, newEpisode.episodeNumber);

      // Step 3: Export to TXT and DOCX files
      const deliveryConfig = dbInstance.get().delivery;
      const txtPath = await DeliveryService.exportToTxt(newEpisode, deliveryConfig);
      const docxPath = await DeliveryService.exportToDocx(newEpisode, deliveryConfig);

      dbInstance.log('INFO', `Successfully generated exports: TXT -> ${txtPath}, DOCX -> ${docxPath}`, newEpisode.episodeNumber);

      // Step 4: SMTP Email delivery
      dbInstance.log('INFO', `Initiating SMTP email delivery to ${deliveryConfig.smtpTo}...`, newEpisode.episodeNumber);
      const emailRes = await DeliveryService.sendEmailDelivery(newEpisode, deliveryConfig, [txtPath, docxPath]);
      if (emailRes.success) {
        dbInstance.log('INFO', emailRes.logMessage, newEpisode.episodeNumber);
      } else {
        dbInstance.log('WARNING', emailRes.logMessage, newEpisode.episodeNumber);
      }

      // Step 5: Google Drive Upload
      dbInstance.log('INFO', `Initiating Google Drive file backup and upload to folder ID [${deliveryConfig.driveFolderId}]...`, newEpisode.episodeNumber);
      const driveRes = await DeliveryService.uploadToGoogleDrive(newEpisode, deliveryConfig, docxPath);
      dbInstance.log('INFO', driveRes.logMessage, newEpisode.episodeNumber);

      dbInstance.log('INFO', 'Story Generation Pipeline Completed Successfully!', newEpisode.episodeNumber);
      this.isProcessing = false;
      return true;
    } catch (e: any) {
      console.error('Pipeline error:', e);
      dbInstance.log('ERROR', `Pipeline aborted due to error: ${e.message || e}`);
      this.isProcessing = false;
      return false;
    }
  }

  public getStatus() {
    return {
      isProcessing: this.isProcessing,
      nextScheduledRun: dbInstance.get().scheduler.autoGenerate ? dbInstance.get().scheduler.customTime : 'Disabled'
    };
  }
}

export const schedulerInstance = new BackgroundScheduler();