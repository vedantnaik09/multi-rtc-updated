import { firestore } from "../app/firebaseConfig";

export const useScreenShare = (
  isScreenSharing: boolean,
  setIsScreenSharing: any,
  screenStreamFeed: MediaStream | null,
  setScreenStreamFeed: any,
  pcs: RTCPeerConnection[],
  webcamVideoRef: React.RefObject<HTMLVideoElement | null>,
  stream: MediaStream | null,
  callId: string | undefined,
  beforeCall: number
) => {
  const mergeAudioStreams = async (screenAudioTrack: MediaStreamTrack) => {
    const audioContext = new AudioContext();

    // Ensure AudioContext is running
    await audioContext.resume();

    // Get local audio (microphone) stream
    const localAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const localAudioSource = audioContext.createMediaStreamSource(localAudioStream);

    // Get screen share audio stream
    const screenAudioSource = audioContext.createMediaStreamSource(new MediaStream([screenAudioTrack]));

    // Create a destination node to combine audio
    const destination = audioContext.createMediaStreamDestination();

    // Connect both audio sources to the destination
    localAudioSource.connect(destination);
    screenAudioSource.connect(destination);

    // Get the combined audio stream
    const combinedAudioStream = destination.stream;

    // Replace the audio track in each peer connection with the combined audio track
    const audioTrack = combinedAudioStream.getAudioTracks()[0];
    pcs.forEach((pc) => {
      const audioSender = pc.getSenders().find((sender) => sender.track?.kind === "audio");
      if (audioSender) {
        audioSender.replaceTrack(audioTrack); // Replace each audio sender's track
      }
    });

    console.log("Combined audio stream sent to peer connections");
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      setIsScreenSharing(true);

      setScreenStreamFeed(screenStream); // Store the full screen-sharing MediaStream

      const videoTrack = screenStream.getVideoTracks()[0]; // Extract the video track

      // Replace the video track for all existing peer connections
      // pcs.forEach((pc) => {
      //   const videoSender = pc.getSenders().find((sender) => sender.track?.kind === "video");
      //   if (videoSender) {
      //     videoSender.replaceTrack(videoTrack); // Replace the video track
      //   }
      // });

      // Merge audio sources
      const screenAudioTrack = screenStream.getAudioTracks()[0]; // Extract the audio track
      console.log("Screen audio track is ", screenAudioTrack);

      if (screenAudioTrack) {
        await mergeAudioStreams(screenAudioTrack);
      }

      // Update the local video element (if displaying the screenshare locally)
      // if (webcamVideoRef.current) {
      //   webcamVideoRef.current.srcObject = screenStream;
      // }

      // Handle the end of screen sharing
      videoTrack.onended = () => {
        stopScreenShare();
      };

      const callDocHost = firestore.collection("calls").doc(callId);
      await callDocHost.update({
        isScreenSharing: true,
        screenSharer: beforeCall,
      });
    } catch (error) {
      console.error("Error starting screen share:", error);
      setIsScreenSharing(false);
    }
  };

  // Modify the stopScreenShare function:
  const stopScreenShare = async () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      const screenTrack = screenStreamFeed?.getVideoTracks()[0];
      screenTrack?.stop();
      // Replace video track for all peer connections
      pcs.forEach(async (pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      });

      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
      }
    }
    setIsScreenSharing(false);

    const callDocHost = firestore.collection("calls").doc(callId);
    await callDocHost.update({
      screenSharer: -1,
    });
  };

  const handleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  };

  return {
    handleScreenShare,
    startScreenShare,
    stopScreenShare,
    mergeAudioStreams,
  };
};