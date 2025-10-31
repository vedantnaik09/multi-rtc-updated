import toast from "react-hot-toast";

export const useMediaControlsTranscript = (
  micEnabled: boolean,
  setMicEnabled: any,
  videoEnabled: boolean,
  setVideoEnabled: any,
  stream: MediaStream | null,
  webcamVideoRef: React.RefObject<HTMLVideoElement | null>,
  pcs: RTCPeerConnection[],
  localStreamRef: { current: MediaStream | null }
) => {
  const copyLink = () => {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.pathname === "/host") {
      currentUrl.pathname = "/meet";
    }

    navigator.clipboard
      .writeText(currentUrl.toString())
      .then(() => {
        toast.success("Link copied");
      })
      .catch((error) => {
        console.error("Failed to copy link: ", error);
      });
  };

  const handleMicToggle = async () => {
    console.log("Mic status is ", micEnabled);
    setMicEnabled(!micEnabled);
    sessionStorage.setItem("micEnabled", (!micEnabled).toString());
    console.log(stream);
    if (stream) {
      const audioTrack = stream.getTracks().find((track: MediaStreamTrack) => track.kind === "audio");
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
      }
    }
    if (localStreamRef.current) {
      console.log("Local stream is ", localStreamRef.current);
      const audioTrack = localStreamRef.current.getTracks().find((track: MediaStreamTrack) => track.kind === "audio");
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
      }
    }
  };

  const handleVideoToggle = async () => {
    console.log("Video status is ", videoEnabled);
    sessionStorage.setItem("videoEnabled", (!videoEnabled).toString());
    setVideoEnabled(!videoEnabled);
  
    if (!videoEnabled) {
      // Enable video
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = newStream;
        }
  
        if (stream) {
          const existingVideoTrack = stream.getVideoTracks()[0];
          if (existingVideoTrack) stream.removeTrack(existingVideoTrack);
  
          stream.addTrack(newStream.getVideoTracks()[0]);
        }
  
        pcs.forEach((pc) => {
          const sender = pc.getSenders().find((sender) => sender.track?.kind === "video");
          sender?.replaceTrack(newStream.getVideoTracks()[0]);
        });
  
        console.log("Stream tracks after enabling is ", stream?.getVideoTracks());
      } catch (error) {
        console.error("Error re-enabling video:", error);
      }
    } else {
      // Disable video and show "camera disabled" image
      if (stream) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.stop();
        }
        console.log("Stream tracks after disabling is ", stream?.getVideoTracks());
  
        // Create a canvas for the "camera disabled" image
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
  
          if (stream) {
            // Remove old video track
            stream.getVideoTracks().forEach(track => stream.removeTrack(track));
            stream.addTrack(videoStream.getVideoTracks()[0]);
  
            // Replace audio track if available
            if (audioStream) {
              const existingAudioTracks = stream.getAudioTracks();
              if (existingAudioTracks.length > 0) {
                existingAudioTracks.forEach(track => stream.removeTrack(track));
                stream.addTrack(audioStream.getAudioTracks()[0]);
              } else {
                stream.addTrack(audioStream.getAudioTracks()[0]);
              }
            }
  
            if (webcamVideoRef.current) {
              webcamVideoRef.current.srcObject = stream;
            }
  
            pcs.forEach((pc) => {
              const sender = pc.getSenders().find((sender) => sender.track?.kind === "video");
              sender?.replaceTrack(stream.getVideoTracks()[0]);
            });
  
            console.log("Local Stream tracks after image change is ", stream.getTracks());
            console.log("Replaced video feed with camera disabled image.");
          }
        };
      }
    }
  };

  return {
    copyLink,
    handleMicToggle,
    handleVideoToggle,
  };
};