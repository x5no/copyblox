import React from 'react';
import { useSite, type ToolKey } from '@/context/SiteContext';

interface VideoTutorialProps {
  /** Stock URL from src/config/toolsConfig.ts. Used unless the site owner has
   *  picked a custom video for this tool in their dashboard settings. */
  youtubeUrl?: string;
  /** Identifies which tool this tutorial is for, so we can pick the right
   *  per-tool custom video. Optional — falls back to the legacy global override. */
  toolKey?: ToolKey;
}

const getYouTubeId = (url: string): string | null => {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
  return match ? match[1] : null;
};

const VideoTutorial: React.FC<VideoTutorialProps> = ({ youtubeUrl, toolKey }) => {
  const { customVideos, videoPreference } = useSite();
  const perToolUrl = toolKey && customVideos ? customVideos[toolKey] : null;
  const useCustom = videoPreference === 'custom' && perToolUrl;
  const effectiveUrl = useCustom ? perToolUrl! : youtubeUrl;
  const videoId = effectiveUrl ? getYouTubeId(effectiveUrl) : null;

  return (
    <div className="blox-card p-8 max-w-xl">
      <h2 className="text-2xl font-bold mb-2">How to use</h2>
      <p className="text-gray-400 mb-4">Video Tutorial</p>

      <div className="relative rounded-md overflow-hidden aspect-video">
        {videoId ? (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title="Video Tutorial"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-gray-400">
            No video configured
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoTutorial;
