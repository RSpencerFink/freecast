import PodcastSearch from "./components/PodcastSearch";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="mx-auto max-w-4xl">
        <PodcastSearch />
      </div>
    </main>
  );
}
