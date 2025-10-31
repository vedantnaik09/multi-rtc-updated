import { firestore, firebase } from "../app/firebaseConfig";
import { useJoinProcess } from "./useJoinProcess";

/**
 * Clean up stale users who have left the call
 * This is critica      const unsubscribeNewUsers = indexOfOtherConnectedCandidates.onSnapshot(async (doc) => {
        if (doc.exists) {
          const currentIndexes = doc.data()?.indexOfCurrentUsers || [];
          const newUsers = currentIndexes.filter((index: number) => index > lastProcessedUser);nection establishment
 */
const cleanupStaleUsers = async (callId: string) => {
  try {
    
    const callDoc = firestore.collection("calls").doc(callId);
    const indexDoc = callDoc.collection("otherCandidates").doc("indexOfConnectedCandidates");
    
    const [callData, indexData] = await Promise.all([
      callDoc.get(),
      indexDoc.get()
    ]);
    
    if (!callData.exists || !indexData.exists) {
      return;
    }
    
    const connectedUsers = callData.data()?.connectedUsers || 0;
    const currentIndexes = indexData.data()?.indexOfCurrentUsers || [];
    

    // Check for inconsistencies that indicate stale users
    if (currentIndexes.length > connectedUsers || currentIndexes.some((idx: number) => idx > connectedUsers)) {
      
      // Reset to clean consecutive indexes
      const cleanIndexes = connectedUsers > 0 ? Array.from({ length: connectedUsers }, (_, i) => i + 1) : [];
      
      const batch = firestore.batch();
      batch.update(callDoc, { connectedUsers: cleanIndexes.length });
      batch.update(indexDoc, { indexOfCurrentUsers: cleanIndexes });
      
      await batch.commit();

    } else {
      console.log(" No cleanup needed");
    }
  } catch (error) {
    console.error(" Error during cleanup:", error);
  }
};

/**
 * UNIFIED JOIN SYSTEM
 * 
 * This hook handles joining for BOTH host and meet users.
 * Everyone uses the exact same connection logic regardless of role.
 * 
 * The only difference between host and meet:
 * - Host: can create new calls if none exists
 * - Meet: only joins existing calls
 * 
 * Connection logic is identical for all users.
 */
export const useUnifiedJoin = () => {
  const {
    connectToExistingUsers,
    handleNewUserJoin
  } = useJoinProcess();

  const joinCall = async ({
    callId,
    myName,
    setInCall,
    setCallId,
    setMyIndex,
    hangupButtonRef,
    answerButtonRef,
    servers,
    localStreamRef,
    setRemoteStreams,
    setNameList,
    setPcs,
    setAfterCall,
    pathname,
    replace,
    callInputRef
  }: {
    callId: string;
    myName: string;
    setInCall: any;
    setCallId: any;
    setMyIndex: any;
    hangupButtonRef: React.RefObject<HTMLButtonElement | null>;
    answerButtonRef?: React.RefObject<HTMLButtonElement | null>;
    servers: any;
    localStreamRef: { current: MediaStream | null };
    setRemoteStreams: any;
    setNameList: any;
    setPcs: any;
    setAfterCall: any;
    pathname: string;
    replace: any;
    callInputRef?: React.RefObject<HTMLInputElement | null>;
  }) => {
    try {
      
      setInCall(true);
      if (hangupButtonRef.current) hangupButtonRef.current.disabled = false;
      
      // Set up Firebase references
      const callDocHost = firestore.collection("calls").doc(callId);
      const indexOfOtherConnectedCandidates = callDocHost.collection("otherCandidates").doc("indexOfConnectedCandidates");

      // Update URL
      setCallId(callId);
      replace(`${pathname}?id=${callId}`);
      if (callInputRef?.current) {
        callInputRef.current.value = callId;
      }

      // CRITICAL: Clean up stale users before joining
      await cleanupStaleUsers(callId);
      
      // Get current state after cleanup
      const callDoc = await callDocHost.get();
      const currentUsers = callDoc.data()?.connectedUsers || 0;
      const myIndex = currentUsers + 1;
            
      setMyIndex(currentUsers); // UI uses 0-based indexing

      // Update Firebase with new user (atomic operation)
      const batch = firestore.batch();
      
      if (!callDoc.exists) {
        // Create new call (handles host case)
        batch.set(callDocHost, {
          connectedUsers: myIndex,
          screenSharer: -1,
          loading: false,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        // Update existing call
        batch.update(callDocHost, { connectedUsers: myIndex });
      }
      
      batch.set(indexOfOtherConnectedCandidates, {
        indexOfCurrentUsers: firebase.firestore.FieldValue.arrayUnion(myIndex),
      }, { merge: true });
      
      await batch.commit();

      // Get existing users to connect to
      const indexDoc = await indexOfOtherConnectedCandidates.get();
      const allUsers = indexDoc.data()?.indexOfCurrentUsers || [];
      const existingUsers = allUsers.filter((index: number) => index < myIndex);
      


      // STEP 1: Set up listener for new users joining after me FIRST
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
                // Process all new users in parallel
                const newUserPromises = newUsers.map((newUserIndex: number) => {
                  return handleNewUserJoin(
                    newUserIndex,
                    myIndex,
                    myName,
                    callDocHost,
                    servers,
                    localStreamRef,
                    setRemoteStreams,
                    setNameList,
                    setPcs
                  );
                });
                
                const results = await Promise.allSettled(newUserPromises);
                const successful = results.filter(r => r.status === 'fulfilled').length;
                
                setAfterCall((prev: number) => prev + successful);
                lastProcessedUser = Math.max(...newUsers);
              } catch (error) {
                console.error("Failed to process new users:", error);
              }
            }, 100); // Small debounce
          }
        }
      });

      // STEP 2: Connect to existing users (if any)
      if (existingUsers.length > 0) {
        console.log("Connecting to existing users:", existingUsers);
        
        // Don't await this - let it run in parallel with listener
        connectToExistingUsers(
          existingUsers,
          myIndex,
          myName,
          callDocHost,
          servers,
          localStreamRef,
          setRemoteStreams,
          setNameList,
          setPcs
        ).catch(error => {
          console.error("Failed to connect to existing users:", error);
        });
      } else {
        console.log("No existing users (I'm the first)");
      }

      // Set up cleanup
      const cleanup = () => {
        unsubscribeNewUsers();
        if (processingTimeout) {
          clearTimeout(processingTimeout);
        }
      };

      // Store cleanup function globally for hangup
      (window as any).cleanupJoinProcess = cleanup;
      
      // Add cleanup for unexpected browser close/refresh
      const handleBeforeUnload = () => {
        cleanup();
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      (window as any).cleanupJoinProcessBeforeUnload = handleBeforeUnload;
      

    } catch (error) {
      console.error("Error in join process:", error);
      setInCall(false);
      if (hangupButtonRef.current) hangupButtonRef.current.disabled = true;
      throw error;
    } finally {
      if (answerButtonRef?.current) answerButtonRef.current.disabled = true;
    }
  };

  return { joinCall };
};