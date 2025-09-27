const Groq = require("groq-sdk");

export const runtime = "edge";

type Message = {
  itemFound: boolean;
  type: string;
  question: string;
  role: string;
};

export async function POST(req: Request) {
  const humanMessage: Message = await req.json();
  const prompt = {
    itemFound: humanMessage.itemFound,
    type: humanMessage.type,
    question: humanMessage.question,
  };
  const role = humanMessage?.role;

  const groq = new Groq({
    apiKey: process.env.NEXT_PUBLIC_GROK_API_KEY,
  });

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `Consider an interview is going on for role ${role} between interviewer and candidate. You'll get the following type of prompt:
{"questionFound": true, "questionType": "question"/"scenario"/"coding challenge", "question": "list the question asked by the interviewer"}
You should generate an answer in a casual, conversational tone appropriate for an interviewee. Keep the answers a bit detailed in nature but don't exceed it more than 300 words, make sure the answer is in first person and dont add any new lines in the answer, give the entire answer in a single paragraph. Respond with a JSON structure as follows:
{"question": "[question from prompt]", "answer": "your casual, conversational response suitable for someone for the job role ${role} should be there"}
Here is the prompt:
Note: Only include the JSON in your response. Ensure all JSON values are properly quoted strings.`,
      },
      {
        role: "user",
        content: `Prompt: ${JSON.stringify(prompt)}`,
      },
    ],
    model: "mixtral-8x7b-32768",
  });

  const response = completion.choices[0]?.message?.content;
  console.log("response = ", response);
  return Response.json({ llmoutput: response });
}