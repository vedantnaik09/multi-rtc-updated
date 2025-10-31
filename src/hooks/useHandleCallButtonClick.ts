import { useUnifiedJoin } from "./useUnifiedJoin";

/**
 * HOST JOIN HOOK - Uses Unified System
 * 
 * This hook is for users creating/joining calls via /host page.
 * It uses the same connection logic as meet users via useUnifiedJoin.
 * 
 * The only difference: can generate new call IDs if none exists.
 */
export const useHandleCallButtonClick = (
  setInCall: any,
  hangupButtonRef: React.RefObject<HTMLButtonElement | null>,
  generateShortId: () => string,
  setCallId: any,
  pathname: string,
  replace: any,
  callInputRef: React.RefObject<HTMLInputElement | null>,
  setMyIndex: any,
  setIsHost: any,
  servers: any,
  setPcs: any,
  localStreamRef: { current: MediaStream | null },
  setRemoteStreams: any,
  setNameList: any,
  myName: string,
  setAfterCall: any
) => {
  const { joinCall } = useUnifiedJoin();

  const handleCallButtonClick = async () => {
    
    // Check if there's already a call ID in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const existingCallId = urlParams.get('id');
    
    let callId: string;
    
    if (existingCallId && existingCallId.trim()) {
      // Join existing call as host (same as any other user)
      callId = existingCallId;
    } else {
      // Generate new call ID for new call
      callId = generateShortId();
    }

    // Set host flag (only UI difference)
    setIsHost(true);

    // Use unified join logic - exactly the same as meet users
    await joinCall({
      callId,
      myName,
      setInCall,
      setCallId,
      setMyIndex,
      hangupButtonRef,
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

  };

  return { handleCallButtonClick };
};