import { firestore, firebase } from "../app/firebaseConfig";

export const useHangup = (
  callId: string | undefined,
  myIndex: number | undefined,
  pcs: RTCPeerConnection[],
  setRemoteStreams: any,
  setRemoteVideoRefs: any,
  setPcs: any
) => {
  const hangup = async () => {
    console.log("🔴 [HANGUP] Starting hangup process:", { callId, myIndex });
    console.log("🔴 [HANGUP] Current pcs:", pcs);
    
    if (!callId || myIndex === undefined) {
      console.log("⚠️ [HANGUP] No call ID or index, skipping Firebase cleanup");
    } else {
      try {
        const callDoc = firestore.collection("calls").doc(callId);
        const indexDoc = callDoc.collection("otherCandidates").doc("indexOfConnectedCandidates");
        const hangupDoc = callDoc.collection("hangup").doc("hangups");
        
        // CRITICAL: Remove user from connected users list
        const batch = firestore.batch();
        
        // Add to hangup list (existing functionality)
        batch.set(hangupDoc, { hangup: myIndex }, { merge: true });
        
        // Remove from connected users (NEW - this is what was missing!)
        batch.update(indexDoc, {
          indexOfCurrentUsers: firebase.firestore.FieldValue.arrayRemove(myIndex + 1) // myIndex is 0-based, Firebase uses 1-based
        });
        
        // Decrement connected users count
        batch.update(callDoc, {
          connectedUsers: firebase.firestore.FieldValue.increment(-1)
        });
        
        await batch.commit();
        console.log("✅ [HANGUP] Successfully removed user from Firebase:", myIndex + 1);
        
      } catch (error) {
        console.error("❌ [HANGUP] Error during Firebase cleanup:", error);
      }
    }

    // Clean up WebRTC connections
    console.log("🧹 [HANGUP] Cleaning up WebRTC connections");
    pcs.forEach((pc) => {
      pc.close();
    });
    setRemoteStreams([]);
    setRemoteVideoRefs([]);
    setPcs([]);
    
    console.log("✅ [HANGUP] Hangup completed");
  };

  return { hangup };
};