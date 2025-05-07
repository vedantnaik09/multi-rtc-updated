"use client";
import React, { useState, useEffect } from "react";
import { firestore } from "../app/firebaseConfig";
import Image from "next/image";
import axios from "axios";
import toast from "react-hot-toast";

const sendSS = async (imageUrl: string, callId: string) => {
  try {
    const response = await axios.post("/api/screenshotAnalysis", {
      imageUrl: imageUrl,
      callId: callId,
    });
    console.log(response.data);
    toast.success("Screenshot sent for analysis");
  } catch (error) {
    console.error("Error sending screenshot:", error);
    toast.error("Failed to send screenshot for analysis");
  }
};

const ScreenshotView = ({ callId }: { callId: string }) => {
  const [responses, setResponses] = useState<any[]>([]);

  useEffect(() => {
    if (callId) {
      const unsubscribe = firestore
        .collection("calls")
        .doc(callId)
        .collection("screenshotLinks")
        .orderBy("timestamp", "desc")
        .onSnapshot((snapshot) => {
          const newResponses = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setResponses(newResponses);
        });
      return () => unsubscribe();
    }
  }, [callId]);

  return (
    <div className={`container mx-auto p-4 ${responses.length !== 0 ? '' : 'hidden'}`}>
      <h1 className="text-2xl font-bold mb-4">Response Viewer</h1>
      {responses.map((response) => (
        <div key={response.id} className="p-4 rounded shadow-lg w-fit mx-auto my-3 border border-black">
          <button 
            className="px-4 py-2 mb-4 rounded-md gap-2 bg-green-500 text-white"
            onClick={() => sendSS(response.url, callId)}
          >
            Send for analysis
          </button>
          <div className="mb-4 w-fit">
            <Image src={response.url} alt="Screenshot" width={400} height={400} sizes="100vw" quality={100} className="rounded w-[1000px] h-auto" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default ScreenshotView;