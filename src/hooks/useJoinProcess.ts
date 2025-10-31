import { firestore, firebase } from "../app/firebaseConfig";
import { WebRTCPerformanceMonitor, ConnectionStateTracker, FirebaseOpMonitor } from "../utils/performanceMonitor";

interface ConnectionState {
  pc: RTCPeerConnection;
  index: number;
  name?: string;
  isEstablished: boolean;
}

export const useJoinProcess = () => {
  
  // Create peer connection with optimal settings
  const createPeerConnection = (servers: any): RTCPeerConnection => {
    const config = {
      ...servers,
      iceCandidatePoolSize: 10, // Pre-allocate ICE candidates
      bundlePolicy: 'max-bundle' as RTCBundlePolicy,
      rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy,
    };
    
    return new RTCPeerConnection(config);
  };

  // Batch ICE candidate processing
  const processBatchedICECandidates = async (
    pc: RTCPeerConnection, 
    candidatesCollection: firebase.firestore.CollectionReference
  ) => {
    const snapshot = await candidatesCollection.get();
    const candidates = snapshot.docs.map(doc => new RTCIceCandidate(doc.data()));
    
    // Process all candidates in parallel
    const candidatePromises = candidates.map(candidate => 
      pc.addIceCandidate(candidate).catch(error => 
        console.warn("Failed to add ICE candidate:", error)
      )
    );
    
    await Promise.allSettled(candidatePromises);
  };

  // Connect to existing users in the call
  const connectToExistingUsers = async (
    existingUsers: number[],
    myIndex: number,
    myName: string,
    callDocHost: firebase.firestore.DocumentReference,
    servers: any,
    localStreamRef: { current: MediaStream | null },
    setRemoteStreams: (fn: (prev: any[]) => any[]) => void,
    setNameList: (fn: (prev: string[]) => string[]) => void,
    setPcs: (fn: (prev: RTCPeerConnection[]) => RTCPeerConnection[]) => void
  ) => {
    const monitor = WebRTCPerformanceMonitor.getInstance();
    monitor.startTiming('parallel_connections_time');
    
    const connections: ConnectionState[] = [];
    const signalPromises: Promise<void>[] = [];
    
    // Create all peer connections in parallel
    existingUsers.forEach(existingUserIndex => {
      const pc = createPeerConnection(servers);
      ConnectionStateTracker.trackConnection(existingUserIndex, pc);
      connections.push({
        pc,
        index: existingUserIndex,
        isEstablished: false
      });
    });
    
    // Add local stream to all connections
    connections.forEach(({ pc }) => {
      localStreamRef.current?.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current as MediaStream);
      });
    });

    // Set up parallel signaling for all connections
    connections.forEach(({ pc, index: existingUserIndex }) => {
      const signalPromise = new Promise<void>(async (resolve, reject) => {
        // Always use lower index first for consistent document naming
        const lowerIndex = Math.min(myIndex, existingUserIndex);
        const higherIndex = Math.max(myIndex, existingUserIndex);
        const signalDoc = callDocHost.collection("signal").doc(`signal${lowerIndex}${higherIndex}`);
        const candidateNameDoc = callDocHost.collection("otherCandidates").doc(`candidate${lowerIndex}${higherIndex}`);
        const offerAnswerPairs = callDocHost.collection("otherCandidates").doc(`offerAnswerPairs${lowerIndex}${higherIndex}`);
        
        let onTrackExecuted = false;
        
        // Set up ontrack handler
        pc.ontrack = async (event) => {
          if (!onTrackExecuted) {
            onTrackExecuted = true;
            const remoteStream = new MediaStream();
            event.streams[0].getTracks().forEach(track => {
              remoteStream.addTrack(track);
            });
            
            setRemoteStreams(prev => [...(prev || []), remoteStream]);
            
            try {
              const candidateDoc = await candidateNameDoc.get();
              const existingName = candidateDoc.data()?.myName;
              if (existingName) {
                setNameList(prev => [...(prev || []), existingName]);
              }
            } catch (error) {
              console.warn("Failed to get user name:", error);
            }
          }
        };

        // Set up ICE candidate handling
        const answerCandidatesCollection = candidateNameDoc.collection("answerCandidates");
        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            try {
              await answerCandidatesCollection.add(event.candidate.toJSON());
            } catch (error) {
              console.warn("Failed to add ICE candidate:", error);
            }
          }
        };

        try {
          // Lower indexed user should initiate the connection
          const isLowerIndex = myIndex < existingUserIndex;
          
          if (isLowerIndex) {
            // Start the signaling process by setting signal to 0
            await signalDoc.set({
              userAdded: `${myIndex} connecting to ${existingUserIndex}`,
              signal: 0,
            });
            
            // Set candidate name
            await candidateNameDoc.set({ myName: myName, joiner: "" });
            
            // Create offer
            const offerDescription = await pc.createOffer();
            await pc.setLocalDescription(offerDescription);
            
            const offer = {
              sdp: offerDescription.sdp as string,
              type: offerDescription.type,
            };
            
            const offerAnswerPair = {
              offer: offer,
              answer: null,
            };
            
            await offerAnswerPairs.set({
              offerAnswerPairs: [offerAnswerPair],
            });
            
            await signalDoc.update({ signal: 1 });
          } else {
            // Higher indexed user waits for existing user to initiate via handleNewUserJoin
          }
        } catch (error) {
          console.error("Error initiating connection:", error);
          reject(error);
          return;
        }
        
        // Listen for signals
        const unsubscribe = signalDoc.onSnapshot(async (doc) => {
          if (!doc.exists) return;
          
          const signal = doc.data()?.signal;
          const isHigherIndex = myIndex > existingUserIndex;
          
          try {
            if (signal === 1) {
              if (isHigherIndex) {
                // Higher index user receives offer and creates answer
                await candidateNameDoc.update({ joiner: myName });
                
                // Get and set offer
                const pairData = await offerAnswerPairs.get();
                const offerDescription = new RTCSessionDescription(pairData.data()?.offerAnswerPairs[0].offer);
                await pc.setRemoteDescription(offerDescription);
                
                // Create and set answer
                const answerDescription = await pc.createAnswer();
                await pc.setLocalDescription(answerDescription);
                
                const answer = {
                  sdp: answerDescription.sdp,
                  type: answerDescription.type,
                };
                
                // Update answer
                const currentPair = pairData.data()?.offerAnswerPairs[0];
                currentPair.answer = answer;
                
                await offerAnswerPairs.update({
                  offerAnswerPairs: [currentPair],
                });
                
                await signalDoc.update({ signal: 2 });
              }
            } else if (signal === 2 && !isHigherIndex) {
              // Lower index user processes answer
              const pairData = await offerAnswerPairs.get();
              const answerDescription = new RTCSessionDescription(pairData.data()?.offerAnswerPairs[0].answer);
              await pc.setRemoteDescription(answerDescription);
              
              await signalDoc.update({ signal: 3 });
              
            } else if (signal === 3) {
              // Process offer candidates in batch
              const offerCandidatesCollection = candidateNameDoc.collection("offerCandidates");
              await processBatchedICECandidates(pc, offerCandidatesCollection);
              
              // Set up real-time ICE candidate listener for new candidates
              offerCandidatesCollection.onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                  if (change.type === "added") {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    pc.addIceCandidate(candidate).catch(error => 
                      console.warn("Failed to add real-time ICE candidate:", error)
                    );
                  }
                });
              });
              
              setPcs(prev => [...(prev || []), pc]);
              await signalDoc.update({ signal: 4 });
              unsubscribe();
              resolve();
            }
          } catch (error) {
            console.error("Error in signaling process:", error);
            reject(error);
          }
        });
      });
      
      signalPromises.push(signalPromise);
    });
    
    // Wait for all connections to be established
    await Promise.allSettled(signalPromises);
    monitor.endTiming('parallel_connections_time');
  };

  // Handle new users joining the call
  const handleNewUserJoin = async (
    newUserIndex: number,
    myIndex: number,
    myName: string,
    callDocHost: firebase.firestore.DocumentReference,
    servers: any,
    localStreamRef: { current: MediaStream | null },
    setRemoteStreams: (fn: (prev: any[]) => any[]) => void,
    setNameList: (fn: (prev: string[]) => string[]) => void,
    setPcs: (fn: (prev: RTCPeerConnection[]) => RTCPeerConnection[]) => void
  ) => {
    // Always use lower index first for consistent document naming
    const lowerIndex = Math.min(myIndex, newUserIndex);
    const higherIndex = Math.max(myIndex, newUserIndex);
    const signalDoc = callDocHost.collection("signal").doc(`signal${lowerIndex}${higherIndex}`);
    const candidateNameDoc = callDocHost.collection("otherCandidates").doc(`candidate${lowerIndex}${higherIndex}`);
    const offerAnswerPairs = callDocHost.collection("otherCandidates").doc(`offerAnswerPairs${lowerIndex}${higherIndex}`);
    
    // Initialize signal immediately
    await signalDoc.set({
      userAdded: `${newUserIndex} added`,
      signal: 0,
    });
    
    return new Promise<void>((resolve, reject) => {
      let pc: RTCPeerConnection;
      
      const unsubscribe = signalDoc.onSnapshot(async (doc) => {
        if (!doc.exists) return;
        
        const signal = doc.data()?.signal;
        
        try {
          const isLowerIndex = myIndex < newUserIndex;
          
          if (signal === 0 && isLowerIndex) {
            // Only lower index user creates offer
            pc = createPeerConnection(servers);
            
            // Set candidate name
            await candidateNameDoc.set({ myName: myName, joiner: "" });
            
            // Add local tracks
            localStreamRef.current?.getTracks().forEach(track => {
              pc.addTrack(track, localStreamRef.current as MediaStream);
            });
            
            let onTrackExecuted = false;
            pc.ontrack = async (event) => {
              if (!onTrackExecuted) {
                onTrackExecuted = true;
                const remoteStream = new MediaStream();
                event.streams[0].getTracks().forEach(track => {
                  remoteStream.addTrack(track);
                });
                
                setRemoteStreams(prev => [...((prev || []) || []), remoteStream]);
                
                try {
                  const candidateDoc = await candidateNameDoc.get();
                  const joinerName = candidateDoc.data()?.joiner;
                  if (joinerName) {
                    setNameList(prev => [...(prev || []), joinerName]);
                  }
                } catch (error) {
                  console.warn("Failed to get joiner name:", error);
                }
              }
            };
            
            // Set up ICE candidate handling
            const offerCandidatesCollection = candidateNameDoc.collection("offerCandidates");
            pc.onicecandidate = async (event) => {
              if (event.candidate) {
                try {
                  await offerCandidatesCollection.add(event.candidate.toJSON());
                } catch (error) {
                  console.warn("Failed to add ICE candidate:", error);
                }
              }
            };
            
            // Create offer
            const offerDescription = await pc.createOffer();
            await pc.setLocalDescription(offerDescription);
            
            const offer = {
              sdp: offerDescription.sdp as string,
              type: offerDescription.type,
            };
            
            const offerAnswerPair = {
              offer: offer,
              answer: null,
            };
            
            await offerAnswerPairs.set({
              offerAnswerPairs: [offerAnswerPair],
            });
            
            await signalDoc.update({ signal: 1 });
            
          } else if (signal === 1 && !isLowerIndex) {
            // Higher index user receives offer and creates answer
            pc = createPeerConnection(servers);
            
            await candidateNameDoc.update({ joiner: myName });
            
            // Add local tracks
            localStreamRef.current?.getTracks().forEach(track => {
              pc.addTrack(track, localStreamRef.current as MediaStream);
            });
            
            let onTrackExecuted = false;
            pc.ontrack = async (event) => {
              if (!onTrackExecuted) {
                onTrackExecuted = true;
                const remoteStream = new MediaStream();
                event.streams[0].getTracks().forEach(track => {
                  remoteStream.addTrack(track);
                });
                
                setRemoteStreams(prev => [...((prev || []) || []), remoteStream]);
                
                try {
                  const candidateDoc = await candidateNameDoc.get();
                  const existingName = candidateDoc.data()?.myName;
                  if (existingName) {
                    setNameList(prev => [...(prev || []), existingName]);
                  }
                } catch (error) {
                  console.warn("Failed to get existing user name:", error);
                }
              }
            };
            
            // Set up ICE candidate handling
            const answerCandidatesCollection = candidateNameDoc.collection("answerCandidates");
            pc.onicecandidate = async (event) => {
              if (event.candidate) {
                try {
                  await answerCandidatesCollection.add(event.candidate.toJSON());
                } catch (error) {
                  console.warn("Failed to add ICE candidate:", error);
                }
              }
            };
            
            // Get and set offer
            const pairData = await offerAnswerPairs.get();
            const offerDescription = new RTCSessionDescription(pairData.data()?.offerAnswerPairs[0].offer);
            await pc.setRemoteDescription(offerDescription);
            
            // Create and set answer
            const answerDescription = await pc.createAnswer();
            await pc.setLocalDescription(answerDescription);
            
            const answer = {
              sdp: answerDescription.sdp,
              type: answerDescription.type,
            };
            
            // Update answer
            const currentPair = pairData.data()?.offerAnswerPairs[0];
            currentPair.answer = answer;
            
            await offerAnswerPairs.update({
              offerAnswerPairs: [currentPair],
            });
            
            await signalDoc.update({ signal: 2 });
            
          } else if (signal === 2 && isLowerIndex) {
            // Lower index user processes answer
            const pairData = await offerAnswerPairs.get();
            const answerDescription = new RTCSessionDescription(pairData.data()?.offerAnswerPairs[0].answer);
            await pc.setRemoteDescription(answerDescription);
            
            // Process answer candidates in batch
            const answerCandidatesCollection = candidateNameDoc.collection("answerCandidates");
            await processBatchedICECandidates(pc, answerCandidatesCollection);
            
            // Set up real-time answer candidate listener
            answerCandidatesCollection.onSnapshot(snapshot => {
              snapshot.docChanges().forEach(change => {
                if (change.type === "added") {
                  const candidate = new RTCIceCandidate(change.doc.data());
                  pc.addIceCandidate(candidate).catch(error => 
                    console.warn("Failed to add real-time answer candidate:", error)
                  );
                }
              });
            });
            
            setPcs(prev => [...(prev || []), pc]);
            await signalDoc.update({ signal: 3 });
            unsubscribe();
            resolve();
            
          } else if (signal === 3 && !isLowerIndex) {
            // Higher index user processes offer candidates and completes connection
            const offerCandidatesCollection = candidateNameDoc.collection("offerCandidates");
            await processBatchedICECandidates(pc, offerCandidatesCollection);
            
            // Set up real-time ICE candidate listener for new candidates
            offerCandidatesCollection.onSnapshot(snapshot => {
              snapshot.docChanges().forEach(change => {
                if (change.type === "added") {
                  const candidate = new RTCIceCandidate(change.doc.data());
                  pc.addIceCandidate(candidate).catch(error => 
                    console.warn("Failed to add real-time offer candidate:", error)
                  );
                }
              });
            });
            
            setPcs(prev => [...(prev || []), pc]);
            await signalDoc.update({ signal: 4 });
            unsubscribe();
            resolve();
          }
        } catch (error) {
          console.error("Error handling new user join:", error);
          reject(error);
        }
      });
    });
  };

  return {
    connectToExistingUsers,
    handleNewUserJoin,
    createPeerConnection,
    processBatchedICECandidates
  };
};