import { type EnrichedTranscript } from "../actions/podcastActions";
import { useState } from "react";

interface OpenAIChaptersProps {
  openAITranscript: EnrichedTranscript;
  currentTime: number;
  duration: number;
  audioElement: HTMLAudioElement | null;
}

export default function OpenAIChapters({
  openAITranscript,
  currentTime,
  duration,
  audioElement,
}: OpenAIChaptersProps) {
  const [isChapterListOpen, setIsChapterListOpen] = useState(true);

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => setIsChapterListOpen(!isChapterListOpen)}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
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
        {openAITranscript.chapters.chapters.length})
      </button>

      {isChapterListOpen && (
        <div className="flex flex-col gap-2">
          {openAITranscript.chapters.chapters.map((chapter, idx) => {
            const lastChapter =
              openAITranscript.chapters.chapters?.[
                openAITranscript.chapters.chapters.length - 1
              ];
            const scaleFactor = lastChapter
              ? duration / lastChapter.end_time
              : 1;
            const startTime = chapter.start_time * scaleFactor;
            const endTime = chapter.end_time * scaleFactor;

            return (
              <div
                key={idx}
                className={`cursor-pointer rounded-lg border p-4 hover:bg-gray-50 ${
                  currentTime >= startTime && currentTime <= endTime
                    ? "bg-purple-100"
                    : chapter.is_advertisement
                      ? "bg-red-50"
                      : "bg-white"
                }`}
                onClick={() => {
                  if (audioElement) {
                    audioElement.currentTime = startTime;
                    void audioElement.play();
                  }
                }}
              >
                <div className="text-sm text-gray-600">
                  {Math.floor(startTime / 60)}:
                  {String(Math.floor(startTime % 60)).padStart(2, "0")} -
                  {Math.floor(endTime / 60)}:
                  {String(Math.floor(endTime % 60)).padStart(2, "0")}
                </div>
                <div className="mt-1 font-medium">{chapter.title}</div>
                {chapter.is_advertisement && (
                  <div className="mt-1 text-sm text-red-600">
                    Advertisement (Confidence:{" "}
                    {Math.round(chapter.confidence * 100)}%)
                  </div>
                )}
                {chapter.ad_website && (
                  <div className="mt-1 text-sm text-red-600">
                    Website: {chapter.ad_website}
                  </div>
                )}
                {chapter.ad_promo_code && (
                  <div className="mt-1 text-sm text-red-600">
                    Promo Code: {chapter.ad_promo_code}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
