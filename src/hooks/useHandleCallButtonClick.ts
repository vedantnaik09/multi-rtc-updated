import { firestore, firebase } from "../app/firebaseConfig";
import { useJoinProcess } from "./useJoinProcess";

export const useHandleCallButtonClick = (
  setInCall: any,
  hangupButtonRef: React.RefObject<HTMLButtonElement | null>,
  generateShortId: () => string,
  setCallId: any,
  pathname: string,
  replace: any,
  callInputRef: React.RefObject<HTMLInputElement | null>,
  setMyIndex: any,
  setIsHost: any,
  servers: any,
  setPcs: any,
  localStreamRef: { current: MediaStream | null },
  setRemoteStreams: any,
  setNameList: any
) => {
  const { handleNewUserJoin } = useJoinProcess();

  const handleCallButtonClick = async () => {
    try {
      setInCall(true);
      if (hangupButtonRef.current) hangupButtonRef.current.disabled = false;
      
      const shortId = generateShortId();
      const callDoc = firestore.collection("calls").doc(shortId);
      const indexOfOtherConnectedCandidates = callDoc.collection("otherCandidates").doc(`indexOfConnectedCandidates`);
      const screenshotDoc = callDoc.collection("screenshotSignal").doc("screenshotSignalDocument");

      setCallId(shortId);
      replace(`${pathname}?id=${callDoc.id}`);

      if (callInputRef.current) {
        callInputRef.current.value = callDoc.id;
      }

      // Use batch operations for atomic initialization
      const batch = firestore.batch();
      
      batch.set(indexOfOtherConnectedCandidates, { 
        indexOfCurrentUsers: [1] 
      });
      
      batch.set(callDoc, {
        connectedUsers: 1,
        screenSharer: -1,
        loading: false,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
      
      batch.set(screenshotDoc, { 
        screenshotSignal: 1 
      });
      
      await batch.commit();

      const myIndex = 1;
      setMyIndex(myIndex);
      setIsHost(true);

      console.log(`Call created with ID: ${shortId}`);

      // Set up  listener for new users joining
      let lastProcessedUser = myIndex;
      let processingTimeout: NodeJS.Timeout;

      const unsubscribeNewUsers = indexOfOtherConnectedCandidates.onSnapshot(async (doc) => {
        if (doc.exists) {
          const currentIndexes = doc.data()?.indexOfCurrentUsers || [];
          const newUsers = currentIndexes.filter((index: number) => index > lastProcessedUser);
          
          if (newUsers.length > 0) {
            // Clear any pending processing
            if (processingTimeout) {
              clearTimeout(processingTimeout);
            }
            
            // Debounce processing of new users
            processingTimeout = setTimeout(async () => {
              try {
                console.log(`Host processing ${newUsers.length} new users: ${newUsers.join(', ')}`);
                
                // Process new users in parallel
                const newUserPromises = newUsers.map((newUserIndex: number) =>
                  handleNewUserJoin(
                    newUserIndex,
                    myIndex,
                    "Host", // Host name
                    callDoc,
                    servers,
                    localStreamRef,
                    setRemoteStreams,
                    setNameList,
                    setPcs
                  )
                );
                
                const results = await Promise.allSettled(newUserPromises);
                const successfulConnections = results.filter(result => result.status === 'fulfilled').length;
                
                lastProcessedUser = Math.max(...newUsers);
                
                console.log(`Host successfully processed ${successfulConnections}/${newUsers.length} new users`);
              } catch (error) {
                console.error("Host error processing new users:", error);
              }
            }, 100); // 100ms debounce
          }
        }
      });

      // Clean up function
      const cleanup = () => {
        unsubscribeNewUsers();
        if (processingTimeout) {
          clearTimeout(processingTimeout);
        }
      };

      // Store cleanup function for later use
      (window as any).cleanupHostProcess = cleanup;

    } catch (error) {
      console.error("Error creating call:", error);
      setInCall(false);
      if (hangupButtonRef.current) hangupButtonRef.current.disabled = true;
      throw error;
    }
  };

  return { handleCallButtonClick };
};