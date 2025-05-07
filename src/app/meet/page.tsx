"use client";
import React, { useEffect, useRef, useState, Suspense, useCallback } from "react";
import { firestore, firebase } from "../firebaseConfig";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { FaMicrophoneAltSlash, FaVideoSlash, FaMicrophone, FaVideo, FaDesktop, FaCopy, FaPhoneSlash } from "react-icons/fa";
import { MdOutlineStopScreenShare } from "react-icons/md";
//sign in
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/app/firebaseConfig";
import { useAuth } from "@/context/authContext";
import NameDialog from "@/components/NameDialog";

type OfferAnswerPair = {
  offer: {
    sdp: string | null;
    type: RTCSdpType;
  } | null;
  answer: {
    sdp: string | null;
    type: RTCSdpType;
  } | null;
};
const Page = () => {
  const [myName, setMyName] = useState<string | null>(null);

  return <Suspense fallback={<div>Loading...</div>}>{myName ? <PageContent myName={myName} /> : <NameDialog setMyName={setMyName} />}</Suspense>;
};

const PageContent: React.FC<{ myName: string }> = ({ myName }) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const [isClient, setIsClient] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [callId, setCallId] = useState<string>();
  const webcamButtonRef = useRef<HTMLButtonElement>(null);
  const callInputRef = useRef<HTMLInputElement>(null);
  const answerButtonRef = useRef<HTMLButtonElement>(null);
  const hangupButtonRef = useRef<HTMLButtonElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const [pcs, setPcs] = useState<RTCPeerConnection[]>([]);
  const [myIndex, setMyIndex] = useState<number>();
  const [remoteVideoRefs, setRemoteVideoRefs] = useState<(React.RefObject<HTMLVideoElement> | null)[]>([]);
  const [nonNullRemoteVideoRefs, setNonNullRemoteVideoRefs] = useState<(React.RefObject<HTMLVideoElement> | null)[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<(MediaStream | null)[]>([]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStreamFeed, setScreenStreamFeed] = useState<MediaStream | null>(null);

  const [accessGiven, setAccessGiven] = useState(false);
  const [nameList, setNameList] = useState<string[]>([]);

  const [stream, setStream] = useState<MediaStream | null>(null);

  let localStream: MediaStream | null;
  const [beforeCall, setBeforeCall] = useState(0);
  const [afterCall, setAfterCall] = useState(0);
  const [callLeft, setCallLeft] = useState(0);
  const { user, loading } = useAuth();

  const servers = {
    iceServers: [
      {
        urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
      },
    ],
    iceCandidatePoolSize: 10,
  };

  const startWebcam = async () => {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      await setStream(localStream);
      await setAccessGiven(true);
      if (webcamVideoRef.current && localStream) {
        webcamVideoRef.current.srcObject = localStream;
      }
    } catch (error) {
      console.error("Error accessing webcam:", error);
    }

    if (answerButtonRef.current) answerButtonRef.current.disabled = false;
    if (webcamButtonRef.current) webcamButtonRef.current.disabled = true;
    return true;
  };

  const handleAnswerButtonClick = async () => {
    setInCall(true);
    if (hangupButtonRef.current) hangupButtonRef.current.disabled = false;

    let callId;
    const idFromParams = searchParams.get("id");

    if (idFromParams) {
      callId = idFromParams;
      setCallId(idFromParams);
      replace(`${pathname}?id=${idFromParams}`);
    } else if (callInputRef.current) {
      callId = callInputRef.current.value;
      setCallId(callInputRef.current.value);
      replace(`${pathname}?id=${callInputRef.current.value}`);
    }
    const callDocHost = firestore.collection("calls").doc(callId);
    const lengthUsers = (await callDocHost.get()).data()?.connectedUsers;
    let indexOfOtherConnectedCandidates = callDocHost.collection("otherCandidates").doc(`indexOfConnectedCandidates`);

    const myIndex = lengthUsers + 1;
    setMyIndex(lengthUsers);
    await callDocHost.update({ connectedUsers: myIndex });

    indexOfOtherConnectedCandidates.update({
      indexOfCurrentUsers: firebase.firestore.FieldValue.arrayUnion(myIndex),
    });

    let pc: RTCPeerConnection;

    indexOfOtherConnectedCandidates.onSnapshot(async (doc) => {
      if (doc.exists) {
        //Check for any newly addded users
        if (
          doc.data()?.indexOfCurrentUsers[doc.data()?.indexOfCurrentUsers.length - 1] != myIndex &&
          doc.data()?.indexOfCurrentUsers[doc.data()?.indexOfCurrentUsers.length - 1] &&
          doc.data()?.indexOfCurrentUsers[doc.data()?.indexOfCurrentUsers.length - 1] > myIndex
        ) {
          setAfterCall((prev) => prev + 1);
          console.log("After Call:", afterCall);
          const newAddedUser = doc.data()?.indexOfCurrentUsers[doc.data()?.indexOfCurrentUsers.length - 1];
          let signalDoc = callDocHost.collection("signal").doc(`signal${newAddedUser}${myIndex}`);
          console.log(`${newAddedUser} added`);
          console.log(`${myIndex} myIndex`);
          await signalDoc.set({
            userAdded: `${newAddedUser} added`,
            signal: 0,
          });
          let offerAnswerPairs: firebase.firestore.DocumentReference<firebase.firestore.DocumentData>;
          let offerCandidatesCollection: firebase.firestore.CollectionReference<firebase.firestore.DocumentData>;
          let answerCandidatesCollection: firebase.firestore.CollectionReference<firebase.firestore.DocumentData>;
          let candidateNameDoc: firebase.firestore.DocumentReference<firebase.firestore.DocumentData>;
          signalDoc.onSnapshot(async (doc) => {
            if (doc.exists) {
              const data = doc.data();
              const signal = data?.signal;
              if (signal === 0) {
                pc = new RTCPeerConnection(servers);
                candidateNameDoc = callDocHost.collection("otherCandidates").doc(`candidate${newAddedUser}${myIndex}`);
                candidateNameDoc.set({ myName: myName, joiner: "" });
                await localStream?.getTracks().forEach((track) => {
                  pc.addTrack(track, localStream as MediaStream);
                });

                let onTrackExecuted = false;

                pc.ontrack = async (event) => {
                  if (!onTrackExecuted) {
                    onTrackExecuted = true;
                    const remoteStream = new MediaStream();
                    await event.streams[0].getTracks().forEach((track) => {
                      remoteStream.addTrack(track);
                    });
                    console.log("Remote stream reflected");
                    await setRemoteStreams((prevStreams) => [...prevStreams, remoteStream]);
                    const candidateDocData = await candidateNameDoc.get();
                    if (candidateDocData.exists) {
                      const joinerName = candidateDocData?.data()?.joiner;
                      console.log(joinerName);
                      setNameList((prevNameList = []) => [...(prevNameList || []), joinerName]);
                    }
                  }
                };

                offerCandidatesCollection = callDocHost.collection("otherCandidates").doc(`candidate${newAddedUser}${myIndex}`).collection("offerCandidates");
                answerCandidatesCollection = callDocHost.collection("otherCandidates").doc(`candidate${newAddedUser}${myIndex}`).collection("answerCandidates");
                pc.onicecandidate = async (event) => {
                  event.candidate && (await offerCandidatesCollection.add(event.candidate.toJSON()));
                };
                offerAnswerPairs = callDocHost.collection("otherCandidates").doc(`offerAnswerPairs${newAddedUser}${myIndex}`);

                pc.onicecandidate = async (event) => {
                  event.candidate && (await offerCandidatesCollection.add(event.candidate.toJSON()));
                };

                const offerDescription = await pc.createOffer();
                await pc.setLocalDescription(offerDescription);

                let offer = {
                  sdp: offerDescription.sdp as string,
                  type: offerDescription.type,
                };

                let offerAnswerPair: OfferAnswerPair = {
                  offer: offer,
                  answer: null,
                };

                const currentPairs: OfferAnswerPair[] = (await offerAnswerPairs.get()).data()?.offerAnswerPairs || [];

                await currentPairs.push(offerAnswerPair);
                console.log(currentPairs);
                await offerAnswerPairs.set({
                  offerAnswerPairs: currentPairs,
                });
                await signalDoc.set({ signal: 1 });
              } else if (signal == 2) {
                const answerDescription = new RTCSessionDescription((await offerAnswerPairs.get()).data()?.offerAnswerPairs[0].answer);
                console.log("Data on receiver is ", (await offerAnswerPairs.get()).data()?.offerAnswerPairs[0].answer);
                await pc.setRemoteDescription(answerDescription);

                await answerCandidatesCollection.onSnapshot(
                  async (snapshot) => {
                    await snapshot.docChanges().forEach(async (change) => {
                      if (change.type === "added") {
                        const candidateData = change.doc.data();
                        const candidate = new RTCIceCandidate(candidateData);
                        await pc
                          .addIceCandidate(candidate)
                          .then(() => {
                            console.log("Ice candidate added successfully");
                          })
                          .catch((error) => {
                            console.error("Error adding ice candidate:", error);
                          });
                      }
                    });
                  },
                  (error) => {
                    console.error("Error getting candidate collection:", error);
                  }
                );
                setPcs((prevPcs) => [...prevPcs, pc]);
                await signalDoc.update({ signal: 3 });
              }
            }
          });
        }
      } else {
        console.log("No such document!");
      }
    });
    //Connecting to existing users
    const indexUsers = (await indexOfOtherConnectedCandidates.get()).data()?.indexOfCurrentUsers;
    await indexUsers.forEach(async (existingCaller: number) => {
      console.log(`User Index: ${existingCaller}`);
      let signalDoc = callDocHost.collection("signal").doc(`signal${myIndex}${existingCaller}`);
      let offerAnswerPairs: firebase.firestore.DocumentReference<firebase.firestore.DocumentData>;
      let offerCandidatesCollection = callDocHost.collection("otherCandidates").doc(`candidate${myIndex}${existingCaller}`).collection("offerCandidates");
      let candidateNameDoc = callDocHost.collection("otherCandidates").doc(`candidate${myIndex}${existingCaller}`);
      let pc: RTCPeerConnection;

      signalDoc.onSnapshot(async (doc) => {
        if (doc.exists) {
          const data = doc.data();
          const signal = data?.signal;

          if (signal === 1) {
            pc = new RTCPeerConnection(servers);
            offerAnswerPairs = callDocHost.collection("otherCandidates").doc(`offerAnswerPairs${myIndex}${existingCaller}`);
            console.log(`pair is ${myIndex}${existingCaller}`);
            candidateNameDoc.update({ joiner: myName });

            await localStream?.getTracks().forEach((track) => {
              pc.addTrack(track, localStream as MediaStream);
            });

            let onTrackExecuted = false;

            pc.ontrack = async (event) => {
              if (!onTrackExecuted) {
                setBeforeCall((prev) => prev + 1);
                onTrackExecuted = true;
                const remoteStream = new MediaStream();
                await event.streams[0].getTracks().forEach((track) => {
                  remoteStream.addTrack(track);
                });
                console.log("Remote stream reflected");
                await setRemoteStreams((prevStreams) => [...prevStreams, remoteStream]);
                const candidateDocData = await candidateNameDoc.get();
                if (candidateDocData.exists) {
                  const existingName = candidateDocData?.data()?.myName;
                  console.log(existingName);
                  setNameList((prevNameList = []) => [...(prevNameList || []), existingName]);
                }
              }
            };

            const answerCandidatesCollection = callDocHost
              .collection("otherCandidates")
              .doc(`candidate${myIndex}${existingCaller}`)
              .collection("answerCandidates");
            if (pc)
              pc.onicecandidate = async (event) => {
                event.candidate && (await answerCandidatesCollection.add(event.candidate.toJSON()));
              };

            const offerDescription = new RTCSessionDescription((await offerAnswerPairs.get()).data()?.offerAnswerPairs[0].offer);
            console.log("offer is ", (await offerAnswerPairs.get()).data()?.offerAnswerPairs);
            await pc.setRemoteDescription(offerDescription);

            const answerDescription = await pc.createAnswer();
            await pc.setLocalDescription(answerDescription);

            const answer = {
              sdp: answerDescription.sdp,
              type: answerDescription.type,
            };

            const currentPair = (await offerAnswerPairs.get()).data()?.offerAnswerPairs[0];
            console.log("Current pair is ", currentPair);
            currentPair.answer = answer;

            await offerAnswerPairs.update({
              offerAnswerPairs: [currentPair],
            });

            await signalDoc.update({ signal: 2 });
          } else if (signal === 3) {
            console.log("Before Call:", beforeCall);
            console.log("The remote description after setting it is ", pc);
            await offerCandidatesCollection.get().then(async (snapshot) => {
              await snapshot.docs.forEach(async (doc) => {
                const candidateData = doc.data();
                const candidate = new RTCIceCandidate(candidateData);
                await pc
                  .addIceCandidate(candidate)
                  .then(() => {
                    console.log("Ice candidate added successfully");
                  })
                  .catch((error) => {
                    console.error("Error adding ice candidate:", error);
                  });
              });
            });

            await offerCandidatesCollection.onSnapshot(
              async (snapshot) => {
                await snapshot.docChanges().forEach(async (change) => {
                  if (change.type === "added") {
                    const candidateData = change.doc.data();
                    const candidate = new RTCIceCandidate(candidateData);
                    await pc
                      .addIceCandidate(candidate)
                      .then(() => {
                        console.log("Ice candidate added successfully");
                      })
                      .catch((error) => {
                        console.error("Error adding ice candidate:", error);
                      });
                  }
                });
              },
              (error) => {
                console.error("Error listening for offerCandidates changes:", error);
              }
            );
            setPcs((prevPcs) => [...prevPcs, pc]);
            await signalDoc.update({ signal: 4 });
          }
        }
      });
    });

    if (answerButtonRef.current) answerButtonRef.current.disabled = true;
  };

  useEffect(() => {
    const signIn = () => {
      signInWithEmailAndPassword(auth, "12345@gmail.com", "123456"),
        {
          loading: "Signing in...",
          success: (userCredential: { user: any }) => {
            console.log("USER LOGGED IN", userCredential.user);
            return "Signed in successfully!";
          },
          error: (error: { code: any; message: any }) => {
            console.error(error.code, " ", error.message);
            return "Error signing in!";
          },
        };
    };
    if (!user) {
      signIn();
    }

    if (webcamButtonRef.current) {
      webcamButtonRef.current.onclick = startWebcam;
    }
    if (answerButtonRef.current) {
      answerButtonRef.current.onclick = handleAnswerButtonClick;
    }
  }, []);

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
        audioSender.replaceTrack(audioTrack); // Replace each audio sender’s track
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

    // setRemoteVideoRefs(prevRefs => {
    //   const newRefs = [...prevRefs];
    //   newRefs[2] = null;
    //   return newRefs;
    // });
  };

  useEffect(() => {
    const callDoc = firestore.collection("calls").doc(callId);
    let hangupCollection = callDoc.collection("hangup");
    hangupCollection.onSnapshot(
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          console.log(change.doc.data().hangup);
          let hangedUpUser = change.doc.data().hangup;
          if (hangedUpUser > myIndex!) {
            setRemoteVideoRefs((prevRefs) => {
              const newRefs = [...prevRefs];
              newRefs[hangedUpUser - 1] = null;
              return newRefs;
            });
            setRemoteStreams((prevRefs) => {
              const newRefs = [...prevRefs];
              newRefs[hangedUpUser - 1] = null;
              return newRefs;
            });
          }
          if (hangedUpUser < myIndex!) {
            setRemoteVideoRefs((prevRefs) => {
              const newRefs = [...prevRefs];
              newRefs[hangedUpUser] = null;
              return newRefs;
            });
            setRemoteStreams((prevRefs) => {
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

  const handleIceConnectionStateChange = useCallback(
    (pc: RTCPeerConnection, index: number) => {
      if (pc.connectionState === "disconnected") {
        console.log(`PC at index ${index} has connectionState as disconnected`);

        setRemoteVideoRefs((prevRefs) => {
          const newRefs = [...prevRefs];
          newRefs[index] = null;
          return newRefs;
        });

        setRemoteStreams((prevRefs) => {
          const newRefs = [...prevRefs];
          newRefs[index] = null;
          return newRefs;
        });

        setCallLeft((prev) => prev + 1);

        if (index <= beforeCall) {
          setBeforeCall((prev) => {
            const updatedBeforeCall = prev - 1;
            console.log("Updated beforeCall:", updatedBeforeCall);
            return updatedBeforeCall;
          });
        } else {
          setAfterCall((prev) => prev - 1);
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

  useEffect(() => {
    const newRemoteVideoRefs = remoteStreams.map(() => React.createRef<HTMLVideoElement>());
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

  const hasEffectRun = useRef(false);

  useEffect(() => {
    const initWebcam = async () => {
      const startWebcam = async () => {
        const sessionVideoEnabled = sessionStorage.getItem("videoEnabled") !== "false";
        const sessionMicEnabled = sessionStorage.getItem("micEnabled") !== "false";
  
        try {
          if (sessionVideoEnabled) {
            localStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true,
            });
            await setStream(localStream);
            await setAccessGiven(true);
  
            if (webcamVideoRef.current && localStream) {
              webcamVideoRef.current.srcObject = localStream;
            }
          } else {
            setVideoEnabled(false);
            console.log("Stream tracks after disabling is ", localStream?.getVideoTracks());
  
            // Create a "camera disabled" canvas
            const canvas = document.createElement("canvas");
            canvas.width = 640;
            canvas.height = 480;
            const context = canvas.getContext("2d");
            const image = new Image();
            image.src = "/camera_disabled.png";
  
            image.onload = async () => {
              context!.drawImage(image, 0, 0, canvas.width, canvas.height);
  
              // Continuously refresh the canvas to keep the video track active
              const keepVideoActive = () => {
                context!.globalAlpha = 0.99;
                context!.fillRect(0, 0, 1, 1);
                requestAnimationFrame(keepVideoActive);
              };
              keepVideoActive();
  
              let audioStream = null;
              try {
                audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
              } catch (error) {
                console.error("Error accessing microphone:", error);
              }
  
              const videoStream = canvas.captureStream();
              const tracks = audioStream 
                ? [...videoStream.getVideoTracks(), ...audioStream.getAudioTracks()] 
                : videoStream.getVideoTracks();
  
              localStream = new MediaStream(tracks);
              setStream(localStream);
              console.log(localStream.getVideoTracks());
  
              if (webcamVideoRef.current) {
                webcamVideoRef.current.srcObject = localStream;
              }
  
              pcs.forEach((pc) => {
                const sender = pc.getSenders().find((sender) => sender.track?.kind === "video");
                sender?.replaceTrack(localStream!.getVideoTracks()[0]);
              });
  
              console.log("Replaced video feed with camera disabled image.");
            };
          }
  
          if (!sessionMicEnabled) {
            setMicEnabled(false);
  
            if (stream) {
              const audioTrack = stream.getTracks().find((track) => track.kind === "audio");
              if (audioTrack) audioTrack.enabled = false;
            }
  
            if (localStream) {
              console.log("Local stream is ", localStream);
              const audioTrack = localStream.getTracks().find((track) => track.kind === "audio");
              if (audioTrack) audioTrack.enabled = false;
            }
          }
        } catch (error) {
          console.error("Error accessing webcam:", error);
        }
  
        if (answerButtonRef.current) answerButtonRef.current.disabled = false;
        if (webcamButtonRef.current) webcamButtonRef.current.disabled = true;
      };
  
      if (!hasEffectRun.current) {
        hasEffectRun.current = true;
        await startWebcam();
  
        const id = searchParams.get("id");
        if (id) {
          setCallId(id);
          if (callInputRef.current) {
            callInputRef.current.value = id;
          }
          handleAnswerButtonClick();
        } 
      }
    };
  
    setIsClient(true);
    initWebcam();
  }, []);

  useEffect(() => {
    console.log("Stream changed");
    if (webcamVideoRef.current && stream) {
      webcamVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  const copyLink = () => {
    const currentUrl = window.location.href;
    navigator.clipboard
      .writeText(currentUrl)
      .then(() => {
        toast.success("Link copied");
      })
      .catch((error) => {
        console.error("Failed to copy link: ", error);
      });
  };

  const handleMicToggle = async () => {
    console.log("Mic status is ", micEnabled);
    setMicEnabled(!micEnabled);
    sessionStorage.setItem("micEnabled", (!micEnabled).toString());
    console.log(stream);
    if (stream) {
      const audioTrack = stream.getTracks().find((track) => track.kind === "audio");
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
      }
    }
    if (localStream) {
      console.log("Local stream is ", localStream);
      const audioTrack = localStream.getTracks().find((track) => track.kind === "audio");
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
      }
    }
  };

  const handleVideoToggle = async () => {
    console.log("Video status is ", videoEnabled);
    sessionStorage.setItem("videoEnabled", (!videoEnabled).toString());
    setVideoEnabled(!videoEnabled);
  
    if (!videoEnabled) {
      // Enable video
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = newStream;
        }
  
        if (stream) {
          const existingVideoTrack = stream.getVideoTracks()[0];
          if (existingVideoTrack) stream.removeTrack(existingVideoTrack);
  
          stream.addTrack(newStream.getVideoTracks()[0]);
        }
  
        pcs.forEach((pc) => {
          const sender = pc.getSenders().find((sender) => sender.track?.kind === "video");
          sender?.replaceTrack(newStream.getVideoTracks()[0]);
        });
  
        console.log("Stream tracks after enabling is ", stream?.getVideoTracks());
      } catch (error) {
        console.error("Error re-enabling video:", error);
      }
    } else {
      // Disable video and show "camera disabled" image
      if (stream) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.stop();
        }
        console.log("Stream tracks after disabling is ", stream?.getVideoTracks());
  
        // Create a canvas for the "camera disabled" image
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const context = canvas.getContext("2d");
        const image = new Image();
        image.src = "/camera_disabled.png";
  
        image.onload = async () => {
          context!.drawImage(image, 0, 0, canvas.width, canvas.height);
  
          // Continuously refresh the canvas to keep the video track active
          const keepVideoActive = () => {
            context!.globalAlpha = 0.99;
            context!.fillRect(0, 0, 1, 1);
            requestAnimationFrame(keepVideoActive);
          };
          keepVideoActive();
  
          let audioStream = null;
          try {
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          } catch (error) {
            console.error("Error accessing microphone:", error);
          }
  
          const videoStream = canvas.captureStream();
  
          if (stream) {
            // Remove old video track
            stream.getVideoTracks().forEach(track => stream.removeTrack(track));
            stream.addTrack(videoStream.getVideoTracks()[0]);
  
            // Replace audio track if available
            if (audioStream) {
              const existingAudioTracks = stream.getAudioTracks();
              if (existingAudioTracks.length > 0) {
                stream.removeTrack(existingAudioTracks[0]);
                stream.addTrack(audioStream.getAudioTracks()[0]);
              } else {
                stream.addTrack(audioStream.getAudioTracks()[0]);
              }
            }
  
            if (webcamVideoRef.current) {
              webcamVideoRef.current.srcObject = stream;
            }
  
            pcs.forEach((pc) => {
              const sender = pc.getSenders().find((sender) => sender.track?.kind === "video");
              sender?.replaceTrack(stream.getVideoTracks()[0]);
            });
  
            console.log("Local Stream tracks after image change is ", stream.getTracks());
            console.log("Replaced video feed with camera disabled image.");
          }
        };
      }
    }
  };
  

  useEffect(() => {
    console.log("PCs are ", pcs);
    console.log("Names are ", nameList);
  }, [pcs, nameList]);

  return (
    <div className="mx-auto p-5 ">
      <h2 className="text-2xl font-semibold my-4">Multi-RTC</h2>
      {accessGiven && (
        <div className="my-5 flex sticky justify-center gap-4 bg-black w-fit mx-auto p-2 rounded-xl bottom-2 left-0 right-0">
          {/* Mic Toggle */}
          <button onClick={handleMicToggle} className={`p-3 rounded-full ${micEnabled ? "bg-green-500" : "bg-red-500"} text-white`}>
            {micEnabled ? <FaMicrophone size={15} /> : <FaMicrophoneAltSlash size={15} />}
          </button>

          {/* Video Toggle */}
          <button onClick={handleVideoToggle} className={`p-3 rounded-full ${videoEnabled ? "bg-green-500" : "bg-red-500"} text-white`}>
            {videoEnabled ? <FaVideo size={15} /> : <FaVideoSlash size={15} />}
          </button>

          <button
            disabled={!inCall}
            onClick={copyLink}
            className="p-3 rounded-full disabled:cursor-not-allowed px-2 py-1 disabled:bg-green-400 bg-green-500 text-white"
          >
            <div className={`${inCall ? "" : "cursor-not-allowed"} px-2 py-1 text-white rounded-md `} title="Copy Link">
              <FaCopy size={15} />
            </div>
          </button>

          {/* Screen Share */}
          <button onClick={handleScreenShare} className={`p-3 rounded-full ${isScreenSharing ? "bg-green-500" : "bg-red-500"} text-white`}>
            {!isScreenSharing ? <MdOutlineStopScreenShare size={15} /> : <FaDesktop size={15} />}
          </button>

          {/* Hangup */}
          <button
            ref={hangupButtonRef}
            disabled={!inCall}
            onClick={hangup}
            className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaPhoneSlash size={15} />
          </button>
        </div>
      )}

      <div className={`flex mx-auto justify-center w-full gap-2 flex-wrap`}>
        <div className={`bg-gray-100 pt-2 rounded-lg shadow-md max-w-[33%] min-w-[500px] max-sm:w-full max-sm:min-w-[300px] max-md:min-w-[450px]`}>
          <h3 className="text-xl font-medium mb-2">You</h3>
          {isClient && (
            <video
              id="webcamVideo"
              ref={webcamVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-[500px] aspect-video mx-auto rounded-b-md bg-[#202124]`}
            ></video>
          )}
          {!isClient && <div className="max-sm:w-[90%] max-lg:w-full w-[500px] aspect-video mx-auto rounded-md bg-[#202124] "></div>}
        </div>

        {remoteVideoRefs.map((_, index) => (
          <div
            key={index}
            className={`bg-gray-100 pt-2 rounded-lg shadow-md max-w-[33%] min-w-[500px] max-sm:w-full max-sm:min-w-[300px] max-md:min-w-[450px] ${
              remoteStreams[index] ? "" : "hidden"
            }`}
          >
            {nameList && nameList[index] ? (
              <h3 className="text-xl font-medium mb-2">{nameList[index]}</h3>
            ) : (
              <h3 className="text-xl font-medium mb-2">Remote Stream</h3>
            )}
            {isClient && <video ref={remoteVideoRefs[index]} autoPlay playsInline className="w-[500px] aspect-video mx-auto rounded-b-md bg-[#202124]"></video>}
            {!isClient && <div className="max-sm:w-[90%] max-lg:w-full w-[500px] aspect-video mx-auto rounded-md bg-[#202124] "></div>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Page;
//repush
