import React, { useState, useRef, useEffect } from "react";
import RecordRTC, { StereoAudioRecorder } from "recordrtc";
import { database, firestore } from "../app/firebaseConfig";
import { push, ref } from "firebase/database";
import toast from "react-hot-toast";
import { sendTranscriptTo_GROQ_AndPushInDatabase } from "@/utils/sendTranscript";

interface Props {
  callId?: string;
}

const AudioRecordingDialog: React.FC<Props> = ({ callId }) => {
  const [status, setStatus] = useState<"RECORDING" | "STOPPED">("STOPPED");
  const [transcript, setTranscript] = useState<string>("");
  const [role, setRole] = useState<string>(""); // State for role selection
  const socket = useRef<WebSocket | null>(null);
  const recorder = useRef<RecordRTC | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const currentCallId = useRef(callId);
  const statusRef = useRef<"RECORDING" | "STOPPED">("STOPPED");

  const finalTextsGlobal = useRef<Record<string, string>>({});
  const currentPauseTime = useRef<number>(0);
  const pauseDetected = useRef<boolean>(false);
  const emptyPartialTranscripts = useRef<number>(0);
  const hasInitializedWebSocket = useRef(false);

  const partialTranscriptPauseThreshold = 20;

  useEffect(() => {
    currentCallId.current = callId;
  }, [callId]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const fetchRole = async () => {
      if (!callId) return;
      const callDocHost = firestore.collection("calls").doc(callId);
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
  }, [callId]); // Trigger fetchRole when callId changes

  const updateTranscriptInDatabase = (value: string) => {
    const messagesRef = ref(database, "flowofwords/" + currentCallId.current + "/transcript");
    push(messagesRef, value).then(() => console.log("transcript pushed in database"));
  };

  const sendTranscriptWithToast = async (roomId: string, value: string, role: string, yoe: string) => {
    try {
      const answered = await sendTranscriptTo_GROQ_AndPushInDatabase(roomId, value, role, yoe);
      if (answered) {
        toast.success("Successfully answered");
      } else {
        toast.error("No question detected, unable to answer.");
      }
    } catch (err) {
      toast.error("Error receiving the response");
      console.error("Error in sendTranscriptWithToast:", err);
    }
  };

  const handleWebSocketMessage = (message: MessageEvent) => {
    const res = JSON.parse(message.data);
    let finalMsg = "";
    const finalTexts = finalTextsGlobal.current;

    if (res.message_type === "FinalTranscript") {
      stopRecording();
      if (pauseDetected.current) {
        finalTexts[`${currentPauseTime.current}-${res.audio_start}`] = `\n${res.text}`;
        updateTranscriptInDatabase(res.text);
        sendTranscriptWithToast(currentCallId.current!, res.text, role, "1"); // Use selected role
        pauseDetected.current = false;
      } else {
        finalTexts[`${currentPauseTime.current}-${res.audio_start}`] = res.text;
      }
    } else {
      if (res.text === "") {
        emptyPartialTranscripts.current += 1;
        pauseDetected.current = true;
      } else {
        if (emptyPartialTranscripts.current >= partialTranscriptPauseThreshold) {
          finalMsg += "\n";
        }
        emptyPartialTranscripts.current = 0;
      }
    }

    const keys = Object.keys(finalTexts).sort((a, b) => Number(a) - Number(b));
    for (const key of keys) {
      if (finalTexts[key]) {
        finalMsg += ` ${finalTexts[key]}`;
      }
    }
    finalMsg += ` ${res.text}`;

    setTranscript(finalMsg);
    finalTextsGlobal.current = finalTexts;
  };

  const startRecording = async () => {
    if (!role) {
      toast.error("Please select a role before starting the recording.");
      return; // Prevent recording from starting
    }

    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.current = audioStream;

    const localRecorder = new RecordRTC(audioStream, {
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
          if (socket.current && socket.current.readyState === WebSocket.OPEN) {
            const audioData = base64data.split("base64,")[1];
            const message = JSON.stringify({ audio_data: audioData });
            if (message.length < 130000) {
              socket.current.send(message);
            } else {
              console.log("Message too large, skipping");
            }
          }
        };
        reader.readAsDataURL(blob);
      },
    });

    recorder.current = localRecorder;
    localRecorder.startRecording();
    setStatus("RECORDING");
  };

  const stopRecording = () => {
    if (statusRef.current === "RECORDING") {
      if (recorder.current) {
        recorder.current.stopRecording(() => {
          const blob = recorder.current?.getBlob();
          if (blob) {
            console.log("Recording stopped, blob created:", blob);
          }
          recorder.current = null;
        });
      }
      if (stream.current) {
        stream.current.getTracks().forEach((track) => track.stop());
        stream.current = null;
      }
      setStatus("STOPPED");
    }
  };

  useEffect(() => {
    if (!hasInitializedWebSocket.current) {
      initWebSocket();
      hasInitializedWebSocket.current = true;
    }
    return () => {
      if (socket.current) {
        socket.current.close();
      }
    };
  }, []);

  const initWebSocket = async () => {
    try {
      toast.loading("Connecting to websocket");
      const response = await fetch("/api/getToken", { method: "POST" });
      const data = await response.json();
      if (data.error) {
        alert(data.error);
        return;
      }

      const { token } = data;
      const url = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`;
      const newSocket = new WebSocket(url);

      newSocket.onopen = () => {
        console.log("WebSocket connected");
        toast.dismiss();
        toast.success("Connected");
      };
      newSocket.onmessage = handleWebSocketMessage;
      newSocket.onerror = (event) => console.error("WebSocket error:", event);
      newSocket.onclose = () => {
        console.log("WebSocket disconnected");
        initWebSocket();
      };

      socket.current = newSocket;
    } catch (error) {
      console.error("Error initializing WebSocket:", error);
      alert("Error initializing WebSocket");
    }
  };

  return (
    <div className="">
      <div className="flex mx-auto gap-2 justify-center">
        <div className="my-4">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="p-2 border text-center border-gray-300 rounded-md"
          >
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
        <button onClick={status === "STOPPED" ? startRecording : stopRecording} className="bg-blue-500 text-white p-2 rounded my-2">
          {status === "STOPPED" ? "Start Recording" : "Stop Recording"}
        </button>
        {transcript && (
        <div className="mt-2">
          <h3>Transcript:</h3>
          <p>{transcript}</p>
        </div>
      )}
      </div>
      
    </div>
  );
};

export default AudioRecordingDialog;
