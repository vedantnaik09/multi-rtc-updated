import { useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/app/firebaseConfig";

export const useMeetAuthEffect = (
  user: any,
  webcamButtonRef: React.RefObject<HTMLButtonElement | null>,
  answerButtonRef: React.RefObject<HTMLButtonElement | null>,
  startWebcam: () => Promise<boolean>,
  handleAnswerButtonClick: () => Promise<void>
) => {
  useEffect(() => {
    const signIn = () => {
      signInWithEmailAndPassword(auth, "12345@gmail.com", "123456"),
        {
          loading: "Signing in...",
          success: (userCredential: { user: any }) => {
            console.log("USER LOGGED IN", userCredential.user);
            return "Signed in successfully!";
          },
          error: (error: { code: any; message: any }) => {
            console.error(error.code, " ", error.message);
            return "Error signing in!";
          },
        };
    };
    if (!user) {
      signIn();
    }

    if (webcamButtonRef.current) {
      webcamButtonRef.current.onclick = startWebcam;
    }
    if (answerButtonRef.current) {
      answerButtonRef.current.onclick = handleAnswerButtonClick;
    }
  }, []);
};