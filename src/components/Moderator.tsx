"use client";
import React, { useState, useEffect, useRef } from "react";
import { firestore, firebase, database } from "../app/firebaseConfig";
import toast from "react-hot-toast";
import { sendTranscriptTo_Chatgpt4O_AndPushInDatabase } from "@/utils/sendTranscript";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/authContext";
import Login from "@/components/Login";
import dynamic from "next/dynamic";

const AudioRecordingDialog = dynamic(() => import('../components/AudioRecordingDialog'), { ssr: false });

const Moderator : React.FC<{selectedCallId: string;}>= ({ selectedCallId }) => {
  const { user } = useAuth();
  const [callIds, setCallIds] = useState<string[]>([]);
  const [callTranscripts, setCallTranscripts] = useState<string[]>([]);
  const [selectedText, setSelectedText] = useState("");
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupPosition, setPopupPosition] = useState({
    left: "0px",
    top: "0px",
  });

  const transcriptEndRef = useRef<HTMLDivElement>(null);


  const fetchTranscripts = async (callId: string) => {
    try {
      const databaseRef = database.ref(`flowofwords/${callId}/messages`);
      const snapshot = await databaseRef.once("value");
      const data = snapshot.val();
      const transcriptsData: any[] = [];
      if (data) {
        for (const key in data) {
          transcriptsData.push(data[key]);
        }
      }

      // Fetch call transcripts
      const transcriptRef = database.ref(`flowofwords/${callId}/transcript`);
      const transcriptSnapshot = await transcriptRef.once("value");
      const transcriptData = transcriptSnapshot.val();
      const callTranscriptArray = transcriptData ? (Object.values(transcriptData) as string[]) : [];
      setCallTranscripts(callTranscriptArray);

      // Listen for new transcripts
      transcriptRef.on("child_added", (snapshot) => {
        const newTranscript = snapshot.val();
        setCallTranscripts((prevTranscripts) => [...prevTranscripts, newTranscript]);
      });
    } catch (error) {
      console.error("Error fetching transcripts:", error);
    }
  };

  useEffect(() => {
    if (selectedCallId) {
      fetchTranscripts(selectedCallId);
    }
  }, [selectedCallId]);

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [callTranscripts]);

  const handleTextSelection = (event: any) => {
    const text = window.getSelection()?.toString().trim();
    console.log(event);
    if (text) {
      const selection = window.getSelection()?.getRangeAt(0);
      const rect = selection?.getBoundingClientRect();
      console.log(rect);

      // Access the id of the clicked element using event.target.id
      const clickedElementId = event.target.id;
      console.log("Clicked Element ID:", clickedElementId);

      setPopupPosition({
        left: rect?.left + "px",
        top: rect?.bottom + "px",
      });
      setSelectedText(text);
      console.log("here");
      setPopupVisible(true);
    } else {
      setTimeout(() => {
        setPopupVisible(false);
      }, 1000);
    }
  };

  async function sendToChatgptAndPushInDatabase() {
    try {
      if (!selectedText) {
        toast("No text selected");
        return;
      }
      toast("Asking AI. pls wait");
      sendTranscriptTo_Chatgpt4O_AndPushInDatabase(selectedCallId, selectedText, "1");
    } catch (err) {
      console.log("error while writing data to room or chatgpt response is not a json:", err);
    }
  }

  useEffect(() => {
    document.addEventListener("mouseup", handleTextSelection);
    return () => {
      document.removeEventListener("mouseup", handleTextSelection);
    };
  }, []);

  if (!user) {
    return(<Login/>)
  }

  if (user)
    return (
      <div className="h-full w-full bg-gray-100 p-6">
        {popupVisible && (
          <div
            id="popup"
            className={` absolute bg-green-500 z-40 px-3 py-2 rounded-md border-2 border-green-700 shadow-md cursor-pointer`}
            style={{ left: popupPosition.left, top: popupPosition.top }}
            onClick={sendToChatgptAndPushInDatabase}
            onBlur={() => {
              console.log("onblur");
              setPopupVisible(false);
            }}
          >
            <p className=" text-sm text-green-900">Answer this</p>
          </div>
        )}
        <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg p-6">
          <h1 className="text-2xl font-bold mb-4 text-gray-800">Moderator Page</h1>
          <div className="mt-6">
            <h2 className="text-lg font-bold mb-2 text-gray-800">Transcripts</h2>
            <div className="bg-gray-50 p-4 rounded-lg shadow-inner overflow-y-auto h-[70vh]">
              {callTranscripts.map((transcript, index) => (
                <p key={`transcript-${index}`} className="text-gray-600 mb-2">
                  {transcript}
                </p>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        </div>
      </div>
    );
};

export default Moderator;
