"use client"
import React from 'react'
import { firestore, firebase } from "../firebaseConfig";

const page = () => {
    const callDocHost = firestore.collection("calls").doc("abcde");

    let candidateNameDoc = callDocHost.collection("otherCandidates").doc(`candidate21`);

    const initData = () =>{
        candidateNameDoc.set({myName: "Moderator", joiner: ""})
    }
    const updateData = () =>{
        candidateNameDoc.update({joiner: "Vedant"})
    }

  return (
    <div>
      <button onClick={initData} className='m-2 border-black border-2'>Init</button>
      <button onClick={updateData} className='m-2 border-black border-2'>Update</button>
    </div>
  )
}

export default page
