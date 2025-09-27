"use client";
import React, { useState, useEffect, Suspense } from "react";
import { firestore } from "../firebaseConfig";
import Image from "next/image";
import AuthWrapper from "@/components/AuthWrapper";

const Page = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthWrapper>
        <CodeView />
      </AuthWrapper>
    </Suspense>
  );
};

const CodeView = () => {
  const [callIds, setCallIds] = useState<string[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string>("");
  const [responses, setResponses] = useState<any[]>([]);

  useEffect(() => {
    // Set up real-time listener for callIds
    const unsubscribe = firestore.collection("calls").onSnapshot((snapshot) => {
      const ids = snapshot.docs.map((doc) => doc.id);
      setCallIds(ids);
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedCallId) {
      // Set up real-time listener for responses
      const unsubscribe = firestore
        .collection("calls")
        .doc(selectedCallId)
        .collection("responses")
        .orderBy("timestamp", "desc")
        .onSnapshot((snapshot) => {
          const newResponses = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setResponses(newResponses);
        });

      // Cleanup listener on unmount or when selectedCallId changes
      return () => unsubscribe();
    }
  }, [selectedCallId]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Response Viewer</h1>
      <select className="w-full p-2 mb-4 border rounded" value={selectedCallId} onChange={(e) => setSelectedCallId(e.target.value)}>
        <option value="">Select a Call ID</option>
        {callIds.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>

      {responses.map((response) => (
        <div key={response.id} className="mb-8 p-4 border rounded shadow-lg w">
          <div className="mb-4">
          <Image src={response.imageUrl} alt="Screenshot" width={400} height={400} sizes="100vw" quality={100} className="rounded mx-auto w-[1100px] h-auto" />
          </div>
          <div className="bg-gray-100 p-4 rounded">
            <h2 className="text-xl font-semibold mb-2">Response:</h2>
            <pre className="whitespace-pre-wrap">{response.content}</pre>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Page;
