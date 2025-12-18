import { GoogleGenAI } from "@google/genai";
import { Message } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API Key is missing!");
    throw new Error("API Key is missing");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateAssistantResponse = async (
  currentHistory: Message[],
  bookContext: string[],
  currentPage: number,
  onChunk: (text: string) => void
): Promise<string> => {
  const ai = getClient();
  
  // Construct the "Read So Far" context
  // We include all pages up to the current page index (0-based) inclusive.
  const pagesRead = bookContext.slice(0, currentPage + 1);
  const contextText = pagesRead.map((text, idx) => `[Page ${idx + 1}]: ${text}`).join("\n\n");

  const systemInstruction = `
    You are a strict "No-Spoiler" Reading Assistant. 
    The user is reading a book and has strictly read ONLY pages 1 to ${currentPage + 1}.
    
    Here is the content they have read so far:
    """
    ${contextText}
    """

    YOUR RULES:
    1. Answer ONLY using the information provided in the context above.
    2. Do NOT use outside knowledge about the book's plot, ending, or future characters.
    3. If the user asks about an event, character, or detail NOT present in the pages read so far, respond: "I don't have information about that yet based on the pages you've read."
    4. If asked to summarize, summarize ONLY the pages provided.
    5. If asked for a prediction, politely decline and redirect to current events.
    6. Be helpful with definitions, clarifications, and summaries of past events.
    
    Maintain a helpful, literary tone.
  `;

  // Filter messages for the chat history (excluding system messages for simplicity in this prompt structure)
  // We send the last few messages to maintain conversation context within the session.
  const recentMessages = currentHistory
    .filter(m => m.role !== 'system')
    .slice(-6) // Keep last 6 messages for context window efficiency
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const lastUserMessage = currentHistory[currentHistory.length - 1].content;

  const finalPrompt = `
    ${recentMessages}
    User: ${lastUserMessage}
    Assistant:
  `;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [{ text: finalPrompt }]
      }],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.3, // Lower temperature for more factual responses based on context
      }
    });

    let fullText = "";
    
    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        onChunk(fullText);
      }
    }
    
    return fullText;

  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I'm having trouble connecting to my knowledge base right now. Please try again.";
  }
};
