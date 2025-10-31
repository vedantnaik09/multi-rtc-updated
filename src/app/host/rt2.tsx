"use client";
import React, { useState, useEffect, useRef } from "react";
import RecordRTC, { StereoAudioRecorder } from "recordrtc";
import { child, get, push, ref } from "firebase/database";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { database, storage } from "../firebaseConfig";
import toast from "react-hot-toast";
import { showWarningToast } from "@/utils/toasts";
import { sendTranscriptTo_Chatgpt4O_AndPushInDatabase } from "@/utils/sendTranscript";

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

  const updateTranscriptInDatabase = (value: string) => {
    const messagesRef = ref(database, "flowofwords/" + callId + "/transcript");
    push(messagesRef, value).then(() => console.log("transcript pushed in database"));
  };

  const run = async () => {
    if (role) {
      toast.loading("Starting... pls wait...");
      let temp = currentPauseTime.current;
      currentPauseTime.current = temp + 1;
      updateTranscriptInDatabase("");
      if (status != "RECORDING") {
        // existing setup logic
        try {
          const response = await fetch("/api/getToken", {
            method: "POST",
          });
          const data = await response.json();

          if (data.error) {
            alert(data.error);
            return;
          }

          const { token } = data;
          // const vocabArray = rolesVocabulary.hasOwnProperty(role)
          //   ? // @ts-ignore
          //     rolesVocabulary[role]
          //   : [];
          let vocabArray: string[] = [];

          let params;

          params = {
            sample_rate: "16000",
            token: token,
          };

          console.log("params is ", params);
          const url = `wss://api.assemblyai.com/v2/realtime/ws?${new URLSearchParams(params).toString()}`;
          const newSocket = new WebSocket(
            // `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`
            url
          );

          socket.current = newSocket;

          let finalTexts: Record<string, string> = {};
          if (finalTextsGlobal.current) {
            finalTexts = finalTextsGlobal.current;
            const sortedKeys = Object.keys(finalTexts).sort((a: any, b: any) => a - b);
            finalTexts[sortedKeys[sortedKeys.length - 1]] = finalTexts[sortedKeys[sortedKeys.length - 1]] += "\n";
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
            // if final transcript arrives more than 2 seconds apart then put it on new line.
            if (res.message_type == "FinalTranscript") {
              if (pauseDetected.current == true) {
                console.log("GREATER THAN 2 SECONDS");
                finalTexts[`${currentPauseTime.current}-${res.audio_start}`] = `\n${res.text}`;
                console.log("TEXT AFTER LONG PAUSE IS : \n", res.text, "\n SEDNGING TO CHATGPT");
                updateTranscriptInDatabase(res.text);
                sendTranscriptTo_Chatgpt4O_AndPushInDatabase(callId!, res.text, role, "1");
                pauseDetected.current = false;
              } else {
                finalTexts[`${currentPauseTime.current}-${res.audio_start}`] = res.text;
              }
              prevTimeEnd.current = res.audio_end;
            } else {
              if (res.text == "") {
                emptyPartialTranscripts.current = emptyPartialTranscripts.current += 1;
                // this state is made true here
                // but this will be made false in the final transcript when we handle the \n
                // in it so that the newline character is permanent.
                pauseDetected.current = true;
              } else {
                if (emptyPartialTranscripts.current >= partialTranscriptPauseThreshold) {
                  finalMsg += `\n`;
                }
                emptyPartialTranscripts.current = 0;
              }
            }
            finalMsg += ` ${res.text}`;
            // write room data to the database
            setLocalStreamText(finalMsg);
            // replace the global object with new object
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
            // Reconnect to the WebSocket server if necessary
            if (event.code === 1009) {
              console.log("Reconnecting to the WebSocket server...");
              toast.error("Reconnecting 1009");
            }
          };
          newSocket.onopen = async () => {
            const audioContext = new AudioContext();

            // Get local audio stream
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            const audioIn_01 = audioContext.createMediaStreamSource(audioStream);
            console.log("Local audio stream tracks:", audioStream.getTracks());

            // Get remote audio streams
            const remoteAudioSources: MediaStreamAudioSourceNode[] = [];
            remoteStreams.forEach((remoteStream) => {
              if (remoteStream) {
                const audioIn = audioContext.createMediaStreamSource(remoteStream);
                remoteAudioSources.push(audioIn);
                console.log("Tracks for remote stream:", remoteStream.getTracks());
              }
            });

            // Create a destination to combine all audio sources
            const dest = audioContext.createMediaStreamDestination();
            audioIn_01.connect(dest);
            remoteAudioSources.forEach((source) => source.connect(dest));

            toast.dismiss();
            toast.success("Recording started");

            setStatus("RECORDING");

            const combinedStream = dest.stream;
            setStream(combinedStream);
            console.log("Combined stream tracks:", combinedStream.getTracks());

            let recorder = new MediaRecorder(combinedStream);

            let audioChunks: BlobPart[] | undefined = [];
            recorder.ondataavailable = (e) => {
              audioChunks.push(e.data);
            };

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
              mimeType: "audio/webm;codecs=pcm", // endpoint requires 16bit PCM audio
              recorderType: StereoAudioRecorder,
              timeSlice: 250, // set 250 ms intervals of data that sends to AAI
              desiredSampRate: 16000,
              numberOfAudioChannels: 1, // real-time requires only one channel
              bufferSize: 16384,
              audioBitsPerSecond: 128000,
              ondataavailable: (blob) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const base64data = reader.result as string;
                  if (socket) {
                    if (typeof base64data == "string") {
                      if (
                        JSON.stringify({
                          audio_data: base64data?.split("base64,")[1],
                        }).length < 130000
                      ) {
                        socket.current?.send(
                          JSON.stringify({
                            audio_data: base64data?.split("base64,")[1],
                          })
                        );
                      } else {
                        console.log("Unnecessary big message");
                      }
                    }
                  }
                };
                reader.readAsDataURL(blob);
              },
            });
            setRecorder(localRecorder);
            localRecorder.startRecording();
          };
        } catch (error) {
          toast.dismiss();
          toast.error("error while starting " + error);
          console.error(error);
        }
      }
    }else{
      toast.error("Please enter a role")
    }
  };

  const stop = () => {
    console.log("Stopping");
    if (status == "RECORDING") {
      if (socket) {
        socket.current?.send(JSON.stringify({ terminate_session: true }));
        socket.current?.close();
        console.log("socketconnection closed 1");
        socket.current = null;
      }
      if (recorder) {
        recorder.stopRecording();
        setRecorder(null);
      }
      if (mediaRecorderforFile.current) {
        mediaRecorderforFile.current.stop(); // Stop the MediaRecorder instance
      }
      setStatus("STOPPED");
      showWarningToast("Recording stopped");
    }
  };

  return (
    <div>
      <div className="mb-8">
        <input
          placeholder="Role"
          onChange={(e) => setRole(e.target.value)}
          className="p-2 placeholder:text-gray-300 border text-center border-gray-300 rounded-md w-[300px] max-w-full"
        />
      </div>
      <div className="md:flex-row flex-col flex gap-2 mx-auto justify-center items-center">
        <button onClick={run} disabled={!callId} className="disabled:bg-green-200 bg-green-500 disabled:cursor-not-allowed p-5 mx-5">
          Start Recording
        </button>
        <button onClick={stop} disabled={!callId} className="disabled:bg-green-200 bg-green-500 disabled:cursor-not-allowed p-5 mx-5">
          Stop Recording
        </button>
      </div>
    </div>
  );
};

export default RealTimeTranscript;
