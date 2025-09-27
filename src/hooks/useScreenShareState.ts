import { useState } from "react";

export const useScreenShareState = () => {
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStreamFeed, setScreenStreamFeed] = useState<MediaStream | null>(null);

  return {
    isScreenSharing,
    setIsScreenSharing,
    screenStreamFeed,
    setScreenStreamFeed,
  };
};