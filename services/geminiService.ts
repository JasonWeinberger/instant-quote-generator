import { GoogleGenAI, Type } from "@google/genai";
import { QuoteResult, Industry } from "../shared-types";

const quoteSchema = {
  type: Type.OBJECT,
  properties: {
    priceRange: {
      type: Type.OBJECT,
      properties: {
        low: { type: Type.NUMBER, description: "Low end of the price estimate in USD" },
        high: { type: Type.NUMBER, description: "High end of the price estimate in USD" },
      },
      required: ["low", "high"],
    },
    breakdown: {
      type: Type.OBJECT,
      properties: {
        materials: { type: Type.NUMBER, description: "Estimated cost of materials" },
        labor: { type: Type.NUMBER, description: "Estimated cost of labor" },
        disposal: { type: Type.NUMBER, description: "Estimated cost of disposal/removal" },
        misc: { type: Type.NUMBER, description: "Miscellaneous or overhead costs" },
      },
      required: ["materials", "labor", "disposal", "misc"],
    },
    timeline: { type: Type.STRING, description: "Estimated project duration (e.g., '2-3 days')" },
    customerQuote: { type: Type.STRING, description: "A friendly, professional text message or email body ready to send to the customer." },
  },
  required: ["priceRange", "breakdown", "timeline", "customerQuote"],
};

export const generateQuote = async (industry: Industry, jobDescription: string, zipCode: string): Promise<QuoteResult> => {
  // Initialize client inside function to prevent top-level crash if API key is missing at load time
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const locationString = zipCode ? `for Zip Code: ${zipCode}` : "based on US National Averages";

  const systemPrompt = `
You are a professional ${industry.toLowerCase()} estimator with 20+ years of experience in the U.S.
Your job is to analyze the customer’s job description and return a highly accurate quote ${locationString}.

1. A realistic USD price range (low and high) reflecting local labor/material rates for ${locationString}.
2. A specific cost breakdown: materials, labor, disposal/removal, misc/overhead.
3. A realistic timeline.
4. A customer-ready quote they can copy/paste.

Respond ONLY in this JSON format:

{
  "priceRange": { "low": number, "high": number },
  "breakdown": {
    "materials": number,
    "labor": number,
    "disposal": number,
    "misc": number
  },
  "timeline": "string",
  "customerQuote": "string"
}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `JOB DESCRIPTION:\n${jobDescription}`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: quoteSchema,
        temperature: 0.2, // Lower temperature for more consistent/realistic pricing
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text generated.");
    }

    const data = JSON.parse(text) as QuoteResult;
    return data;
  } catch (error) {
    console.error("Error generating quote:", error);
    throw error;
  }
};
