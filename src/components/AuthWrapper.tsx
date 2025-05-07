"use client";

import { useAuth } from "@/context/authContext";
import Login from "@/components/Login";
import React from "react";

interface AuthWrapperProps {
  children: React.ReactNode;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (user?.email!="admin@gmail.com") {
    return <Login />;
  }else{
    console.log(user)
  }

  return <>{children}</>;
};

export default AuthWrapper;