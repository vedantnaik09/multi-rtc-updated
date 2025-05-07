const Groq = require("groq-sdk");

export const runtime = "edge";

type Message = {
  msgId: string;
  roomId: string;
  content: string;
  yoe: string;
  role: string;
};

export async function POST(req: Request) {
  const humanMessage: Message = await req.json();
  const interviewTranscript = humanMessage?.content;
  let YOE = humanMessage?.yoe || "moderate";
  let role = humanMessage?.role;

  const groq = new Groq({
    apiKey: process.env.NEXT_PUBLIC_GROK_API_KEY,
  });

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `
For the given job role ${role}, below provided is the conversation snippet from an interview transcript between an interviewer and a candidate. 
All you have to do is to identify any questions, scenario based questions, or coding challenges asked by the interviewer from this transcript. 

If you found a question or scenario based question or coding challenge,  then generate the response in the given JSON format:
  {"questionFound": "true", "questionType": "question"/"scenario"/"coding challenge", "question": "List the question asked by the interviewer"}. 
  Note: Please specify in the Question type field whether the identified item is a "question", "scenario", or "coding challenge".

  If no questions are found in transcript snippet, then generate the response in this JSON format: {"questionFound": "false"}.

Here's the transcript:
        `,
      },
      {
        role: "user",
        content: "TRANSCRIPT: " + interviewTranscript,
      },
    ],
    model: "mixtral-8x7b-32768",
  });

  const response = completion.choices[0]?.message?.content;
  console.log("response = ", response);
  return Response.json({ llmoutput: response });
}