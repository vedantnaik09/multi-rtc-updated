"use client";
import React, { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { FaMicrophone, FaMicrophoneAltSlash, FaVideo, FaVideoSlash, FaCopy, FaDesktop, FaPhoneSlash } from "react-icons/fa";
import { MdOutlineStopScreenShare } from "react-icons/md";
import { toast } from "react-hot-toast";
import { auth } from "../firebaseConfig";
import { useAuth } from "@/context/authContext";
import NameDialog from "@/components/NameDialog";

// Import all the hooks
import {
  useWebRTCState,
  useScreenShareState,
  useWebRTCHelpers,
  useHangupEffect,
  useIceConnectionStateChange,
  useRemoteVideoRefsEffect,
  useMeetWebRTCInitEffect,
  useStreamEffect,
  useDebugEffect,
  useMeetAuthEffect,
  useMediaControlsMeet,
  useScreenShare,
  useStartWebcam,
  useHangup,
  useHandleAnswerButtonClickMeet
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
  const [myName, setMyName] = useState<string | null>(null);

  return <Suspense fallback={<div>Loading...</div>}>{myName ? <PageContent myName={myName} /> : <NameDialog setMyName={setMyName} />}</Suspense>;
};

const PageContent: React.FC<{ myName: string }> = ({ myName }) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  // Initialize all state using hooks
  const {
    isClient,
    setIsClient,
    inCall,
    setInCall,
    callId,
    setCallId,
    webcamButtonRef,
    callInputRef,
    answerButtonRef,
    hangupButtonRef,
    webcamVideoRef,
    pcs,
    setPcs,
    myIndex,
    setMyIndex,
    remoteVideoRefs,
    setRemoteVideoRefs,
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

  // Initialize screen share state
  const {
    isScreenSharing,
    setIsScreenSharing,
    screenStreamFeed,
    setScreenStreamFeed
  } = useScreenShareState();

  // Initialize helpers
  const { servers } = useWebRTCHelpers();

  // Initialize auth hook
  const { user, loading } = useAuth();

  // Initialize action hooks
  const { hangup } = useHangup(
    callId,
    myIndex,
    pcs,
    setRemoteStreams,
    setRemoteVideoRefs,
    setPcs
  );

  const { handleAnswerButtonClick } = useHandleAnswerButtonClickMeet(
    setInCall,
    hangupButtonRef,
    searchParams,
    setCallId,
    pathname,
    replace,
    callInputRef,
    setMyIndex,
    setAfterCall,
    afterCall,
    servers,
    localStreamRef,
    setRemoteStreams,
    setNameList,
    setPcs,
    setBeforeCall,
    beforeCall,
    answerButtonRef,
    myName
  );

  // Initialize media controls
  const { handleMicToggle, handleVideoToggle, copyLink } = useMediaControlsMeet(
    micEnabled,
    setMicEnabled,
    videoEnabled,
    setVideoEnabled,
    stream,
    webcamVideoRef,
    pcs,
    localStreamRef
  );

  // Initialize screen share functionality
  const { startScreenShare, stopScreenShare, handleScreenShare, mergeAudioStreams } = useScreenShare(
    isScreenSharing,
    setIsScreenSharing,
    screenStreamFeed,
    setScreenStreamFeed,
    pcs,
    webcamVideoRef,
    stream,
    callId,
    beforeCall
  );

  // Initialize start webcam
  const { startWebcam } = useStartWebcam(
    setStream,
    setAccessGiven,
    webcamVideoRef,
    answerButtonRef,
    webcamButtonRef,
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

  useMeetWebRTCInitEffect(
    setIsClient,
    setStream,
    setAccessGiven,
    setVideoEnabled,
    setMicEnabled,
    webcamVideoRef,
    answerButtonRef,
    webcamButtonRef,
    pcs,
    searchParams,
    setCallId,
    callInputRef,
    handleAnswerButtonClick,
    stream,
    localStreamRef
  );

  useStreamEffect(stream, webcamVideoRef);
  useDebugEffect(pcs, nameList || []);
  useMeetAuthEffect(
    user,
    webcamButtonRef,
    answerButtonRef,
    startWebcam,
    handleAnswerButtonClick
  );

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

  // Set up button event listeners
  useEffect(() => {
    if (webcamButtonRef.current) {
      webcamButtonRef.current.onclick = startWebcam;
    }
    if (answerButtonRef.current) {
      answerButtonRef.current.onclick = handleAnswerButtonClick;
    }
  }, [startWebcam, handleAnswerButtonClick]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Multi-RTC Meeting
          </h1>
          <div className="flex items-center gap-4">
            <div className={`px-3 py-1 rounded-lg text-sm font-medium ${
              inCall ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-600 border border-gray-200'
            }`}>
              {inCall ? 'Connected' : 'Not Connected'}
            </div>
            {accessGiven && (
              <div className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-lg text-sm">
                Camera Ready
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Control Panel */}
        {accessGiven && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-lg">
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
                  onClick={handleScreenShare} 
                  className={`p-3 rounded-lg transition-colors ${
                    isScreenSharing 
                      ? "bg-blue-50 text-blue-600 hover:bg-blue-100" 
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
                >
                  {isScreenSharing ? <FaDesktop size={18} /> : <MdOutlineStopScreenShare size={18} />}
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
            </div>
          </div>
        )}

        {/* Video Grid - Dynamic based on participant count */}
        <div className={`grid gap-4 pb-24 ${
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
              {isScreenSharing && (
                <div className="bg-purple-100 p-1 rounded border border-purple-200">
                  <FaDesktop size={10} className="text-purple-600" />
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
          <div className="pb-24 text-center">
            <div className="inline-flex items-center px-4 py-2 bg-gray-100 rounded-lg">
              <span className="text-gray-600 text-sm">Share the meeting link to invite participants</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Page;