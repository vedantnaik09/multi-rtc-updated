import { useEffect } from "react";
import { firestore } from "../app/firebaseConfig";

export const useHangupEffect = (callId: string | undefined, myIndex: number | undefined, setRemoteVideoRefs: any, setRemoteStreams: any) => {
  useEffect(() => {
    const callDoc = firestore.collection("calls").doc(callId);
    let hangupCollection = callDoc.collection("hangup");
    hangupCollection.onSnapshot(
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          console.log(change.doc.data().hangup);
          let hangedUpUser = change.doc.data().hangup;
          if (hangedUpUser > myIndex!) {
            setRemoteVideoRefs((prevRefs: any) => {
              const newRefs = [...prevRefs];
              newRefs[hangedUpUser - 1] = null;
              return newRefs;
            });
            setRemoteStreams((prevRefs: any) => {
              const newRefs = [...prevRefs];
              newRefs[hangedUpUser - 1] = null;
              return newRefs;
            });
          }
          if (hangedUpUser < myIndex!) {
            setRemoteVideoRefs((prevRefs: any) => {
              const newRefs = [...prevRefs];
              newRefs[hangedUpUser] = null;
              return newRefs;
            });
            setRemoteStreams((prevRefs: any) => {
              const newRefs = [...prevRefs];
              newRefs[hangedUpUser] = null;
              return newRefs;
            });
          }
        });
      },
      (error) => {
        console.error("Error listening for changes: ", error);
      }
    );
  }, [callId, myIndex]);
};