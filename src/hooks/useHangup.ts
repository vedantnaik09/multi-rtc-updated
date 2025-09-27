import { firestore } from "../app/firebaseConfig";

export const useHangup = (
  callId: string | undefined,
  myIndex: number | undefined,
  pcs: RTCPeerConnection[],
  setRemoteStreams: any,
  setRemoteVideoRefs: any,
  setPcs: any
) => {
  const hangup = async () => {
    console.log("The current pcs are: ", pcs);
    console.log(myIndex);
    const callDoc = firestore.collection("calls").doc(callId);
    let hangupDoc = callDoc.collection("hangup").doc(`hangups`);
    await hangupDoc.set({ hangup: myIndex });

    pcs.forEach((pc) => {
      pc.close();
    });
    setRemoteStreams([]);
    setRemoteVideoRefs([]);
    setPcs([]);
  };

  return { hangup };
};