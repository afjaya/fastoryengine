import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { dbInstance } from './src/server/db.js';
import { schedulerInstance } from './src/server/scheduler.js';
import { AIService, PromptBuilder } from './src/server/ai.js';
import { DeliveryService } from './src/server/delivery.js';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const Type = {
  OBJECT: 'object',
  ARRAY: 'array',
  STRING: 'string'
} as const;

/**
 * Helper untuk mengambil Gemini API Key secara universal (dari Settings/db.json atau .env)
 */
function getGeminiApiKey(): string {
  const db = dbInstance.get();
  const geminiProvider = db.providers?.find(p => p.id === 'gemini');
  if (geminiProvider?.apiKey && geminiProvider.apiKey.trim() !== '') {
    return geminiProvider.apiKey;
  }
  return process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Body parser middlewares
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Start background scheduler daemon
  schedulerInstance.start();

  // -------------------------------------------------------------
  // API ROUTES
  // -------------------------------------------------------------

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', scheduler: schedulerInstance.getStatus() });
  });

  // Get full DB data
  app.get('/api/db', (req, res) => {
    res.json(dbInstance.get());
  });

  // Restore/Overwrite full DB data
  app.post('/api/db/restore', (req, res) => {
    try {
      dbInstance.overwriteDb(req.body);
      dbInstance.log('INFO', 'System database restored from localized browser backup.');
      res.json({ success: true, db: dbInstance.get() });
    } catch (e: any) {
      res.status(500).json({ error: e.message || e });
    }
  });

  // Create a new project / story title
  app.post('/api/projects', (req, res) => {
    try {
      const { title } = req.body;
      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Project title is required.' });
      }
      const updatedDb = dbInstance.createProject(title.trim());
      dbInstance.log('INFO', `New story project "${title}" created.`);
      res.json(updatedDb);
    } catch (e: any) {
      res.status(500).json({ error: e.message || e });
    }
  });

  // Switch to a project in the archive
  app.post('/api/projects/switch', (req, res) => {
    try {
      const { title } = req.body;
      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Project title is required.' });
      }
      const updatedDb = dbInstance.switchProject(title.trim());
      dbInstance.log('INFO', `Switched to story project "${title}".`);
      res.json(updatedDb);
    } catch (e: any) {
      res.status(500).json({ error: e.message || e });
    }
  });

  // Delete a project from the archive
  app.delete('/api/projects/:title', (req, res) => {
    try {
      const { title } = req.params;
      const updatedDb = dbInstance.deleteProject(title);
      dbInstance.log('INFO', `Archived project "${title}" deleted.`);
      res.json(updatedDb);
    } catch (e: any) {
      res.status(500).json({ error: e.message || e });
    }
  });

  // Update Story Bible
  app.post('/api/bible', (req, res) => {
    try {
      const updated = dbInstance.updateBible(req.body);
      dbInstance.log('INFO', 'Story Bible updated successfully.');
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message || e });
    }
  });

  // Upsert Character
  app.post('/api/characters', (req, res) => {
    try {
      const char = dbInstance.upsertCharacter(req.body);
      dbInstance.log('INFO', `Character "${char.name}" upserted.`);
      res.json(char);
    } catch (e: any) {
      res.status(500).json({ error: e.message || e });
    }
  });

  // Delete Character
  app.delete('/api/characters/:id', (req, res) => {
    try {
      const deleted = dbInstance.deleteCharacter(req.params.id);
      if (deleted) {
        dbInstance.log('INFO', `Character deleted (ID: ${req.params.id}).`);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Character not found.' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message || e });
    }
  });

  // Upsert / Update manual edits of Episode
  app.post('/api/episodes', (req, res) => {
    try {
      const ep = dbInstance.upsertEpisode(req.body);
      dbInstance.log('INFO', `Episode #${ep.episodeNumber} updated.`);
      res.json(ep);
    } catch (e: any) {
      res.status(500).json({ error: e.message || e });
    }
  });

  // Run AI-powered story continuity audit
  app.post('/api/audit-continuity', async (req, res) => {
    try {
      const { content, characters, storyBible } = req.body;
      if (!content) {
        return res.status(400).json({ error: 'Prose content is required for audit.' });
      }

      const apiKey = getGeminiApiKey();
      if (!apiKey) {
        return res.status(400).json({ error: 'Gemini API key is not configured. Please add it in Settings or .env file.' });
      }

      const ai = new GoogleGenAI({ apiKey });

      const systemPrompt = `You are an elite literary editor, continuity supervisor, and manuscript auditor.
Your job is to thoroughly analyze a story chapter's prose and cross-examine it against:
1. The STORY BIBLE (specifically "Forbidden Rules" / "Narrative Guardrails & Safety").
2. The CHARACTER CAST (checking their properties, relationships, and especially their "Status" like 'Dead' or 'Alive').

CRITICAL CHECKLIST:
- Forbidden Rules Clashes: If the chapter mentions, violates, or references any of the forbidden elements, words, or styles listed in the Story Bible's Forbidden Rules, you must flag it.
- Character Status Clashes: Look closely at characters who are "Dead". If they are appearing, speaking, acting, or being treated as active/alive in the current scene, flag it. (Ignore if explicitly described as a past recollection, flashback, hallucination, or ghost, but do call it out to verify if it is ambiguous).
- Relationship & Role Clashes: If a character's relationship, occupation, or location contradicts their registered bio, flag it.

You MUST respond with a valid JSON object matching this schema:
{
  "issues": [
    {
      "id": "string (unique identifier like rule-1, character-elias, etc)",
      "type": "FORBIDDEN_RULE" | "CHARACTER_STATUS" | "OTHER",
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "ruleOrCharacter": "string (name of character or rule summary)",
      "snippet": "string (the exact line/phrase from the chapter)",
      "description": "string (detailed explanation of the conflict)",
      "suggestion": "string (actionable editing advice to resolve)"
    }
  ]
}

Ensure your output is strictly a valid, raw JSON block conforming to the schema. Do NOT wrap it in any markdown code blocks or conversational text.`;

      const userPrompt = `CROSS-EXAMINATION DATABASE:

STORY BIBLE FORBIDDEN RULES:
${storyBible?.forbiddenRules || 'None configured.'}

CHARACTER CAST REGISTRY:
${characters?.map((c: any) => `- Name: ${c.name} | Status: ${c.status} | Gender: ${c.gender} | Age: ${c.age} | Bio: ${c.biography}`).join('\n') || 'No characters registered.'}

CHAPTER PROSE TO AUDIT:
--------------------
${content}
--------------------

Run the audit and output the JSON of continuity issues found (if any). If no issues are found, return an empty array under "issues": {"issues": []}.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              issues: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['FORBIDDEN_RULE', 'CHARACTER_STATUS', 'OTHER'] },
                    severity: { type: Type.STRING, enum: ['HIGH', 'MEDIUM', 'LOW'] },
                    ruleOrCharacter: { type: Type.STRING },
                    snippet: { type: Type.STRING },
                    description: { type: Type.STRING },
                    suggestion: { type: Type.STRING }
                  },
                  required: ['id', 'type', 'severity', 'ruleOrCharacter', 'description', 'suggestion']
                }
              }
            },
            required: ['issues']
          }
        }
      });

      const responseText = response.text || '{"issues":[]}';
      const parsed = JSON.parse(responseText.trim());
      res.json(parsed);
    } catch (e: any) {
      console.error('Continuity audit endpoint failed:', e);
      res.status(500).json({ error: e.message || 'Continuity audit failed.' });
    }
  });

  // Delete Episode from Archive
  app.delete('/api/episodes/:id', (req, res) => {
    try {
      const deleted = dbInstance.deleteEpisode(req.params.id);
      if (deleted) {
        dbInstance.log('INFO', `Episode deleted (ID: ${req.params.id}).`);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Episode not found.' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message || e });
    }
  });

  // Save Settings
  app.post('/api/settings', (req, res) => {
    try {
      const { delivery, scheduler, providers } = req.body;
      dbInstance.updateSettings(delivery, scheduler, providers);
      dbInstance.log('INFO', 'System configurations updated.');
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message || e });
    }
  });

  // Clear log history
  app.post('/api/logs/clear', (req, res) => {
    try {
      dbInstance.clearLogs();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message || e });
    }
  });

  // Build/Preview Prompt on demand
  app.post('/api/prompt/build', (req, res) => {
    try {
      const db = dbInstance.get();
      const { customSnippet, targetLength } = req.body;
      const prompts = PromptBuilder.buildPrompt(db, customSnippet, Number(targetLength));
      res.json(prompts);
    } catch (e: any) {
      res.status(500).json({ error: e.message || e });
    }
  });

  // On-demand Story Generation Pipeline Trigger
  app.post('/api/generate', async (req, res) => {
    try {
      const { customSnippet, targetLength, coverUrl } = req.body;
      const status = schedulerInstance.getStatus();
      
      if (status.isProcessing) {
        return res.status(400).json({ error: 'Story Generation is already in progress.' });
      }

      schedulerInstance.runGenerationPipeline(customSnippet, Number(targetLength), coverUrl);
      
      res.json({ success: true, message: 'Story generation pipeline initiated.' });
    } catch (e: any) {
      res.status(500).json({ error: e.message || e });
    }
  });

  // Manual Trigger for Delivery (Email & Google Drive) for an existing episode
  app.post('/api/deliver-manual', async (req, res) => {
    try {
      const { episodeId } = req.body;
      const db = dbInstance.get();
      const episode = db.episodes.find(e => e.id === episodeId);

      if (!episode) {
        return res.status(404).json({ error: 'Episode not found.' });
      }

      dbInstance.log('INFO', `Initiating manual delivery for Episode #${episode.episodeNumber}...`, episode.episodeNumber);

      const txtPath = await DeliveryService.exportToTxt(episode, db.delivery);
      const docxPath = await DeliveryService.exportToDocx(episode, db.delivery);

      const emailRes = await DeliveryService.sendEmailDelivery(episode, db.delivery, [txtPath, docxPath]);
      const driveRes = await DeliveryService.uploadToGoogleDrive(episode, db.delivery, docxPath);

      dbInstance.log('INFO', `Manual delivery results: Email -> ${emailRes.logMessage} | Drive -> ${driveRes.logMessage}`, episode.episodeNumber);

      res.json({
        success: true,
        email: emailRes.logMessage,
        drive: driveRes.logMessage
      });
    } catch (e: any) {
      dbInstance.log('ERROR', `Manual delivery failed: ${e.message || e}`);
      res.status(500).json({ error: e.message || e });
    }
  });

  // Get list of generated/exported files in the stories folder
  app.get('/api/stories', (req, res) => {
    try {
      const db = dbInstance.get();
      const outputFolder = db.delivery.outputFolder || path.join(process.cwd(), 'stories');
      if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
      }
      const files = fs.readdirSync(outputFolder);
      const fileDetails = files
        .filter(f => !f.startsWith('.'))
        .map(f => {
          const filePath = path.join(outputFolder, f);
          const stats = fs.statSync(filePath);
          return {
            name: f,
            size: stats.size,
            mtime: stats.mtime,
            path: `/stories/${f}`
          };
        })
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      res.json({ files: fileDetails, folderPath: outputFolder });
    } catch (e: any) {
      res.status(500).json({ error: e.message || e });
    }
  });

  // Export a specific episode to TXT or DOCX on-demand
  app.post('/api/export', async (req, res) => {
    try {
      const { episodeId, format } = req.body;
      const db = dbInstance.get();
      const episode = db.episodes.find(e => e.id === episodeId);
      if (!episode) {
        return res.status(404).json({ error: 'Episode not found.' });
      }

      const outputFolder = db.delivery.outputFolder || path.join(process.cwd(), 'stories');
      if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
      }

      let filePath = '';
      let fileName = '';

      if (format === 'txt') {
        filePath = await DeliveryService.exportToTxt(episode, db.delivery);
        fileName = path.basename(filePath);
      } else if (format === 'docx') {
        filePath = await DeliveryService.exportToDocx(episode, db.delivery);
        fileName = path.basename(filePath);
      } else {
        return res.status(400).json({ error: 'Invalid format. Supported formats: docx, txt' });
      }

      res.json({
        success: true,
        fileName,
        path: `/stories/${fileName}`,
        size: fs.statSync(filePath).size
      });
    } catch (e: any) {
      dbInstance.log('ERROR', `On-demand export failed: ${e.message || e}`);
      res.status(500).json({ error: e.message || e });
    }
  });

  // Serve stories folder statically
  app.use('/stories', express.static(path.join(process.cwd(), 'stories')));

  // -------------------------------------------------------------
  // VITE OR STATIC FRONTEND SERVING
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Bind to port 3000 and 0.0.0.0
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FASTORY STORY ENGINE] Server running on http://localhost:${PORT}`);
  });
}

startServer();