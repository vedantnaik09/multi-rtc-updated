import { useCallback, useEffect } from "react";

export const useIceConnectionStateChange = (
  pcs: RTCPeerConnection[],
  beforeCall: number,
  callLeft: number,
  setRemoteVideoRefs: any,
  setRemoteStreams: any,
  setCallLeft: any,
  setBeforeCall: any,
  setAfterCall: any
) => {
  const handleIceConnectionStateChange = useCallback(
    (pc: RTCPeerConnection, index: number) => {
      if (pc.connectionState === "disconnected") {
        console.log(`PC at index ${index} has connectionState as disconnected`);

        setRemoteVideoRefs((prevRefs: any) => {
          const newRefs = [...prevRefs];
          newRefs[index] = null;
          return newRefs;
        });

        setRemoteStreams((prevRefs: any) => {
          const newRefs = [...prevRefs];
          newRefs[index] = null;
          return newRefs;
        });

        setCallLeft((prev: number) => prev + 1);

        if (index <= beforeCall) {
          setBeforeCall((prev: number) => {
            const updatedBeforeCall = prev - 1;
            console.log("Updated beforeCall:", updatedBeforeCall);
            return updatedBeforeCall;
          });
        } else {
          setAfterCall((prev: number) => prev - 1);
        }

        console.log("Caller left, new callLeft:", callLeft + 1);
      }
    },
    [beforeCall, callLeft]
  );

  useEffect(() => {
    const listeners = new Map();

    pcs.forEach((pc, index) => {
      const listener = (event: Event) => {
        handleIceConnectionStateChange(event.currentTarget as RTCPeerConnection, index);
      };
      listeners.set(pc, listener);
      pc.addEventListener("connectionstatechange", listener);
    });

    return () => {
      listeners.forEach((listener, pc) => {
        pc.removeEventListener("connectionstatechange", listener);
      });
    };
  }, [pcs, handleIceConnectionStateChange]);

  return { handleIceConnectionStateChange };
};