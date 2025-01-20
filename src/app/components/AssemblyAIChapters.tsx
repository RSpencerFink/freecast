import { type Transcript } from "assemblyai";
import { useState } from "react";

interface AssemblyAIChaptersProps {
  transcript: Transcript;
  currentTime: number;
  audioElement: HTMLAudioElement | null;
}

export default function AssemblyAIChapters({
  transcript,
  currentTime,
  audioElement,
}: AssemblyAIChaptersProps) {
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

  if (!transcript.chapters || transcript.chapters.length === 0) {
    return null;
  }

  return (
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

      {isChapterListOpen && (
        <div className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto">
          {transcript.chapters.map((chapter, idx) => (
            <div
              key={chapter.gist + idx}
              className={`cursor-pointer rounded-lg border p-4 hover:bg-gray-50 ${
                currentTime >= chapter.start * 0.001 &&
                currentTime <= chapter.end * 0.001
                  ? "bg-purple-100"
                  : chapter.gist?.toLowerCase().includes("sponsor")
                    ? "bg-red-50"
                    : "bg-white"
              }`}
              onClick={() => {
                if (audioElement) {
                  audioElement.currentTime = chapter.start * 0.001;
                  void audioElement.play();
                }
              }}
            >
              <div className="text-sm text-gray-600">
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
              <div className="mt-1 font-medium">{chapter.headline}</div>
              <div className="mt-1 text-sm text-gray-700">{chapter.gist}</div>
              {chapter.summary && (
                <div className="mt-2 text-sm text-gray-600">
                  {chapter.summary}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
