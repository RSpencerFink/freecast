"use server";

import { parse } from "node-html-parser";
import Parser from "rss-parser";
import { AssemblyAI, type Transcript } from "assemblyai";
import { assemblyAITranscripts } from "~/server/db/assembly_ai_schema";
import { db } from "~/server/db";
import { eq } from "drizzle-orm";

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
    return feed.items.map(
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

export async function genAudioTranscript(podcastEpisode: PodcastEpisode) {
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

export async function genAdsSections(transcript: Transcript) {
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
