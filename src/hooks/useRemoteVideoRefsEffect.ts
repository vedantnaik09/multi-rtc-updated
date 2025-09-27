import React, { useEffect } from "react";

export const useRemoteVideoRefsEffect = (
  remoteStreams: (MediaStream | null)[],
  remoteVideoRefs: (React.RefObject<HTMLVideoElement> | null)[],
  setRemoteVideoRefs: any
) => {
  useEffect(() => {
    const newRemoteVideoRefs = remoteStreams.map(() => React.createRef<HTMLVideoElement>() as React.RefObject<HTMLVideoElement>);
    setRemoteVideoRefs(newRemoteVideoRefs);
    console.log(remoteStreams);
  }, [remoteStreams]);

  useEffect(() => {
    remoteVideoRefs.forEach(async (ref, index) => {
      if (ref?.current && remoteStreams[index]) {
        ref.current.srcObject = remoteStreams[index];
      }
    });
  }, [remoteVideoRefs, remoteStreams]);
};