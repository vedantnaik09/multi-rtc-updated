export const useStartWebcam = (
  setStream: any,
  setAccessGiven: any,
  webcamVideoRef: React.RefObject<HTMLVideoElement | null>,
  answerButtonRef: React.RefObject<HTMLButtonElement | null>,
  webcamButtonRef: React.RefObject<HTMLButtonElement | null>,
  localStreamRef: { current: MediaStream | null }
) => {
  const startWebcam = async () => {
    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      await setStream(localStreamRef.current);
      await setAccessGiven(true);
      if (webcamVideoRef.current && localStreamRef.current) {
        webcamVideoRef.current.srcObject = localStreamRef.current;
      }
    } catch (error) {
      console.error("Error accessing webcam:", error);
    }

    if (answerButtonRef.current) answerButtonRef.current.disabled = false;
    if (webcamButtonRef.current) webcamButtonRef.current.disabled = true;
    return true;
  };

  return { startWebcam };
};