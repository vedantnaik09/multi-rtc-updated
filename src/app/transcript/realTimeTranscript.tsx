"use client";
import React, { useState, useEffect, useRef } from "react";
import RecordRTC, { StereoAudioRecorder } from "recordrtc";
import { child, get, push, ref } from "firebase/database";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { firestore, database, storage } from "../firebaseConfig";
import toast from "react-hot-toast";
import { showWarningToast } from "@/utils/toasts";
import { sendTranscriptTo_Chatgpt4O_AndPushInDatabase, sendTranscriptTo_GROQ_AndPushInDatabase } from "@/utils/sendTranscript";

const partialTranscriptPauseThreshold = 20;

const RealTimeTranscript: React.FC<{ callId: string | undefined; remoteStreams: (MediaStream | null)[] }> = ({ callId, remoteStreams }) => {
  const [status, setStatus] = useState<"RECORDING" | "PAUSED" | "STOPPED">("STOPPED");
  const [vocabSwitch, setVocabSwitch] = useState<"ON" | "OFF">("ON");
  const [stream, setStream] = useState<MediaStream | undefined>();
  const [recorder, setRecorder] = useState<RecordRTC | null>(null);
  const [localStreamText, setLocalStreamText] = useState<string>("");
  const [role, setRole] = useState<string>();
  const prevTimeEnd = useRef<number>(0);
  const socket = useRef<WebSocket | null>(null);
  const scrollDiv = useRef<any>(null);
  const finalTextsGlobal = useRef<Record<string, string> | undefined>();
  const currentPauseTime = useRef<number>(0);
  const pauseDetected = useRef<boolean>(false);
  const emptyPartialTranscripts = useRef<number>(0);
  const mediaRecorderforFile = useRef<MediaRecorder>();

  const callDocHost = firestore.collection("calls").doc(callId);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const docSnapshot = await callDocHost.get();
        if (docSnapshot.exists) {
          const data = docSnapshot.data();
          if (data && data.role) {
            setRole(data.role);
          }
        }
      } catch (error) {
        console.error("Error retrieving role from Firebase:", error);
      }
    };

    fetchRole();
  }, [callDocHost]);

  const updateTranscriptInDatabase = (value: string) => {
    const messagesRef = ref(database, "flowofwords/" + callId + "/transcript");
    push(messagesRef, value).then(() => console.log("transcript pushed in database"));
  };

  const run = async () => {
    toast.loading("Starting... pls wait...");
    if (status === "RECORDING") {
      // Show an error toast if recording is already started
      toast.dismiss()
      toast.error("Recording is already in progress!");
    }
    if (role) {
      try {
        await callDocHost.set({ role }, { merge: true }); // Save the role in Firebase
        let temp = currentPauseTime.current;
        currentPauseTime.current = temp + 1;
        updateTranscriptInDatabase("");
        if (status != "RECORDING") {
          const response = await fetch("/api/getToken", { method: "POST" });
          const data = await response.json();

          if (data.error) {
            alert(data.error);
            return;
          }

          const { token } = data;
          let vocabArray: string[] = [];
          let params = { sample_rate: "16000", token: token };
          const url = `wss://api.assemblyai.com/v2/realtime/ws?${new URLSearchParams(params).toString()}`;
          const newSocket = new WebSocket(url);
          socket.current = newSocket;

          let finalTexts: Record<string, string> = {};
          if (finalTextsGlobal.current) {
            finalTexts = finalTextsGlobal.current;
            const sortedKeys = Object.keys(finalTexts).sort((a: any, b: any) => a - b);
            finalTexts[sortedKeys[sortedKeys.length - 1]] += "\n";
          }
          newSocket.onmessage = (message) => {
            let finalMsg = "";
            const res = JSON.parse(message.data);
            const keys = Object.keys(finalTexts).sort((a: any, b: any) => a - b);
            for (const key of keys) {
              if (finalTexts[key]) {
                finalMsg += ` ${finalTexts[key]}`;
              }
            }
            if (res.message_type == "FinalTranscript") {
              if (pauseDetected.current) {
                finalTexts[`${currentPauseTime.current}-${res.audio_start}`] = `\n${res.text}`;
                updateTranscriptInDatabase(res.text);
                sendTranscriptTo_GROQ_AndPushInDatabase(callId!, res.text, role, "1");
                pauseDetected.current = false;
              } else {
                finalTexts[`${currentPauseTime.current}-${res.audio_start}`] = res.text;
              }
              prevTimeEnd.current = res.audio_end;
            } else {
              if (res.text == "") {
                emptyPartialTranscripts.current++;
                pauseDetected.current = true;
              } else {
                if (emptyPartialTranscripts.current >= partialTranscriptPauseThreshold) {
                  finalMsg += `\n`;
                }
                emptyPartialTranscripts.current = 0;
              }
            }
            finalMsg += ` ${res.text}`;
            setLocalStreamText(finalMsg);
            finalTextsGlobal.current = finalTexts;
          };

          newSocket.onerror = (event) => {
            console.error(event);
            socket.current?.close();
            toast.error(JSON.stringify(event));
          };

          newSocket.onclose = (event) => {
            console.log("socketconnection closed 2 ", event);
            socket.current = null;
            toast.error("websocket connection closed.");
            if (event.code === 1009) {
              console.log("Reconnecting to the WebSocket server...");
              toast.error("Reconnecting 1009");
            }
          };
          newSocket.onopen = async () => {
            const audioContext = new AudioContext();
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            const audioIn_01 = audioContext.createMediaStreamSource(audioStream);
            const remoteAudioSources = remoteStreams.filter(Boolean).map((remoteStream) => audioContext.createMediaStreamSource(remoteStream!));

            const dest = audioContext.createMediaStreamDestination();
            audioIn_01.connect(dest);
            remoteAudioSources.forEach((source) => source.connect(dest));

            toast.dismiss();
            toast.success("Recording started");

            setStatus("RECORDING");
            const combinedStream = dest.stream;
            setStream(combinedStream);

            let recorder = new MediaRecorder(combinedStream);
            let audioChunks: BlobPart[] = [];
            recorder.ondataavailable = (e) => audioChunks.push(e.data);

            recorder.onstop = () => {
              // this downloads as .ogx in firefox and .mp3 in chrome
              const audioBlob = new Blob(audioChunks, { type: "audio/mp3" });
              console.log("AUDIBLOB : ", audioBlob);
              const url = URL.createObjectURL(audioBlob);
              console.log("URL IS ", url);
              console.log("STOPPING THE RECORFDINGG");
              const now = new Date();
              const day = String(now.getDate()).padStart(2, "0");
              const month = String(now.getMonth() + 1).padStart(2, "0"); // January is 0!
              const year = now.getFullYear();

              const dateString = `${day}-${month}-${year}`;

              const audioFileRef = storageRef(storage, `audio/${dateString}/${callId}.mp3`);
              uploadBytes(audioFileRef, audioBlob).then((snapshot) => {
                console.log("Uploaded a blob or file!", snapshot);
              });
              getDownloadURL(audioFileRef)
                .then((url) => {
                  if (url) {
                    // updateRoomData("audioUrl", url);
                  }
                })
                .catch((error) => {
                  console.log("Error while uploading audio file ", error);
                });
              // setAudioURL(url);
              // Create a link and set the URL as the href
              const a = document.createElement("a");
              a.href = url;
              console.log("DOWNLOADING");
              a.download = callId!; // Name of the downloaded file
              document.body.appendChild(a);
              a.click();

              // Clean up
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            };

            recorder.start();
            mediaRecorderforFile.current = recorder;

            const localRecorder = new RecordRTC(combinedStream, {
              type: "audio",
              mimeType: "audio/webm;codecs=pcm",
              recorderType: StereoAudioRecorder,
              timeSlice: 250,
              desiredSampRate: 16000,
              numberOfAudioChannels: 1,
              bufferSize: 16384,
              audioBitsPerSecond: 128000,
              ondataavailable: (blob) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const base64data = reader.result as string;
                  if (socket && base64data) {
                    socket.current?.send(JSON.stringify({ audio_data: base64data.split("base64,")[1] }));
                  }
                };
                reader.readAsDataURL(blob);
              },
            });
            setRecorder(localRecorder);
            localRecorder.startRecording();
          };
        }
      } catch (error) {
        toast.dismiss();
        toast.error("error while starting " + error);
        console.error(error);
      }
    } else {
      toast.error("Please select a role");
    }
  };

  const stop = () => {
    if (status === "RECORDING") {
      socket.current?.send(JSON.stringify({ terminate_session: true }));
      socket.current?.close();
      if (recorder) {
        recorder.stopRecording();
        setRecorder(null);
      }
      if (mediaRecorderforFile.current) {
        mediaRecorderforFile.current.stop();
      }
      setStatus("STOPPED");
      showWarningToast("Recording stopped");
    }
  };

  return (
    <div className="self-center">
      <div className="flex max-md:flex-col justify-center gap-3">
        <div className="">
          <select value={role || ""} onChange={(e) => setRole(e.target.value)} className="p-2 border text-center border-gray-300 rounded-md">
            <option value="" disabled>
              Select Role
            </option>
            <option value="Data Engineer">Data Engineer</option>
            <option value="AWS Data Engineer">AWS Data Engineer</option>
            <option value="Azure Data Engineer">Azure Data Engineer</option>
            <option value="GCP Data Engineer">GCP Data Engineer</option>
            <option value="BigData Developer">BigData Developer</option>
            <option value="Java full stack developer">Java Full Stack Developer</option>
            <option value=".Net full stack developer">.Net Full Stack Developer</option>
            <option value="Front end developer">Front End Developer</option>
            <option value="Angular Developer">Angular Developer</option>
            <option value="React Developer">React Developer</option>
            <option value="React Native Mobile Developer">React Native Mobile Developer</option>
            <option value="Android Mobile Developer">Android Mobile Developer</option>
            <option value="IOS Mobile Developer">iOS Mobile Developer</option>
          </select>
        </div>
        <div className="md:flex-row flex-col flex gap-2 items-center">
          <button onClick={run} disabled={!callId} className="disabled:bg-green-200 rounded-xl bg-green-500 disabled:cursor-not-allowed p-2">
            Start Recording
          </button>
          <button onClick={stop} disabled={!callId} className="disabled:bg-green-200 rounded-xl bg-green-500 disabled:cursor-not-allowed p-2">
            Stop Recording
          </button>
        </div>
        {/* Recording Status */}
        <div className="self-center">
          {status === "RECORDING" && (
            <div className="flex items-center gap-2 text-red-600 font-bold">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
              <span>Recording...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RealTimeTranscript;
