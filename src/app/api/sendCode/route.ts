import { HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import admin from 'firebase-admin';

const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!serviceAccountBase64) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 is not set.');
}

export const maxDuration = 60;

const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}
const firestore = admin.firestore();

// Define the Message type
type Message = {
  imageUrl: string;
  callId: string;
};

export async function POST(req: Request) {
  const Request: Message = await req.json();

  const prompt = {
    imageUrl: Request.imageUrl,
  };

  const model = new ChatOpenAI({
    modelName: "gpt-4o",
    openAIApiKey: process.env.NEXT_GPT_4O_KEY,
    temperature: 0,
    timeout: 20000, // 20 seconds timeout
  });

  console.log("Created model");

  const message = new HumanMessage({
    content: [
      {
        type: "text",
        text: "Here is the question for an interview attached in the screenshot. Analyse the question or answer being written and generate the most appropriate code or solution for this",
      },
      {
        type: "image_url",
        image_url: {
          url: `${prompt.imageUrl}`,
        },
      },
    ],
  });

  // Send the 200 response immediately
  const response = { message: "Request is being processed" };
  const responsePromise = new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json' },
  });

  // Process the GPT model asynchronously
  model.invoke([message])
    .then((res) => {
      console.log(`Response received ${res.content}`);

      // Store the response in Firestore
      const callDocHost = firestore.collection("calls").doc(Request.callId);
      callDocHost.collection("responses").add({
        imageUrl: prompt.imageUrl,
        content: res.content,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      })
      .then(() => {
        console.log("Stored in db");
      })
      .catch((error) => {
        console.error("Error storing response: ", error);
      });
    })
    .catch((error) => {
      console.error("Error invoking model: ", error);
    });

  return responsePromise;
}
