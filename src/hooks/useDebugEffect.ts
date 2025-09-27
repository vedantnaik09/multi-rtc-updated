import { useEffect } from "react";

export const useDebugEffect = (pcs: RTCPeerConnection[], nameList: string[]) => {
  useEffect(() => {
    console.log("PCs are ", pcs);
    console.log("Names are ", nameList);
  }, [pcs, nameList]);
};