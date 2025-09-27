import { useEffect } from "react";

export const useStreamEffect = (
  stream: MediaStream | null,
  webcamVideoRef: React.RefObject<HTMLVideoElement | null>
) => {
  useEffect(() => {
    console.log("Stream changed");
    if (webcamVideoRef.current && stream) {
      webcamVideoRef.current.srcObject = stream;
    }
  }, [stream]);
};