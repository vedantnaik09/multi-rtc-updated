import React, { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/app/firebaseConfig";
import toast from "react-hot-toast";

function Login() {
  const [userInfo, setUserInfo] = useState<{ email: string; password: string }>(
    { email: "", password: "" }
  );

  const signIn = () => {
    signInWithEmailAndPassword(auth, userInfo.email, userInfo.password)
      .then((userCredential) => {
        const user = userCredential.user;
        if (user.email === "admin@gmail.com") {
          toast.success("Signed in successfully!");
          console.log("ADMIN LOGGED IN", user);
        } else {
          toast.error("Error signing in! Only admin is allowed.");
          console.error("Unauthorized access attempt by:", user.email);
        }
      })
      .catch((error) => {
        toast.error("Error signing in!");
        console.error(error.code, " ", error.message);
      });
  };

  return (
    <div className="flex flex-col gap-6 items-center justify-center min-h-screen bg-gray-100">
      <p className="font-bold text-2xl text-center text-gray-800">
        Welcome to MultiRTC
      </p>
      <div className="flex flex-col gap-6 items-center justify-center w-full max-w-md p-8 bg-white rounded-lg border border-gray-300 shadow-md">
        <p className="text-xl font-semibold text-gray-700">Sign In</p>
        <input
          className="w-full px-4 py-2 text-gray-800 placeholder-gray-500 bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Email"
          value={userInfo.email}
          type="email"
          onChange={(e) =>
            setUserInfo((prev) => ({ ...prev, email: e.target.value }))
          }
        />
        <input
          className="w-full px-4 py-2 text-gray-800 placeholder-gray-500 bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Password"
          value={userInfo.password}
          type="password"
          onChange={(e) =>
            setUserInfo((prev) => ({ ...prev, password: e.target.value }))
          }
        />
        <button
          className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={signIn}
        >
          Login
        </button>
      </div>
    </div>
  );
}

export default Login;
