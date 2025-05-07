import { HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import admin from 'firebase-admin';
import axios from 'axios';

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

async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  const base64 = Buffer.from(response.data, 'binary').toString('base64');
  return `data:${response.headers['content-type']};base64,${base64}`;
}

export async function POST(req: Request) {
  try {
    const Request: Message = await req.json();
    console.log("Image URL received:", Request.imageUrl);

    // Fetch the image and convert to base64
    const base64Image = await fetchImageAsBase64(Request.imageUrl);
    console.log("Image converted to base64");

    const model = new ChatOpenAI({
      modelName: "gpt-4o",
      openAIApiKey: process.env.NEXT_GPT_4O_KEY,
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
            url: base64Image,
          },
        },
      ],
    });

    const res = await model.invoke([message]);
    console.log(`Response received ${res.content}`);

    // Store the response in Firestore
    const callDocHost = firestore.collection("calls").doc(Request.callId);
    await callDocHost.collection("responses").add({
      imageUrl: Request.imageUrl,
      content: res.content,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log("Stored in db");

    const response = { message: res.content };
    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error processing request: ", error);
    return new Response(JSON.stringify({ error: "An error occurred while processing the request" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}