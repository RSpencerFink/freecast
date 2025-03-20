"use server";

import Parser from "rss-parser";
import { AssemblyAI, type Transcript } from "assemblyai";
import { assemblyAITranscripts } from "~/server/db/assembly_ai_schema";
import { db } from "~/server/db";
import { eq } from "drizzle-orm";
import OpenAI, { toFile } from "openai";
import { openAITranscripts } from "~/server/db/open_ai_schema";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { splitAudio } from "./splitAudio";
import fs from "fs";

const responseSchema = z.object({
  chapters: z.array(
    z.object({
      start_time: z.number(),
      end_time: z.number(),
      title: z.string(),
      is_advertisement: z.boolean(),
      confidence: z.number(),
      ad_website: z.string().optional(),
      ad_promo_code: z.string().optional(),
    }),
  ),
});

export type Chapter = z.infer<typeof responseSchema>["chapters"][number];

export interface PodcastDirectory {
  collectionId: number;
  title: string;
  feedUrl: string;
  websiteUrl?: string;
  artwork?: string;
}

export async function searchPodcastDirectory(
  query: string,
): Promise<PodcastDirectory[]> {
  // Using iTunes/Apple Podcasts Search API (it's free and doesn't require authentication)
  const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=podcast&limit=20`;
  console.log(searchUrl);
  try {
    const response = await fetch(searchUrl);
    if (!response.ok) {
      throw new Error("Failed to search podcasts");
    }

    interface PodcastSearchResult {
      collectionId: number;
      collectionName: string;
      feedUrl: string;
      collectionViewUrl?: string;
      artworkUrl600?: string;
      artworkUrl100?: string;
    }

    const data = (await response.json()) as { results: PodcastSearchResult[] };
    return data.results.map((result: PodcastSearchResult) => ({
      collectionId: result.collectionId,
      title: result.collectionName,
      feedUrl: result.feedUrl,
      websiteUrl: result.collectionViewUrl,
      artwork: result.artworkUrl600 ?? result.artworkUrl100,
    }));
  } catch (error) {
    console.error("Error searching podcasts:", error);
    throw new Error("Failed to search podcast directory");
  }
}

export interface PodcastEpisode {
  title: string;
  description: string;
  pubDate: string;
  duration: string;
  audioUrl: string;
  imageUrl?: string;
  guid: string;
}

export async function getPodcastEpisodes(
  feedUrl: string,
): Promise<PodcastEpisode[]> {
  try {
    const parser = new Parser({
      customFields: {
        item: [
          ["itunes:duration", "duration"],
          ["itunes:image", "imageUrl"],
        ],
      },
    });

    const feed = await parser.parseURL(feedUrl);
    return feed.items
      .slice(0, 10)
      .map(
        (item: {
          title?: string;
          description?: string;
          pubDate?: string;
          duration?: string;
          enclosure?: { url: string };
          imageUrl?: { href: string };
          guid?: string;
        }) => ({
          title: item.title ?? "",
          description: item.description ?? "",
          pubDate: item.pubDate ?? "",
          duration: item.duration ?? "",
          audioUrl: item.enclosure?.url ?? "",
          imageUrl: item.imageUrl?.href,
          guid: item.guid ?? "",
        }),
      );
  } catch (error) {
    console.error("Error fetching podcast episodes:", error);
    throw new Error("Failed to fetch podcast episodes");
  }
}

export async function genAudioTranscriptWithAssembly(
  podcastEpisode: PodcastEpisode,
): Promise<Transcript> {
  const transcriptFromDB = await db.query.assemblyAITranscripts.findFirst({
    where: eq(assemblyAITranscripts.guid, podcastEpisode.guid),
  });
  if (transcriptFromDB) {
    return transcriptFromDB.transcript as Transcript;
  }
  const assemblyAiKey = process.env.ASSEMBLY_AI;
  if (!assemblyAiKey) {
    throw new Error("AssemblyAI API key not configured");
  }
  const client = new AssemblyAI({
    apiKey: assemblyAiKey,
  });
  const data = {
    audio: podcastEpisode.audioUrl,
    auto_chapters: true,
  };
  const transcript = await client.transcripts.transcribe(data);
  const ret = await db
    .insert(assemblyAITranscripts)
    .values({
      guid: podcastEpisode.guid,
      transcript,
    })
    .returning();
  console.log(ret);
  return transcript;
}

export async function genAdsSectionsWithAssembly(transcript: Transcript) {
  const assemblyAiKey = process.env.ASSEMBLY_AI;
  if (!assemblyAiKey) {
    throw new Error("AssemblyAI API key not configured");
  }
  const client = new AssemblyAI({
    apiKey: assemblyAiKey,
  });
  const prompt = `list the start and end timestamps (in seconds) of advertisments along with a confidence score from 0 to 100 of how certain you are of the section being an ad.
    
    Return a json array: {
        start: int (timestamp in seconds),
        end: int (timestamp in seconds),
        ad_subject: string,
        confidence_score: int,
    }
    `;
  const context = "A podcast that may have paid advertising";

  const { response } = await client.lemur.task({
    transcript_ids: [transcript.id],
    prompt,
    context,
    final_model: "anthropic/claude-3-5-sonnet",
  });
  console.log(response);
  return response;
}

export type EnrichedTranscript = OpenAI.Audio.Transcriptions.Transcription & {
  chapters: { chapters: Chapter[] };
};

interface ExtendedTranscriptionSegment {
  start: number;
  end: number;
  text: string;
  timestamps?: number[];
  words?: Array<{ start: number; end: number; text: string }>;
}

async function analyzeChapters(
  segments: Array<{ start: number; text: string }>,
) {
  const openai = new OpenAI({ apiKey: process.env.OPEN_AI });
  const chapterAnalysis = await openai.chat.completions.create({
    model: "gpt-4o-2024-08-06",
    messages: [
      {
        role: "system",
        content:
          "You are an expert at analyzing podcast transcripts and identifying distinct chapters and advertisements. Use the provided segment timestamps as anchor points for chapter boundaries to ensure accuracy.",
      },
      {
        role: "user",
        content: `Analyze this podcast transcript and break it into logical chapters. Use ONLY the timestamps from the provided segments as start and end points for chapters.

          Important rules:
          1. ONLY use timestamps that exist in the transcript segments
          2. Each chapter must start and end with an actual segment timestamp
          3. Do not exceed the last segment's timestamp
          4. Ensure chapters are sequential with no gaps
          
          Format your response as a JSON array of objects with this structure:
          {
            "start_time": number (in seconds, must match a segment timestamp),
            "end_time": number (in seconds, must match a segment timestamp),
            "title": string (brief chapter title),
            "is_advertisement": boolean,
            "confidence": number (0-1 indicating confidence in ad detection)
            "ad_website": string (if it's an advertisement, the website of the ad),
            "ad_promo_code": string (if it's an advertisement, the promo code of the ad),
          }
          
          Available segment timestamps (in seconds):
          ${segments.map((s) => s.start).join(", ")}
          
          Transcript with segments:
          ${segments.map((s) => `[${s.start}s] ${s.text}`).join("\n")}`,
      },
    ],
    response_format: zodResponseFormat(responseSchema, "chapters"),
  });

  const chapterContent = chapterAnalysis?.choices?.[0]?.message?.content;
  if (!chapterContent) {
    throw new Error("Chapter analysis content is undefined");
  }

  return responseSchema.parse(JSON.parse(chapterContent)).chapters;
}

export async function genAudioTranscriptWithOpenAI(
  podcastEpisode: PodcastEpisode,
): Promise<EnrichedTranscript> {
  const transcriptFromDB = await db.query.openAITranscripts.findFirst({
    where: eq(openAITranscripts.guid, podcastEpisode.guid),
  });
  if (transcriptFromDB) {
    return transcriptFromDB.transcript as EnrichedTranscript;
  }
  const openAIAPIKey = process.env.OPEN_AI;
  if (!openAIAPIKey) {
    throw new Error("OPEN AI API key not configured");
  }
  const openai = new OpenAI({ apiKey: openAIAPIKey });
  const response = await fetch(podcastEpisode.audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const fileSizeInMB = (buffer.length / (1024 * 1024)).toFixed(2);
  console.log("Audio file size:", fileSizeInMB, "MB");

  let transcript;
  if (Number(fileSizeInMB) > 24) {
    console.log("File too large, splitting into chunks...");
    const splitFiles = await splitAudio(podcastEpisode.audioUrl);
    console.log(`split into ${splitFiles.length} files`, splitFiles);
    const combinedTranscript = {
      text: "",
      segments: [] as Array<{
        start: number;
        end: number;
        text: string;
        timestamps?: number[];
        words?: Array<{ start: number; end: number; text: string }>;
      }>,
    };

    let cumulativeDuration = 0;
    const allChapters: Chapter[] = [];

    // Process each chunk sequentially and combine results
    for (let i = 0; i < splitFiles.length; i++) {
      console.log(`Processing chunk ${i + 1}/${splitFiles.length}`);
      console.log(`Cumulative duration before chunk:`, cumulativeDuration);

      const cleanPath = splitFiles[i]?.split("\n")[0]?.trim();
      if (!cleanPath) {
        throw new Error(`Invalid path for chunk ${i + 1}`);
      }
      const fileBuffer = await fs.promises.readFile(cleanPath);
      const file = await toFile(fileBuffer, `chunk${i + 1}.mp3`);

      const chunkTranscript = await openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
        language: "en",
        temperature: 0.1,
      });

      console.log(
        `Chunk ${i + 1} duration:`,
        chunkTranscript.duration,
        "seconds",
      );

      // Adjust timestamps for the current chunk using cumulative duration
      const adjustedSegments =
        chunkTranscript.segments?.map((segment) => {
          // Cast the segment to our extended type that includes optional properties
          const extendedSegment =
            segment as unknown as ExtendedTranscriptionSegment;
          return {
            ...segment,
            start: segment.start + cumulativeDuration,
            end: segment.end + cumulativeDuration,
            // Only include these properties if they exist in the original segment
            ...(extendedSegment.timestamps && {
              timestamps: extendedSegment.timestamps.map(
                (ts) => ts + cumulativeDuration,
              ),
            }),
            ...(extendedSegment.words && {
              words: extendedSegment.words.map((word) => ({
                ...word,
                start: word.start + cumulativeDuration,
                end: word.end + cumulativeDuration,
              })),
            }),
          };
        }) ?? [];
      // Update cumulative duration using the actual chunk duration
      cumulativeDuration += Number(chunkTranscript.duration) || 0;

      // Combine with previous chunks
      combinedTranscript.text +=
        (combinedTranscript.text ? " " : "") + (chunkTranscript.text || "");
      combinedTranscript.segments = [
        ...combinedTranscript.segments,
        ...adjustedSegments,
      ];

      // Add chapter analysis for this chunk
      const chunkChapters = await analyzeChapters(adjustedSegments);
      allChapters.push(...chunkChapters);
    }

    const enrichedTranscript: EnrichedTranscript = {
      ...combinedTranscript,
      chapters: { chapters: allChapters },
    };

    transcript = enrichedTranscript;
  } else {
    const file = await toFile(buffer, "audio.mp3");
    const baseTranscript = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
      language: "en",
      temperature: 0.1,
    });

    // Add chapter analysis
    const chapters = await analyzeChapters(baseTranscript.segments ?? []);
    transcript = {
      ...baseTranscript,
      chapters: { chapters },
    } as EnrichedTranscript;
  }

  // Update DB save operation to include chapter analysis
  const ret = await db
    .insert(openAITranscripts)
    .values({
      guid: podcastEpisode.guid,
      transcript: transcript,
    })
    .returning();

  console.log(ret);
  return transcript;
}
