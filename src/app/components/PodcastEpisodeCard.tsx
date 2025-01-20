import { type Transcript } from "assemblyai";
import {
  genAdsSections,
  genAudioTranscript,
  type PodcastEpisode,
} from "../actions/podcastActions";
import { useState } from "react";

interface PodcastEpisodeCardProps {
  episode: PodcastEpisode;
}

export default function PodcastEpisodeCard({
  episode,
}: PodcastEpisodeCardProps) {
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null,
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isChapterListOpen, setIsChapterListOpen] = useState(true);

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

  return (
    <div key={episode.guid} className="rounded-lg border p-4">
      <h3 className="text-lg font-semibold">{episode.title}</h3>
      <div className="mt-1 text-sm text-gray-500">
        {new Date(episode.pubDate).toLocaleDateString()} • {episode.duration}
      </div>
      <p className="mt-2 text-gray-700">{episode.description}</p>
      <div className="mt-4">
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

        {/* Custom audio player */}
        <div className="relative w-full">
          {/* Current chapter title */}
          {transcript?.chapters && (
            <div className="absolute -top-6 text-sm font-medium text-gray-700">
              {transcript.chapters.find(
                (chapter) =>
                  currentTime >= chapter.start * 0.001 &&
                  currentTime <= chapter.end * 0.001,
              )?.headline ?? "No chapter"}
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
            {/* Playback progress */}
            <div
              className="absolute h-full rounded-lg bg-purple-500"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />

            {/* Playhead indicator */}
            <div
              className="absolute h-full w-2 bg-white shadow-xl"
              style={{
                left: `${(currentTime / duration) * 100}%`,
                transform: "translateX(-50%)",
                zIndex: 10,
              }}
            >
              <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-white shadow-xl ring-2 ring-purple-500" />
            </div>

            {/* No transcript hover message */}
            {!transcript && !isLoading && (
              <div className="absolute inset-0 hidden items-center justify-center rounded-lg bg-black/50 text-white group-hover:flex">
                {`Click "Scan for Ads" to see chapter information`}
              </div>
            )}

            {/* Chapter markers */}
            {transcript?.chapters?.map((chapter, idx) => {
              return (
                <div
                  key={idx}
                  className="group/chapter absolute h-full cursor-pointer hover:opacity-80"
                  style={{
                    left: `${((chapter.start * 0.001) / duration) * 100}%`,
                    width: `${Math.max(0.5, ((chapter.end * 0.001 - chapter.start * 0.001) / duration) * 100)}%`,
                    backgroundColor: chapterColors[idx % chapterColors.length],
                    zIndex: 1,
                  }}
                  onClick={() =>
                    audioElement?.currentTime &&
                    (audioElement.currentTime = chapter.start * 0.001)
                  }
                >
                  {/* Chapter tooltip */}
                  <div
                    className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform rounded-lg p-2 text-sm text-white group-hover/chapter:block"
                    style={{
                      backgroundColor:
                        chapterColors[idx % chapterColors.length],
                      zIndex: 20,
                    }}
                  >
                    <div className="font-bold">{chapter.headline}</div>
                    <div className="text-xs text-gray-100">{chapter.gist}</div>
                    <div className="text-xs text-gray-200">
                      {Math.floor((chapter.start * 0.001) / 60)}:
                      {String(
                        Math.floor((chapter.start * 0.001) % 60),
                      ).padStart(2, "0")}{" "}
                      -{Math.floor((chapter.end * 0.001) / 60)}:
                      {String(Math.floor((chapter.end * 0.001) % 60)).padStart(
                        2,
                        "0",
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Timestamp */}
          <div className="mt-1 text-sm text-gray-600">
            {Math.floor(currentTime / 60)}:
            {String(Math.floor(currentTime % 60)).padStart(2, "0")} /
            {Math.floor(duration / 60)}:
            {String(Math.floor(duration % 60)).padStart(2, "0")}
          </div>

          {/* Play/Pause button */}
          <button
            className="mt-2 rounded-lg bg-purple-500 px-4 py-2 text-white hover:bg-purple-600"
            onClick={() =>
              audioElement?.paused
                ? audioElement?.play()
                : audioElement?.pause()
            }
          >
            {audioElement?.paused ? "Play" : "Pause"}
          </button>
        </div>
      </div>
      <button
        className="mt-2 rounded-lg bg-purple-500 px-4 py-2 text-white hover:bg-purple-600 disabled:opacity-50"
        disabled={isLoading}
        onClick={async (e) => {
          e.stopPropagation();
          setIsLoading(true);
          try {
            const res: Transcript = await genAudioTranscript(episode);
            // const adsRes = await genAdsSections(res);
            setTranscript(res);
          } catch (e) {
            console.error("Could not scan for ads", e);
          } finally {
            setIsLoading(false);
          }
        }}
      >
        Scan for Ads
      </button>
      {transcript?.chapters && transcript.chapters.length > 0 && (
        <>
          <button
            onClick={() => setIsChapterListOpen(!isChapterListOpen)}
            className="mt-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <span
              className="transform transition-transform duration-200"
              style={{
                transform: isChapterListOpen ? "rotate(90deg)" : "rotate(0deg)",
              }}
            >
              ▶
            </span>
            {isChapterListOpen ? "Hide Chapters" : "Show Chapters"} (
            {transcript.chapters.length})
          </button>

          {isChapterListOpen &&
            transcript.chapters.map((chapter, idx) => (
              <div
                key={chapter.gist + idx}
                className={`my-6 cursor-pointer p-2 outline hover:bg-gray-50 ${
                  currentTime >= chapter.start * 0.001 &&
                  currentTime <= chapter.end * 0.001
                    ? "bg-purple-100"
                    : ""
                }`}
                onClick={() => {
                  if (audioElement) {
                    audioElement.currentTime = chapter.start * 0.001;
                    void audioElement.play();
                  }
                }}
              >
                <h1>{chapter.headline}</h1>
                <h2>{chapter.gist}</h2>
                <div>
                  {Math.floor((chapter.start * 0.001) / 60)}:
                  {String(Math.floor((chapter.start * 0.001) % 60)).padStart(
                    2,
                    "0",
                  )}{" "}
                  -{Math.floor((chapter.end * 0.001) / 60)}:
                  {String(Math.floor((chapter.end * 0.001) % 60)).padStart(
                    2,
                    "0",
                  )}
                </div>
                <div>{chapter.summary}</div>
              </div>
            ))}
        </>
      )}
    </div>
  );
}
