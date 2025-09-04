import { GenerateContentResponse } from "@google/genai";
import { getState } from "./state";
import { projectLaunchPlannerPrompt, getBreakdownPrompt, getInCardChatPrompt } from "./prompts";
import { DetailedCardData } from "./state";

export async function generateLaunchPlan(projectDescription: string): Promise<Omit<DetailedCardData, 'completed' | 'subSteps' | 'chatHistory' | 'currentChatQuery' | 'isExpanded'>[]> {
    const { ai } = getState();
    if (!ai) {
        throw new Error("AI client is not initialized.");
    }

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: projectDescription,
        config: {
            systemInstruction: projectLaunchPlannerPrompt,
            responseMimeType: "application/json",
        }
    });

    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
        jsonStr = match[2].trim();
    }

    return JSON.parse(jsonStr);
}

export async function breakDownStep(card: DetailedCardData): Promise<{ instruction: string }[]> {
    const { ai } = getState();
    if (!ai) {
        throw new Error("AI client is not initialized.");
    }

    const systemInstruction = getBreakdownPrompt(card.title, card.content);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Break down the task: "${card.title}" into detailed, how-to steps.`,
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
        }
    });

    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
        jsonStr = match[2].trim();
    }

    return JSON.parse(jsonStr);
}

export async function getInCardChatResponse(card: DetailedCardData, userQuery: string): Promise<string> {
    const { ai } = getState();
    if (!ai) {
        throw new Error("AI client is not initialized.");
    }

    const systemInstruction = getInCardChatPrompt(card.title, card.content, userQuery);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userQuery,
        config: { systemInstruction: systemInstruction }
    });

    return response.text;
}
