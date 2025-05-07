"use client";
import Moderator from "@/components/Moderator";
import ViewAnswers from "@/components/ViewAnswers";
import { useState, useRef, useEffect } from "react";
import { database } from "../firebaseConfig";
import dynamic from "next/dynamic";

const AudioRecordingDialog = dynamic(() => import('../../components/AudioRecordingDialog'), { ssr: false });

const SplitPane: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(0); // Start with 0 and update on mount
  const dragging = useRef(false);
  const [callIds, setCallIds] = useState<string[]>([]);
  const [selectedCallId, setSelectedCallId] = useState("");

  useEffect(() => {
    const fetchCallIds = async () => {
      try {
        const databaseRef = database.ref("flowofwords");
        const snapshot = await databaseRef.once("value");
        const data = snapshot.val();
        const initialCallIds = new Set(data ? Object.keys(data).filter(Boolean) : []);
        setCallIds(Array.from(initialCallIds));
        setSelectedCallId(initialCallIds.values().next().value || "");

        // Listen for new call IDs
        databaseRef.on("child_added", (snapshot) => {
          const newCallId = snapshot.key;
          if (newCallId) {
            setCallIds((prevCallIds) => Array.from(new Set([...prevCallIds, newCallId])));
          }
        });
      } catch (error) {
        console.error("Error fetching call IDs:", error);
      }
    };
    fetchCallIds();
  }, []);

  // Set initial width to 50% of container width on component mount
  useEffect(() => {
    if (containerRef.current) {
      setLeftWidth(containerRef.current.offsetWidth / 2);
    }
  }, []);

  const handleMouseDown = () => {
    dragging.current = true;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging.current && containerRef.current) {
      // Limit the width within container bounds
      const newWidth = Math.min(
        containerRef.current.offsetWidth - 10, // Prevents overlapping of right pane
        Math.max(10, e.clientX) // Prevents collapsing too much
      );
      setLeftWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    dragging.current = false;
  };

  return (
    <div>
      {" "}
      <div className="mb-4 w-1/2 mx-auto my-4">
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="callIdSelect">
          Select Call ID
        </label>
        <select
          id="callIdSelect"
          value={selectedCallId}
          onChange={(e) => setSelectedCallId(e.target.value)}
          className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        >
          {callIds.map((callId, idx) => (
            <option key={`${callId}-${idx}`} value={callId}>
              {callId}
            </option>
          ))}
        </select>
      </div>
      <div
        ref={containerRef}
        className="flex" // Full screen height
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Left pane */}
        <div style={{ width: leftWidth }} className="flex-shrink-0 bg-gray-300 flex items-center justify-center">
          <Moderator selectedCallId={selectedCallId} />
        </div>

        {/* Draggable divider */}
        <div className="w-1 bg-gray-500 cursor-col-resize" onMouseDown={handleMouseDown}></div>

        {/* Right pane */}
        <div className="flex-1 flex-col flex items-center justify-center">
          <ViewAnswers  selectedCallId={selectedCallId} />
          <AudioRecordingDialog callId={selectedCallId} />
        </div>
      </div>
    </div>
  );
};

export default SplitPane;
