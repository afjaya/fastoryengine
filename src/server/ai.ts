import { AppDatabase, StoryBible, Character, Episode, AIProvider } from '../types.js';

/**
 * Helper untuk mengambil API Key dari db.json atau environment variables (.env)
 */
function getProviderApiKey(provider: AIProvider): string {
  if (provider.apiKey && provider.apiKey.trim() !== '') {
    return provider.apiKey;
  }

  // Fallback ke .env
  const env = typeof globalThis !== 'undefined' && typeof (globalThis as any).process !== 'undefined'
    ? (globalThis as any).process.env
    : (import.meta as any).env || {};

  switch (provider.id) {
    case 'gemini':
      return env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || '';
    case 'openai':
      return env.VITE_OPENAI_API_KEY || env.OPENAI_API_KEY || '';
    case 'claude':
      return env.VITE_CLAUDE_API_KEY || env.CLAUDE_API_KEY || env.ANTHROPIC_API_KEY || '';
    case 'deepseek':
      return env.VITE_DEEPSEEK_API_KEY || env.DEEPSEEK_API_KEY || '';
    case 'local':
      return 'not-needed';
    default:
      return '';
  }
}

/**
 * PromptBuilder class implements automated prompt synthesis
 */
export class PromptBuilder {
  public static buildPrompt(db: AppDatabase, customSnippet: string = '', targetLength?: number): { systemPrompt: string; userPrompt: string } {
    const bible = db.storyBible;
    const activeCharacters = db.characters;
    const episodes = db.episodes;
    
    // Determine next episode number
    const nextEpisodeNumber = episodes.length + 1;
    const targetWords = targetLength || bible.episodeLength || 1500;

    // Get previous episode (if exists) for narrative continuity
    const previousEpisode = episodes[episodes.length - 1];

    const isIndonesian = bible.language?.toLowerCase().includes('indo') || 
                         bible.language?.toLowerCase() === 'id' || 
                         bible.language?.toLowerCase() === 'indonesian';

    const langDirective = isIndonesian
      ? `\nCRITICAL LANGUAGE DIRECTIVE:\nYou MUST write the entire story chapter, including its narrative prose, the Title, and the Summary, in INDONESIAN language (Bahasa Indonesia). Do NOT generate any English prose.`
      : '';

    // Assemble the System Persona and Rules
    const systemPrompt = `You are an elite, award-winning novelist specializing in ${bible.genre} fiction.${langDirective}
Your task is to write a single, complete, fully-fleshed-out chapter/episode for a story.
The story is set in the following Universe: "${bible.universeName}".

STORY BIBLE OVERVIEW:
- Genre: ${bible.genre}
- Universe Name: ${bible.universeName}
- Writing Style: ${bible.storyStyle}
- Narrator Style: ${bible.narratorStyle}
- Language: ${bible.language}
- Tone: ${bible.tone}

CRITICAL WRITING DIRECTIVES:
${bible.writingRules}

PROMPT STRUCTURE & PACING RULES:
${bible.promptRules}

FORBIDDEN PATTERNS (DO NOT ATTEMPT):
${bible.forbiddenRules}

CUSTOM INSTRUCTIONS:
${bible.customInstructions}

Your writing must be production-ready. Avoid preachy introductions, conversational AI pleasantries, or placeholders. Return only the story text.`;

    // Assemble character descriptions
    const characterContext = activeCharacters.map((c, i) => {
      return `${i + 1}. ${c.name} (${c.gender}, Age ${c.age}, Occupation: ${c.occupation})
   - Personality: ${c.personality}
   - Status: ${c.status}
   - Location: ${c.location}
   - Relationships: ${c.relationships}
   - Bio: ${c.biography}
   - Additional Notes: ${c.notes}`;
    }).join('\n\n');

    // Assemble previous episode continuity
    let continuityContext = '';
    if (previousEpisode) {
      continuityContext = `PREVIOUS NARRATIVE STATE (Episode #${previousEpisode.episodeNumber}: "${previousEpisode.title}"):
- Previous Summary: ${previousEpisode.summary || 'Not provided'}
- Narrative Continuity: You MUST build directly from the ending of this previous episode. Respect the established timeline, character locations, and unresolved threads. Ensure a smooth transition.`;
    } else {
      continuityContext = `This is the FIRST episode (Episode #1) of the series. Establish the setting, characters, and primary conflict with high narrative impact.`;
    }

    // Combine into final User Prompt
    const userPrompt = `Generate Episode #${nextEpisodeNumber}.${langDirective}
Target Word Count: ${targetWords} words.

ACTIVE CAST OF CHARACTERS:
${characterContext || 'No characters configured yet.'}

${continuityContext}

${customSnippet ? `ADDITIONAL FOCUS / SPECIFIC DIRECTION FOR THIS EPISODE:\n${customSnippet}\n` : ''}

INSTRUCTIONS FOR GENERATION:
1. Deliver ONE complete, self-contained, but cliffhanger-ending narrative chapter of exactly ${targetWords} words ${isIndonesian ? 'written fully in Indonesian' : 'written fully in English'}.
2. Include a compelling Title for this episode at the very first line of your response in the format: "TITLE: <Your Compelling Title Here>".
3. Immediately follow the title with the narrative prose.
4. Ensure the style matches the hard directives: Third-Person Limited narrator, high-contrast atmospheric descriptions, cinematic dialogue, and no summarization of key scenes.
5. Provide a 2-3 sentence summary of this generated episode at the very end of your response, wrapped in a "<SUMMARY>" and "</SUMMARY>" block ${isIndonesian ? 'written fully in Indonesian' : 'written fully in English'}. Example:
   <SUMMARY>
   Provide a concise summary here.
   </SUMMARY>

Write the episode:`;

    return { systemPrompt, userPrompt };
  }
}

/**
 * AIService orchestrates the API requests to multiple providers
 */
export class AIService {
  public static async generateStory(
    db: AppDatabase, 
    customSnippet: string, 
    targetLength?: number
  ): Promise<{ title: string; content: string; summary: string; provider: string; model: string; promptUsed: string }> {
    
    const { systemPrompt, userPrompt } = PromptBuilder.buildPrompt(db, customSnippet, targetLength);
    const activeProvider = db.providers.find(p => p.isActive) || db.providers[0];

    // Ambil API Key secara fleksibel (dari db.json atau .env)
    const providerKey = getProviderApiKey(activeProvider);

    if (!providerKey && activeProvider.id !== 'local') {
      throw new Error(`API Key for ${activeProvider.name} is missing. Please configure it in Settings or set it in .env.`);
    }

    const fullPrompt = `${systemPrompt}\n\n====================\n\n${userPrompt}`;
    let generatedText = '';

    if (activeProvider.id === 'gemini') {
      // Use the modern @google/genai SDK when available. Import dynamically
      // so builds don't fail when the package is not installed locally.
      try {
        const mod: any = await import('@google/genai').catch(() => null);
        const GoogleGenAI = mod?.GoogleGenAI || mod?.default;
        if (!GoogleGenAI) throw new Error('@google/genai SDK not available');

        const ai = new GoogleGenAI({ apiKey: providerKey });

        const response = await ai.models.generateContent({
          model: activeProvider.modelName || 'gemini-3.6-flash',
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.8,
            topP: 0.95
          }
        });

        generatedText = response?.text || '';
      } catch (e: any) {
        throw new Error(`Gemini Generation failed: ${e.message || e}`);
      }
    } else {
      // Fallback to standard OpenAI-compatible REST endpoints for other providers
      const url = activeProvider.baseUrl;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (activeProvider.id === 'openai' || activeProvider.id === 'deepseek' || activeProvider.id === 'local') {
        if (providerKey && providerKey !== 'not-needed') {
          headers['Authorization'] = `Bearer ${providerKey}`;
        }
      } else if (activeProvider.id === 'claude') {
        headers['x-api-key'] = providerKey;
        headers['anthropic-version'] = '2023-06-01';
      }

      // Prepare request payload standard
      let body: string;
      if (activeProvider.id === 'claude') {
        body = JSON.stringify({
          model: activeProvider.modelName || 'claude-3-5-haiku-latest',
          max_tokens: 4000,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.8
        });
      } else {
        // OpenAI, DeepSeek, Local
        body = JSON.stringify({
          model: activeProvider.modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.8,
          max_tokens: 4000
        });
      }

      try {
        const targetUrl = activeProvider.id === 'claude' 
          ? `${url}/messages` 
          : `${url}/chat/completions`;

        const response = await fetch(targetUrl, {
          method: 'POST',
          headers,
          body
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Provider API returned status ${response.status}: ${errText}`);
        }

        const data = await response.json() as any;
        if (activeProvider.id === 'claude') {
          generatedText = data.content?.[0]?.text || '';
        } else {
          generatedText = data.choices?.[0]?.message?.content || '';
        }
      } catch (e: any) {
        throw new Error(`${activeProvider.name} generation failed: ${e.message || e}`);
      }
    }

    if (!generatedText || generatedText.trim() === '') {
      throw new Error('Provider returned an empty story response.');
    }

    // Parse the Title, Content, and Summary from the response
    let title = `Episode #${db.episodes.length + 1}`;
    let content = generatedText;
    let summary = '';

    // Extract Title
    const titleRegex = /TITLE:\s*([^\n]+)/i;
    const titleMatch = content.match(titleRegex);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
      content = content.replace(titleRegex, '').trim();
    }

    // Extract Summary wrapped in <SUMMARY>...</SUMMARY>
    const summaryRegex = /<SUMMARY>([\s\S]*?)<\/SUMMARY>/i;
    const summaryMatch = content.match(summaryRegex);
    if (summaryMatch && summaryMatch[1]) {
      summary = summaryMatch[1].trim();
      content = content.replace(summaryRegex, '').trim();
    }

    // Fallback Summary generator jika AI lupa menyertakan tag <SUMMARY>
    if (!summary) {
      const paragraphs = content.split('\n').filter(p => p.trim().length > 50);
      summary = paragraphs.length > 0 
        ? `${paragraphs[0].slice(0, 180)}...` 
        : 'Episode berhasil dibuat sesuai dengan petunjuk alkitab cerita.';
    }

    return {
      title,
      content: content.trim(),
      summary,
      provider: activeProvider.name,
      model: activeProvider.modelName,
      promptUsed: fullPrompt
    };
  }
}