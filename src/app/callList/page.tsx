"use client";

import React, { useEffect, useState } from "react";
import { firestore, storage } from "../firebaseConfig";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { useRouter } from "next/navigation";

const CallList = () => {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const router = useRouter();

  useEffect(() => {
    const fetchCalls = async () => {
      try {
        const callsSnapshot = await firestore.collection("calls").orderBy("timestamp", "desc").get();
        const callsData = callsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCalls(callsData);

        // Fetch audio URLs for each call
        const urls: Record<string, string> = {};
        await Promise.all(
          callsData.map(async (call) => {
            const now = new Date();
            const day = String(now.getDate()).padStart(2, "0");
            const month = String(now.getMonth() + 1).padStart(2, "0"); // January is 0!
            const year = now.getFullYear();

            const dateString = `${day}-${month}-${year}`;
            const audioRef = storageRef(storage, `audio/${dateString}/${call.id}.mp3`);

            try {
              const url = await getDownloadURL(audioRef);
              urls[call.id] = url; // Map call ID to the audio URL
            } catch (error) {
              console.error(`Error fetching audio for call ${call.id}:`, error);
              urls[call.id] = ""; // If no audio found, store an empty string
            }
          })
        );

        setAudioUrls(urls);
      } catch (error) {
        console.error("Error fetching calls:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCalls();
  }, []);

  const handleCallClick = (callId: string) => {
    router.push(`/meet?id=${callId}`);
  };

  return (
    <div className="mx-auto p-5 w-full">
      <h2 className="text-2xl font-semibold my-4">Call History</h2>
      {loading ? (
        <div>Loading calls...</div>
      ) : (
        <div className="space-y-4">
          {calls.length > 0 ? (
            calls.map((call) => (
              <div
                key={call.id}
                className="p-4 rounded-lg shadow-md bg-gray-100 w-2/3 mx-auto"
              >
                <h3 className="text-lg font-medium">Call ID: {call.id}</h3>
                <p className="text-sm text-gray-600">
                  Date: {new Date(call.timestamp?.toDate()).toLocaleDateString()}{" "}
                  Time: {new Date(call.timestamp?.toDate()).toLocaleTimeString()}
                </p>
                <p className="text-sm text-gray-500">
                  Number of Connections: {call.connectedUsers || 0}
                </p>
                <div className="mt-2 flex gap-4 justify-center">
                  {/* Navigate to call */}
                  <button
                    onClick={() => handleCallClick(call.id)}
                    className="px-4 py-2 bg-green-400 text-white rounded-lg hover:bg-blue-600"
                  >
                    Join Call
                  </button>

                  {/* Download Audio */}
                  {audioUrls[call.id] ? (
                    <a
                      href={audioUrls[call.id]}
                      download={`${call.id}.mp3`}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    >
                      Play Audio
                    </a>
                  ) : (
                    <button
                      disabled
                      className="px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed"
                    >
                      No Audio Available
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div>No calls found</div>
          )}
        </div>
      )}
    </div>
  );
};

export default CallList;
