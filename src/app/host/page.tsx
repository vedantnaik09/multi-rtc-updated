"use client";
import React, { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { FaMicrophone, FaMicrophoneAltSlash, FaVideo, FaVideoSlash, FaCopy, FaCamera, FaPhoneSlash } from "react-icons/fa";
import { toast } from "react-hot-toast";
import AuthWrapper from "@/components/AuthWrapper";
import ScreenshotView from "@/components/ScreenshotView";

// Import all the hooks
import {
  useWebRTCState,
  useWebRTCHelpers,
  useHangupEffect,
  useIceConnectionStateChange,
  useRemoteVideoRefsEffect,
  useWebRTCInitEffect,
  useStreamEffect,
  useDebugEffect,
  useMediaControlsTranscript,
  useHangup,
  useHandleCallButtonClick
} from "@/hooks";

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
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthWrapper>
        <TranscriptMeet />
      </AuthWrapper>
    </Suspense>
  );
};

const TranscriptMeet = () => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const RealTimeTranscript = dynamic(() => import("./realTimeTranscript"), {
    ssr: false,
  });

  // Initialize all state using hooks
  const {
    isClient,
    setIsClient,
    inCall,
    setInCall,
    callId,
    setCallId,
    isHost,
    setIsHost,
    webcamButtonRef,
    callButtonRef,
    callInputRef,
    answerButtonRef,
    hangupButtonRef,
    webcamVideoRef,
    duplicateVideoRef,
    pcs,
    setPcs,
    myIndex,
    setMyIndex,
    remoteVideoRefs,
    setRemoteVideoRefs,
    nonNullRemoteVideoRefs,
    setNonNullRemoteVideoRefs,
    remoteStreams,
    setRemoteStreams,
    micEnabled,
    setMicEnabled,
    videoEnabled,
    setVideoEnabled,
    accessGiven,
    setAccessGiven,
    nameList,
    setNameList,
    stream,
    setStream,
    localStreamRef,
    beforeCall,
    setBeforeCall,
    afterCall,
    setAfterCall,
    callLeft,
    setCallLeft
  } = useWebRTCState();

  // Initialize helpers
  const { generateShortId, servers } = useWebRTCHelpers();

  // Initialize action hooks
  const { hangup } = useHangup(
    callId,
    myIndex,
    pcs,
    setRemoteStreams,
    setRemoteVideoRefs,
    setPcs
  );

  const { handleCallButtonClick } = useHandleCallButtonClick(
    setInCall,
    hangupButtonRef,
    generateShortId,
    setCallId,
    pathname,
    replace,
    callInputRef,
    setMyIndex,
    setIsHost,
    servers,
    setPcs,
    localStreamRef,
    setRemoteStreams,
    setNameList,
    "Host", // myName parameter - using default "Host" name
    setAfterCall // setAfterCall parameter
  );

  // Host uses unified system for both creating AND joining calls
  // No separate transcript join logic needed - handleCallButtonClick handles everything

  // Initialize media controls
  const { handleMicToggle, handleVideoToggle, copyLink } = useMediaControlsTranscript(
    micEnabled,
    setMicEnabled,
    videoEnabled,
    setVideoEnabled,
    stream,
    webcamVideoRef,
    pcs,
    localStreamRef
  );

  // Initialize effect hooks
  useHangupEffect(callId, myIndex, setRemoteVideoRefs, setRemoteStreams);
  
  const { handleIceConnectionStateChange } = useIceConnectionStateChange(
    pcs,
    beforeCall,
    callLeft,
    setRemoteVideoRefs,
    setRemoteStreams,
    setCallLeft,
    setBeforeCall,
    setAfterCall
  );

  useRemoteVideoRefsEffect(remoteStreams, remoteVideoRefs, setRemoteVideoRefs);

  useWebRTCInitEffect(
    setIsClient,
    setStream,
    setAccessGiven,
    setVideoEnabled,
    setMicEnabled,
    webcamVideoRef,
    callButtonRef,
    answerButtonRef,
    webcamButtonRef,
    pcs,
    searchParams,
    setCallId,
    callInputRef,
    handleCallButtonClick, // Use unified logic for joining existing calls
    handleCallButtonClick, // Use unified logic for creating new calls
    stream,
    localStreamRef
  );

  useStreamEffect(stream, webcamVideoRef);
  useDebugEffect(pcs, nameList || []);

  // Set up peer connection listeners
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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Multi-RTC Conference
          </h1>
          <div className="flex items-center gap-4">
            <div className={`px-3 py-1 rounded-lg text-sm font-medium ${
              inCall ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-600 border border-gray-200'
            }`}>
              {inCall ? 'Connected' : 'Not Connected'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Control Panel */}
        <div className="mb-8 flex justify-center">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row items-center gap-6">
              {/* Media Controls */}
              <div className="flex gap-3">
                <button 
                  onClick={handleMicToggle} 
                  className={`p-3 rounded-lg transition-colors ${
                    micEnabled 
                      ? "bg-gray-100 text-gray-700 hover:bg-gray-200" 
                      : "bg-red-50 text-red-600 hover:bg-red-100"
                  }`}
                  title={micEnabled ? 'Mute' : 'Unmute'}
                >
                  {micEnabled ? <FaMicrophone size={18} /> : <FaMicrophoneAltSlash size={18} />}
                </button>

                <button 
                  onClick={handleVideoToggle} 
                  className={`p-3 rounded-lg transition-colors ${
                    videoEnabled 
                      ? "bg-gray-100 text-gray-700 hover:bg-gray-200" 
                      : "bg-red-50 text-red-600 hover:bg-red-100"
                  }`}
                  title={videoEnabled ? 'Stop Video' : 'Start Video'}
                >
                  {videoEnabled ? <FaVideo size={18} /> : <FaVideoSlash size={18} />}
                </button>

                <button
                  disabled={!inCall}
                  onClick={copyLink}
                  className="p-3 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Copy Link"
                >
                  <FaCopy size={18} />
                </button>

                <button
                  disabled={!inCall}
                  className="p-3 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Screenshot"
                >
                  <FaCamera size={18} />
                </button>

                <button
                  ref={hangupButtonRef}
                  disabled={!inCall}
                  onClick={hangup}
                  className="p-3 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="End Call"
                >
                  <FaPhoneSlash size={18} />
                </button>
              </div>

              {/* Real Time Transcript */}
              <div className="lg:ml-6 lg:pl-6 lg:border-l border-gray-200">
                <RealTimeTranscript callId={callId} remoteStreams={remoteStreams} />
              </div>
            </div>
          </div>
        </div>

        {/* Video Grid - Dynamic based on participant count */}
        <div className={`grid gap-4 ${
          remoteStreams.filter(stream => stream).length === 0 
            ? 'grid-cols-1 max-w-4xl mx-auto' 
            : remoteStreams.filter(stream => stream).length === 1
            ? 'grid-cols-1 md:grid-cols-2 max-w-8xl mx-auto'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}>
          {/* Local Video */}
          <div className="relative bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200">
            <div className="absolute top-3 left-3 z-10">
              <div className="bg-black/70 px-2 py-1 rounded text-xs font-medium text-white">
                You
              </div>
            </div>
            <div className="absolute top-3 right-3 z-10 flex gap-1">
              {micEnabled && (
                <div className="bg-green-100 p-1 rounded border border-green-200">
                  <FaMicrophone size={10} className="text-green-600" />
                </div>
              )}
              {videoEnabled && (
                <div className="bg-blue-100 p-1 rounded border border-blue-200">
                  <FaVideo size={10} className="text-blue-600" />
                </div>
              )}
            </div>
            {isClient && (
              <video
                id="webcamVideo"
                ref={webcamVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-video object-cover bg-gray-900"
              />
            )}
            {!isClient && (
              <div className="w-full aspect-video flex items-center justify-center bg-gray-100">
                <div className="text-gray-500 text-sm">Loading video...</div>
              </div>
            )}
          </div>

          {/* Remote Videos - Only show actual participants */}
          {remoteVideoRefs.map((_, index) => 
            remoteStreams[index] ? (
              <div
                key={index}
                className="relative bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200"
              >
                <div className="absolute top-3 left-3 z-10">
                  <div className="bg-black/70 px-2 py-1 rounded text-xs font-medium text-white">
                    {nameList && nameList[index] ? nameList[index] : `Participant ${index + 1}`}
                  </div>
                </div>
                <div className="absolute top-3 right-3 z-10">
                  <div className="bg-green-100 p-1 rounded border border-green-200">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                </div>
                {isClient && (
                  <video 
                    ref={remoteVideoRefs[index]} 
                    autoPlay 
                    playsInline 
                    className="w-full aspect-video object-cover bg-gray-900"
                  />
                )}
                {!isClient && (
                  <div className="w-full aspect-video flex items-center justify-center bg-gray-100">
                    <div className="text-gray-500 text-sm">Loading participant...</div>
                  </div>
                )}
              </div>
            ) : null
          )}
        </div>

        {/* Empty state when no participants */}
        {remoteStreams.filter(stream => stream).length === 0 && (
          <div className="mt-8 text-center">
            <div className="inline-flex items-center px-4 py-2 bg-gray-100 rounded-lg">
              <span className="text-gray-600 text-sm">Share the meeting link to invite participants</span>
            </div>
          </div>
        )}

        {/* Screenshot View */}
        {inCall && (
          <div className="mt-8">
            <ScreenshotView callId={callId!} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Page;