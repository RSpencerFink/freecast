/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import {
  type PodcastDirectory,
  searchPodcastDirectory,
  getPodcastEpisodes,
  type PodcastEpisode,
} from "../actions/podcastActions";
import PodcastEpisodeCard from "./PodcastEpisodeCard";

export default function PodcastSearch() {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<PodcastDirectory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPodcast, setSelectedPodcast] =
    useState<PodcastDirectory | null>(null);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const data = await searchPodcastDirectory(searchTerm);
      setResults(data);
    } catch (error) {
      console.error("Error searching podcasts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePodcastSelect = async (podcast: PodcastDirectory) => {
    setSelectedPodcast(podcast);
    setIsLoading(true);
    try {
      const podcastEpisodes = await getPodcastEpisodes(podcast.feedUrl);
      setEpisodes(podcastEpisodes);
    } catch (error) {
      console.error("Error fetching episodes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-4">
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for podcasts..."
            className="flex-1 rounded-lg border p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {results.map((podcast) => (
          <div
            key={podcast.websiteUrl ?? podcast.title}
            className="cursor-pointer rounded-lg border p-4 transition-shadow hover:shadow-lg"
            onClick={() => handlePodcastSelect(podcast)}
          >
            <img
              src={podcast.artwork ?? ""}
              alt={podcast.title}
              className="mb-4 h-48 w-full rounded-lg object-cover"
            />
            <h3 className="mb-2 text-lg font-bold">{podcast.title}</h3>
          </div>
        ))}
      </div>

      {selectedPodcast && (
        <div className="mt-8">
          <h2 className="mb-4 text-2xl font-bold">
            {selectedPodcast.title} Episodes
          </h2>
          <div className="space-y-4">
            {episodes.map((episode: PodcastEpisode) => (
              <PodcastEpisodeCard key={episode.guid} episode={episode} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
