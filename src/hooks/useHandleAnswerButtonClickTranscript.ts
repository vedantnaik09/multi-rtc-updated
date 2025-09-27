import { firestore, firebase } from "../app/firebaseConfig";
import { useJoinProcess } from "./useJoinProcess";

export const useHandleAnswerButtonClickTranscript = (
  setInCall: any,
  hangupButtonRef: React.RefObject<HTMLButtonElement | null>,
  searchParams: URLSearchParams,
  setCallId: any,
  pathname: string,
  replace: any,
  callInputRef: React.RefObject<HTMLInputElement | null>,
  setMyIndex: any,
  setAfterCall: any,
  afterCall: number,
  servers: any,
  localStreamRef: { current: MediaStream | null },
  setRemoteStreams: any,
  setNameList: any,
  setPcs: any,
  setBeforeCall: any,
  beforeCall: number,
  answerButtonRef: React.RefObject<HTMLButtonElement | null>
) => {
  const {
    connectToExistingUsers,
    handleNewUserJoin
  } = useJoinProcess();

  const handleAnswerButtonClick = async () => {
    try {
      setInCall(true);
      if (hangupButtonRef.current) hangupButtonRef.current.disabled = false;

      // Get call ID
      let callId: string;
      const idFromParams = searchParams.get("id");

      if (idFromParams) {
        callId = idFromParams;
        setCallId(idFromParams);
        replace(`${pathname}?id=${idFromParams}`);
      } else if (callInputRef.current) {
        callId = callInputRef.current.value;
        setCallId(callInputRef.current.value);
        replace(`${pathname}?id=${callInputRef.current.value}`);
      } else {
        throw new Error("No call ID provided");
      }

      const callDocHost = firestore.collection("calls").doc(callId);
      const indexOfOtherConnectedCandidates = callDocHost.collection("otherCandidates").doc(`indexOfConnectedCandidates`);

      // Get current state and update atomically
      const callDoc = await callDocHost.get();
      const currentUsers = callDoc.data()?.connectedUsers || 0;
      const myIndex = currentUsers + 1;
      
      setMyIndex(currentUsers);

      // Use batch operations for atomic updates
      const batch = firestore.batch();
      batch.update(callDocHost, { connectedUsers: myIndex });
      batch.update(indexOfOtherConnectedCandidates, {
        indexOfCurrentUsers: firebase.firestore.FieldValue.arrayUnion(myIndex),
      });
      
      await batch.commit();

      // Get existing users before starting connections
      const indexDoc = await indexOfOtherConnectedCandidates.get();
      const existingUsers = indexDoc.data()?.indexOfCurrentUsers?.filter((index: number) => index < myIndex) || [];

      console.log(`Joining call with ${existingUsers.length} existing users`);

      // Connect to all existing users in parallel - using default name for transcript
      if (existingUsers.length > 0) {
        await connectToExistingUsers(
          existingUsers,
          myIndex,
          "Transcript User", // Default name for transcript users
          callDocHost,
          servers,
          localStreamRef,
          setRemoteStreams,
          setNameList,
          setPcs
        );
        
        setBeforeCall((prev: number) => prev + existingUsers.length);
        console.log(`Successfully connected to ${existingUsers.length} existing users`);
      }

      // Set up listener for new users joining after us ( with debouncing)
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
                console.log(`Processing ${newUsers.length} new users: ${newUsers.join(', ')}`);
                
                // Process new users in parallel
                const newUserPromises = newUsers.map((newUserIndex: number) =>
                  handleNewUserJoin(
                    newUserIndex,
                    myIndex,
                    "Transcript User", // Default name for transcript users
                    callDocHost,
                    servers,
                    localStreamRef,
                    setRemoteStreams,
                    setNameList,
                    setPcs
                  )
                );
                
                await Promise.allSettled(newUserPromises);
                setAfterCall((prev: number) => prev + newUsers.length);
                lastProcessedUser = Math.max(...newUsers);
                
                console.log(`Successfully processed ${newUsers.length} new users`);
              } catch (error) {
                console.error("Error processing new users:", error);
              }
            }, 100); // 100ms debounce
          }
        }
      });

      // Clean up function (store in component state if needed)
      const cleanup = () => {
        unsubscribeNewUsers();
        if (processingTimeout) {
          clearTimeout(processingTimeout);
        }
      };

      // Store cleanup function for later use
      (window as any).cleanupJoinProcessTranscript = cleanup;

    } catch (error) {
      console.error("Error in join process:", error);
      setInCall(false);
      if (hangupButtonRef.current) hangupButtonRef.current.disabled = true;
      throw error;
    } finally {
      if (answerButtonRef.current) answerButtonRef.current.disabled = true;
    }
  };

  return { handleAnswerButtonClick };
};