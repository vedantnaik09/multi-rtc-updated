# WebRTC Hooks

This directory contains the extracted hooks from the WebRTC components (`transcript/page.tsx` and `meet/page.tsx`). These hooks have been extracted exactly as they were in the original code to maintain all functionality.

## State Management Hooks

### `useWebRTCState()`
Contains all the main WebRTC state variables:
- Client state (`isClient`, `inCall`, `callId`, `isHost`)
- Refs for DOM elements (`webcamButtonRef`, `callButtonRef`, etc.)
- WebRTC state (`pcs`, `myIndex`, `remoteVideoRefs`, `remoteStreams`)
- Media state (`micEnabled`, `videoEnabled`, `accessGiven`)
- Stream state and counters

### `useScreenShareState()`
Contains screen sharing specific state:
- `isScreenSharing`, `screenStreamFeed`

## Helper Hooks

### `useWebRTCHelpers()`
Contains utility functions and configuration:
- `generateShortId()` - Generates random call IDs
- `servers` - STUN server configuration

## Effect Hooks

### `useWebRTCInitEffect()`
Main initialization effect for transcript page:
- Initializes webcam/microphone
- Handles video/audio disabled states
- Auto-joins calls based on URL params
- Manages session storage preferences

### `useMeetWebRTCInitEffect()`
Main initialization effect for meet page:
- Similar to above but specific to meet page flow
- No auto call creation, only joining

### `useHangupEffect()`
Listens for hangup events from Firestore and updates UI accordingly

### `useIceConnectionStateChange()`
Handles ICE connection state changes and peer disconnections

### `useRemoteVideoRefsEffect()`
Manages remote video references and assigns streams to video elements

### `useStreamEffect()`
Updates video element when stream changes (meet page specific)

### `useDebugEffect()`
Logs peer connections and name list for debugging

### `useMeetAuthEffect()`
Handles authentication and button initialization for meet page

## Media Control Hooks

### `useMediaControls()`
Contains media control functions:
- `copyLink()` - Copies meeting link to clipboard
- `handleMicToggle()` - Toggles microphone on/off
- `handleVideoToggle()` - Toggles video on/off with camera disabled placeholder

### `useScreenShare()`
Screen sharing functionality (meet page):
- `startScreenShare()`, `stopScreenShare()`, `handleScreenShare()`
- `mergeAudioStreams()` - Combines screen and microphone audio

### `useStartWebcam()`
Simple webcam initialization function for meet page

## Action Hooks

### `useHangup()`
Handles call hangup functionality:
- Updates Firestore hangup collection
- Closes peer connections
- Resets state

## Usage

These hooks are extracted exactly as they were in the original code. They can be used to replace the existing inline code in the components later for better modularity and reusability.

## Note

The hooks contain the exact same logic as the original code, including any TypeScript type annotations and error handling. Some hooks may have dependencies on specific props/state that need to be passed in when using them.