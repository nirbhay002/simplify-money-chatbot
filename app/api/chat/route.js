// File: app/api/chat/route.js (Final Version - Without Tools)

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Revised prompt: Tool-related rules have been removed and a new rule for handling price questions is added.
const systemPrompt = `
You are Kuber.AI, a friendly and smart financial advisor for the "Simplify Money" app. Your user is located in India.

**CRITICAL RULES:**
1.  **If the user asks for a live price, rate, or value of any commodity like gold, you MUST state that you cannot provide live, real-time prices.** Then, you must immediately pivot the conversation to how they can invest in the digital version of that asset (like Digital Gold) using the "Wealth Bazaar" feature in the Simplify Money app.
2.  Follow the user's language (English, Hindi, or the special Hinglish->Hindi rule).
3.  Your final output MUST be a single, valid JSON object with "reply" and "language_code".

**SPECIAL HINGLISH RULE:** If the user's input is in Hinglish (Hindi written in Roman script), your response ("reply") MUST be in **pure Hindi (Devanagari script)**, and the "language_code" MUST be **"hi-IN"**.

Example (Price Question):
User: "what is the gold rate today?"
Your output:
{
  "reply": "I can't provide live market prices, but this is a great time to think about investing! You can easily buy and track Digital Gold with real-time rates directly in the 'Wealth Bazaar' section of the Simplify Money app. Would you like to know more about the benefits of Digital Gold?",
  "language_code": "en-IN"
}`;

export async function POST(req) {
  try {
    const { history, message } = await req.json();

    // We use the 'pro' model for better reasoning, even without tools.
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
    });

    // The logic is now much simpler: just send the message and get the response.
    const chat = model.startChat({ history: history });
    const result = await chat.sendMessage(message);
    const response = result.response;
    const rawResponseText = response.text();
    
    // Robustly extract the JSON object from the AI's response.
    const match = rawResponseText.match(/{.*}/s);
    const cleanedResponseText = match ? match[0] : "";

    // The safety net to validate the JSON before sending it to the front-end.
    try {
      JSON.parse(cleanedResponseText); // Validate the JSON
      return new Response(cleanedResponseText, {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.error("CRITICAL: AI returned a non-JSON response even after cleaning:", cleanedResponseText);
      const fallbackResponse = {
        reply: "I'm having a little trouble thinking right now, please try asking in a different way.",
        language_code: "en-IN"
      };
      return NextResponse.json(fallbackResponse);
    }

  } catch (error) {
    console.error("CRITICAL ERROR in POST handler:", error);
    return NextResponse.json({ 
        reply: "Sorry, a critical technical error occurred. Please try again later.",
        language_code: "en-IN"
     }, { status: 500 });
  }
}