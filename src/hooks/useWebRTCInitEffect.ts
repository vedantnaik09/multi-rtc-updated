import { useEffect, useRef } from "react";

export const useWebRTCInitEffect = (
  setIsClient: any,
  setStream: any,
  setAccessGiven: any,
  setVideoEnabled: any,
  setMicEnabled: any,
  webcamVideoRef: React.RefObject<HTMLVideoElement | null>,
  callButtonRef: React.RefObject<HTMLButtonElement | null>,
  answerButtonRef: React.RefObject<HTMLButtonElement | null>,
  webcamButtonRef: React.RefObject<HTMLButtonElement | null>,
  pcs: RTCPeerConnection[],
  searchParams: URLSearchParams,
  setCallId: any,
  callInputRef: React.RefObject<HTMLInputElement | null>,
  handleAnswerButtonClick: () => Promise<void>,
  handleCallButtonClick: () => Promise<void>,
  stream: MediaStream | null,
  localStreamRef: { current: MediaStream | null }
) => {
  const hasEffectRun = useRef(false);

  useEffect(() => {
    const initWebcam = async () => {
      const startWebcam = async () => {
        const sessionVideoEnabled = sessionStorage.getItem("videoEnabled") !== "false";
        const sessionMicEnabled = sessionStorage.getItem("micEnabled") !== "false";
  
        try {
          if (sessionVideoEnabled) {
            localStreamRef.current = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true,
            });
            await setStream(localStreamRef.current);
            await setAccessGiven(true);
  
            if (webcamVideoRef.current && localStreamRef.current) {
              webcamVideoRef.current.srcObject = localStreamRef.current;
            }

            if (!sessionMicEnabled) {
              setMicEnabled(false);
              const audioTrack = localStreamRef.current?.getTracks().find((track: MediaStreamTrack) => track.kind === "audio");
              if (audioTrack) audioTrack.enabled = false;
            }
          } else {
            setVideoEnabled(false);
  
            // Create a "camera disabled" canvas
            const canvas = document.createElement("canvas");
            canvas.width = 640;
            canvas.height = 480;
            const context = canvas.getContext("2d");
            const image = new Image();
            image.src = "/camera_disabled.png";
  
            image.onload = async () => {
              context!.drawImage(image, 0, 0, canvas.width, canvas.height);
  
              // Continuously refresh the canvas to keep the video track active
              const keepVideoActive = () => {
                context!.globalAlpha = 0.99;
                context!.fillRect(0, 0, 1, 1);
                requestAnimationFrame(keepVideoActive);
              };
              keepVideoActive();
  
              let audioStream = null;
              try {
                audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
              } catch (error) {
                console.error("Error accessing microphone:", error);
              }
  
              const videoStream = canvas.captureStream();
              const tracks = audioStream 
                ? [...videoStream.getVideoTracks(), ...audioStream.getAudioTracks()] 
                : videoStream.getVideoTracks();
  
              localStreamRef.current = new MediaStream(tracks);
              setStream(localStreamRef.current);
              console.log(localStreamRef.current.getVideoTracks());
  
              if (webcamVideoRef.current) {
                webcamVideoRef.current.srcObject = localStreamRef.current;
              }
  
              pcs.forEach((pc) => {
                const sender = pc.getSenders().find((sender) => sender.track?.kind === "video");
                sender?.replaceTrack(localStreamRef.current!.getVideoTracks()[0]);
              });

              if (!sessionMicEnabled) {
                setMicEnabled(false);
                const audioTrack = localStreamRef.current?.getTracks().find((track: MediaStreamTrack) => track.kind === "audio");
                if (audioTrack) audioTrack.enabled = false;
              }
  
              console.log("Replaced video feed with camera disabled image.");
            };
          }

          if (!sessionMicEnabled && stream) {
            const audioTrack = stream.getTracks().find((track: MediaStreamTrack) => track.kind === "audio");
            if (audioTrack) audioTrack.enabled = false;
          }
        } catch (error) {
          console.error("Error accessing webcam:", error);
        }
  
        if (callButtonRef.current) callButtonRef.current.disabled = false;
        if (answerButtonRef.current) answerButtonRef.current.disabled = false;
        if (webcamButtonRef.current) webcamButtonRef.current.disabled = true;
      };
  
      if (!hasEffectRun.current) {
        hasEffectRun.current = true;
        await startWebcam();
  
        const id = searchParams.get("id");
        if (id) {
          setCallId(id);
          if (callInputRef.current) {
            callInputRef.current.value = id;
          }
          handleAnswerButtonClick();
        } else {
          handleCallButtonClick();
        }
      }
    };
  
    setIsClient(true);
    initWebcam();
  }, []);
};