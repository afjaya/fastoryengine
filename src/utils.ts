import { Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer, PageNumber } from 'docx';
import { AIProvider, Episode } from './types.js';

/**
 * Utility function to convert an episode's text content into a professional .docx format using the 'docx' library.
 */
export const exportEpisodeToDocx = async (episode: Episode): Promise<Blob> => {
  const paragraphs = (episode.content || '')
    .split(/\n\s*\n|\n/)
    .map(p => p.trim())
    .filter(Boolean);

  const docParagraphs = paragraphs.map(text => {
    // Check if paragraph is a section break
    if (text === '***' || text === '---' || text === '===') {
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 240 },
        children: [
          new TextRun({
            text: '*   *   *',
            bold: true,
            size: 24, // 12pt
            color: '666666',
            font: 'Georgia',
          }),
        ],
      });
    }

    // Check if paragraph is a heading
    if (text.startsWith('#')) {
      const headingText = text.replace(/^#+\s*/, '');
      return new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 360, after: 120 },
        children: [
          new TextRun({
            text: headingText,
            bold: true,
            size: 28, // 14pt
            color: '222222',
            font: 'Georgia',
          }),
        ],
      });
    }

    // Standard story paragraph
    return new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 0, after: 180, line: 360 }, // 1.5 line spacing
      indent: { firstLine: 480 }, // 0.33 inch indent
      children: [
        new TextRun({
          text,
          size: 24, // 12pt font size
          font: 'Georgia',
          color: '111111',
        }),
      ],
    });
  });

  const doc = new Document({
    creator: 'Fastory AI Story Studio',
    title: episode.title,
    description: episode.summary || `Episode ${episode.episodeNumber}`,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 240 },
                children: [
                  new TextRun({
                    text: `Episode ${episode.episodeNumber} - ${episode.title}`,
                    size: 18, // 9pt
                    color: '888888',
                    font: 'Georgia',
                    italics: true,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Page ',
                    size: 18,
                    color: '888888',
                    font: 'Georgia',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 18,
                    color: '888888',
                    font: 'Georgia',
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 18,
                    color: '888888',
                    font: 'Georgia',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 18,
                    color: '888888',
                    font: 'Georgia',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Episode Number
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 360, after: 120 },
            children: [
              new TextRun({
                text: `EPISODE ${episode.episodeNumber}`,
                bold: true,
                size: 24, // 12pt
                color: '777777',
                font: 'Georgia',
              }),
            ],
          }),

          // Episode Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 240 },
            children: [
              new TextRun({
                text: (episode.title || '').toUpperCase(),
                bold: true,
                size: 38, // 19pt
                color: '111111',
                font: 'Georgia',
              }),
            ],
          }),

          // Metadata Subtitle
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 480 },
            children: [
              new TextRun({
                text: `Date: ${new Date(episode.generationDate).toLocaleDateString()}   |   Word Count: ${episode.wordCount || 0} words   |   AI Model: ${episode.modelUsed || episode.aiProvider || 'Fastory Studio'}`,
                italics: true,
                size: 18, // 9pt
                color: '666666',
                font: 'Arial',
              }),
            ],
          }),

          // Decorative Divider
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 480 },
            children: [
              new TextRun({
                text: '◆   ◆   ◆',
                size: 20,
                color: '999999',
              }),
            ],
          }),

          // Episode Content Body Paragraphs
          ...docParagraphs,

          // Summary Callout at bottom if available
          ...(episode.summary
            ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 600, after: 240 },
                  children: [
                    new TextRun({
                      text: '— SUMMARY —',
                      bold: true,
                      size: 20,
                      color: '555555',
                      font: 'Georgia',
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  spacing: { before: 0, after: 360 },
                  children: [
                    new TextRun({
                      text: episode.summary,
                      italics: true,
                      size: 20, // 10pt
                      color: '444444',
                      font: 'Georgia',
                    }),
                  ],
                }),
              ]
            : []),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
};

/**
 * Helper to generate Pollinations.ai Image Generation URL based on current settings config
 */
export const generatePollinationsImageUrl = (
  promptText: string, 
  providerConfig: AIProvider,
  options?: { width?: number; height?: number; seed?: number; nologo?: boolean }
): string => {
  if (!providerConfig || providerConfig.id !== 'pollinations-image') {
    throw new Error("Provider Pollinations AI tidak dikonfigurasi atau tidak aktif.");
  }

  const encodedPrompt = encodeURIComponent(promptText);
  const baseUrl = providerConfig.baseUrl || 'https://image.pollinations.ai/prompt/';
  const model = providerConfig.modelName || 'flux';
  
  const width = options?.width || 1024;
  const height = options?.height || 1024;
  const seed = options?.seed || Math.floor(Math.random() * 1000000);
  const nologo = options?.nologo ?? true;

  // Combine URL according to Pollinations.ai standard endpoints
  return `${baseUrl}${encodedPrompt}?model=${model}&width=${width}&height=${height}&seed=${seed}&nologo=${nologo}`;
};

