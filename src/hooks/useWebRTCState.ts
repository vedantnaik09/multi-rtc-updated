import { useState, useRef } from "react";

export const useWebRTCState = () => {
  const [isClient, setIsClient] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [callId, setCallId] = useState<string>();
  const [isHost, setIsHost] = useState(false);
  const webcamButtonRef = useRef<HTMLButtonElement>(null);
  const callButtonRef = useRef<HTMLButtonElement>(null);
  const callInputRef = useRef<HTMLInputElement>(null);
  const answerButtonRef = useRef<HTMLButtonElement>(null);
  const hangupButtonRef = useRef<HTMLButtonElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const duplicateVideoRef = useRef<HTMLVideoElement>(null);
  const [pcs, setPcs] = useState<RTCPeerConnection[]>([]);
  const [myIndex, setMyIndex] = useState<number>();
  const [remoteVideoRefs, setRemoteVideoRefs] = useState<(React.RefObject<HTMLVideoElement> | null)[]>([]);
  const [nonNullRemoteVideoRefs, setNonNullRemoteVideoRefs] = useState<(React.RefObject<HTMLVideoElement> | null)[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<(MediaStream | null)[]>([]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [accessGiven, setAccessGiven] = useState(false);
  const [nameList, setNameList] = useState<string[]>([]);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [beforeCall, setBeforeCall] = useState(0);
  const [afterCall, setAfterCall] = useState(0);
  const [callLeft, setCallLeft] = useState(0);

  return {
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
    setCallLeft,
  };
};