"use client";
import Login from "@/components/Login";
import React, { useEffect } from "react";
import { useAuth } from "@/context/authContext";
import {  useRouter } from "next/navigation";

const Page = () => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace("/host");
    }
  }, [loading, user, router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return null; 
};

export default Page;