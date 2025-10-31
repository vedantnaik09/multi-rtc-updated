"use client";
import React, { useState, useEffect, useRef } from "react";

const RealTimeTranscript: React.FC<{ callId: string | undefined; remoteStreams: (MediaStream | null)[] }> = ({ callId, remoteStreams }) => {
  const [role, setRole] = useState<string>();

  const run = async () => {
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

            const combinedStream = dest.stream;
            console.log("Combined stream tracks:", combinedStream.getTracks());

            let recorder = new MediaRecorder(combinedStream);
  };

  return (
    <div className="self-center">
      <div className="flex max-md:flex-col justify-center gap-3">
        <div className="">
          <select onChange={(e) => setRole(e.target.value)} className="p-2 border text-center border-gray-300 rounded-md">
            <option value="" disabled selected>
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
      </div>
    </div>
  );
};

export default RealTimeTranscript;