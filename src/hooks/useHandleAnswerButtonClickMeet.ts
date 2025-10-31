import { useUnifiedJoin } from "./useUnifiedJoin";

/**
 * MEET JOIN HOOK - Uses Unified System
 * 
 * This hook is for users joining existing calls via /meet page.
 * It uses the same connection logic as hosts via useUnifiedJoin.
 */
export const useHandleAnswerButtonClickMeet = (
  setInCall: any,
  hangupButtonRef: React.RefObject<HTMLButtonElement | null>,
  searchParams: URLSearchParams,
  setCallId: any,
  pathname: string,
  replace: any,
  callInputRef: React.RefObject<HTMLInputElement | null>,
  setMyIndex: any,
  setAfterCall: any,
  afterCall: number,
  servers: any,
  localStreamRef: { current: MediaStream | null },
  setRemoteStreams: any,
  setNameList: any,
  setPcs: any,
  setBeforeCall: any,
  beforeCall: number,
  answerButtonRef: React.RefObject<HTMLButtonElement | null>,
  myName: string
) => {
  const { joinCall } = useUnifiedJoin();

  const handleAnswerButtonClick = async () => {
    console.log("🎯 [MEET JOIN] Starting meet join process");
    
    // Get call ID (required for meet)
    let callId: string;
    const idFromParams = searchParams.get("id");

    if (idFromParams) {
      callId = idFromParams;
    } else if (callInputRef.current) {
      callId = callInputRef.current.value;
    } else {
      throw new Error("No call ID provided for meet join");
    }

    if (!callId.trim()) {
      throw new Error("Call ID cannot be empty");
    }

    console.log("🎯 [MEET JOIN] Joining call with ID:", callId);

    // Use unified join logic - exactly the same as host
    await joinCall({
      callId,
      myName,
      setInCall,
      setCallId,
      setMyIndex,
      hangupButtonRef,
      answerButtonRef,
      servers,
      localStreamRef,
      setRemoteStreams,
      setNameList,
      setPcs,
      setAfterCall,
      pathname,
      replace,
      callInputRef
    });

    console.log("✅ [MEET JOIN] Successfully joined call:", callId);
  };

  return { handleAnswerButtonClick };
};