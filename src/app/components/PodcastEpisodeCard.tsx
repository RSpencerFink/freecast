import { type Transcript } from "assemblyai";
import {
  type EnrichedTranscript,
  genAudioTranscriptWithAssembly,
  genAudioTranscriptWithOpenAI,
  type PodcastEpisode,
} from "../actions/podcastActions";
import { useState, useEffect } from "react";
import OpenAIChapters from "./OpenAIChapters";
import AssemblyAIChapters from "./AssemblyAIChapters";

interface PodcastEpisodeCardProps {
  episode: PodcastEpisode;
}

export default function PodcastEpisodeCard({
  episode,
}: PodcastEpisodeCardProps) {
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [openAITranscript, setOpenAITranscript] =
    useState<EnrichedTranscript | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [useOpenAI, setUseOpenAI] = useState(true);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null,
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isChapterListOpen, setIsChapterListOpen] = useState(true);
  const [autoSkipAds, setAutoSkipAds] = useState(false);

  const chapterColors = [
    "#FF6B6B", // coral red
    "#4ECDC4", // turquoise
    "#45B7D1", // sky blue
    "#96CEB4", // sage green
    "#FFEEAD", // cream yellow
    "#D4A5A5", // dusty rose
    "#9B59B6", // purple
    "#3498DB", // blue
    "#E67E22", // orange
    "#27AE60", // green
  ];

  // Add effect to handle ad skipping
  useEffect(() => {
    if (!audioElement || !autoSkipAds) return;

    const checkForAd = () => {
      const currentTime = audioElement.currentTime;

      // Check OpenAI chapters
      if (useOpenAI && openAITranscript?.chapters.chapters) {
        const scaleFactor =
          duration /
          (openAITranscript?.chapters?.chapters?.[
            openAITranscript?.chapters?.chapters?.length - 1
          ]?.end_time ?? 1);
        const currentAd = openAITranscript?.chapters?.chapters?.find(
          (chapter) =>
            currentTime >= chapter.start_time * scaleFactor &&
            currentTime <= chapter.end_time * scaleFactor &&
            chapter.is_advertisement,
        );

        if (currentAd) {
          audioElement.currentTime = currentAd.end_time * scaleFactor;
        }
      }
      // Check AssemblyAI chapters if needed
      else if (!useOpenAI && transcript?.chapters) {
        const currentAd = transcript.chapters.find(
          (chapter) =>
            currentTime >= chapter.start * 0.001 &&
            currentTime <= chapter.end * 0.001 &&
            chapter.gist?.toLowerCase().includes("sponsor"),
        );

        if (currentAd) {
          audioElement.currentTime = currentAd.end * 0.001;
        }
      }
    };

    const timeUpdateListener = () => checkForAd();
    audioElement.addEventListener("timeupdate", timeUpdateListener);

    return () => {
      audioElement.removeEventListener("timeupdate", timeUpdateListener);
    };
  }, [
    audioElement,
    autoSkipAds,
    transcript,
    openAITranscript,
    useOpenAI,
    duration,
  ]);

  return (
    <div
      key={episode.guid}
      className="flex flex-col gap-4 rounded-lg border p-4"
    >
      {/* Header section */}
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">{episode.title}</h3>
        <div className="text-sm text-gray-500">
          {new Date(episode.pubDate).toLocaleDateString()} • {episode.duration}
        </div>
        <p className="text-gray-700">{episode.description}</p>
      </div>

      {/* Audio player section */}
      <div className="flex flex-col gap-2">
        <audio
          ref={(el) => setAudioElement(el)}
          onTimeUpdate={(e) =>
            setCurrentTime((e.target as HTMLAudioElement).currentTime)
          }
          onLoadedMetadata={(e) =>
            setDuration((e.target as HTMLAudioElement).duration)
          }
          className="hidden"
        >
          <source src={episode.audioUrl} type="audio/mpeg" />
        </audio>

        {/* Current chapter title */}
        {!useOpenAI && transcript?.chapters && (
          <div className="text-sm font-medium text-gray-700">
            {transcript.chapters.find(
              (chapter) =>
                currentTime >= chapter.start * 0.001 &&
                currentTime <= chapter.end * 0.001,
            )?.headline ?? "No chapter"}
          </div>
        )}
        {useOpenAI && openAITranscript?.chapters.chapters && (
          <div className="text-sm font-medium text-gray-700">
            {(() => {
              const scaleFactor =
                duration /
                (openAITranscript?.chapters?.chapters?.[
                  openAITranscript.chapters.chapters.length - 1
                ]?.end_time ?? 1);
              return (
                openAITranscript?.chapters?.chapters?.find(
                  (chapter) =>
                    currentTime >= chapter.start_time * scaleFactor &&
                    currentTime <= chapter.end_time * scaleFactor,
                )?.title ?? "No chapter"
              );
            })()}
          </div>
        )}

        {/* Progress bar */}
        <div
          className="group relative h-8 w-full cursor-pointer rounded-lg bg-gray-200"
          onClick={(e) => {
            if (!audioElement) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = x / rect.width;
            audioElement.currentTime = percentage * duration;
          }}
        >
          {/* Chapter markers */}
          {useOpenAI && openAITranscript?.chapters.chapters && (
            <>
              {openAITranscript.chapters.chapters.map((chapter, idx) => {
                const scaleFactor =
                  duration /
                  (openAITranscript?.chapters?.chapters?.[
                    openAITranscript.chapters.chapters.length - 1
                  ]?.end_time ?? 1);
                const startPercentage =
                  ((chapter.start_time * scaleFactor) / duration) * 100;
                const endPercentage =
                  ((chapter.end_time * scaleFactor) / duration) * 100;
                const width = endPercentage - startPercentage;
                return (
                  <div
                    key={idx}
                    className={`absolute top-0 h-full opacity-30 ${
                      chapter.is_advertisement ? "bg-red-500" : "bg-gray-400"
                    }`}
                    style={{
                      left: `${startPercentage}%`,
                      width: `${width}%`,
                    }}
                  />
                );
              })}
            </>
          )}
          {!useOpenAI && transcript?.chapters && (
            <>
              {transcript.chapters.map((chapter, idx) => {
                const startPercentage =
                  ((chapter.start * 0.001) / duration) * 100;
                const endPercentage = ((chapter.end * 0.001) / duration) * 100;
                const width = endPercentage - startPercentage;
                return (
                  <div
                    key={idx}
                    className={`absolute top-0 h-full opacity-30 ${
                      chapter.gist?.toLowerCase().includes("sponsor")
                        ? "bg-red-500"
                        : "bg-gray-400"
                    }`}
                    style={{
                      left: `${startPercentage}%`,
                      width: `${width}%`,
                    }}
                  />
                );
              })}
            </>
          )}

          {/* Playback progress */}
          <div
            className="absolute left-0 top-0 h-full rounded-lg bg-purple-500"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />

          {/* Playhead indicator */}
          <div
            className="absolute left-0 top-0 h-full"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          >
            <div className="h-4 w-4 -translate-x-1/2 translate-y-1/2 rounded-full bg-white shadow-xl ring-2 ring-purple-500" />
          </div>

          {/* No transcript hover message */}
          {!transcript && !openAITranscript && !isLoading && (
            <div className="absolute inset-0 hidden items-center justify-center rounded-lg bg-black/50 text-white group-hover:flex">
              {`Click "Scan for Ads" to see chapter information`}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className="text-sm text-gray-600">
          {Math.floor(currentTime / 60)}:
          {String(Math.floor(currentTime % 60)).padStart(2, "0")} /
          {Math.floor(duration / 60)}:
          {String(Math.floor(duration % 60)).padStart(2, "0")}
        </div>

        {/* Play/Pause button */}
        <button
          className="rounded-lg bg-purple-500 px-4 py-2 text-white hover:bg-purple-600"
          onClick={() =>
            audioElement?.paused ? audioElement?.play() : audioElement?.pause()
          }
        >
          {audioElement?.paused ? "Play" : "Pause"}
        </button>
      </div>

      {/* Controls section */}
      <div className="flex items-center gap-2">
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={useOpenAI}
            onChange={(e) => setUseOpenAI(e.target.checked)}
          />
          <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-purple-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
        </label>
        <span className="text-sm text-gray-600">
          Use {useOpenAI ? "OpenAI" : "AssemblyAI"}
        </span>
      </div>

      {/* Scan button */}
      <button
        className="rounded-lg bg-purple-500 px-4 py-2 text-white hover:bg-purple-600 disabled:opacity-50"
        disabled={isLoading}
        onClick={async (e) => {
          e.stopPropagation();
          setIsLoading(true);
          try {
            if (useOpenAI) {
              const res = await genAudioTranscriptWithOpenAI(episode);
              setOpenAITranscript(res);
            } else {
              const res = await genAudioTranscriptWithAssembly(episode);
              setTranscript(res);
            }
          } catch (e) {
            console.error("Could not generate transcript", e);
          } finally {
            setIsLoading(false);
          }
        }}
      >
        Scan for Ads
      </button>

      {/* Chapters section */}
      {!useOpenAI && transcript && (
        <AssemblyAIChapters
          transcript={transcript}
          currentTime={currentTime}
          audioElement={audioElement}
        />
      )}

      {useOpenAI && openAITranscript && (
        <OpenAIChapters
          openAITranscript={openAITranscript}
          currentTime={currentTime}
          duration={duration}
          audioElement={audioElement}
        />
      )}

      {/* Auto-skip section */}
      {((!useOpenAI && transcript?.chapters) ??
        (useOpenAI && openAITranscript?.chapters)) && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={autoSkipAds}
            onChange={(e) => setAutoSkipAds(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label className="text-sm text-gray-700">
            Auto-skip advertisements{" "}
            {(() => {
              let totalAdTime = 0;
              if (useOpenAI && openAITranscript?.chapters.chapters) {
                totalAdTime = openAITranscript.chapters.chapters
                  .filter((chapter) => chapter.is_advertisement)
                  .reduce(
                    (acc, chapter) =>
                      acc + (chapter.end_time - chapter.start_time),
                    0,
                  );
              } else if (!useOpenAI && transcript?.chapters) {
                totalAdTime = transcript.chapters
                  .filter((chapter) =>
                    chapter.gist?.toLowerCase().includes("sponsor"),
                  )
                  .reduce(
                    (acc, chapter) =>
                      acc + (chapter.end - chapter.start) * 0.001,
                    0,
                  );
              }
              return totalAdTime > 0
                ? `(saves ${Math.round(totalAdTime / 60)} min ${Math.round(totalAdTime % 60)} sec)`
                : "";
            })()}
          </label>
        </div>
      )}
    </div>
  );
}
