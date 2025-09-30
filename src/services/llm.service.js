import { GoogleGenerativeAI } from '@google/generative-ai';

// Google Generative AI client Initialization with API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL });

const generationConfig = {
    responseMimeType: "application/json",
};


/**
 * Takes a user's goal and an optional conversation history to generate or refine a structured task plan.
 * @param {string} userPrompt - The user's latest goal or refinement.
 * @param {Array} [history=[]] - The previous turns of the conversation.
 * @returns {Promise<object>} - An object containing the AI's plan and the updated conversation history.
 */
export const generateOrRefineTasks = async (userPrompt, history = []) => {

    const fullPrompt = `
        You are a project planning assistant for an application called "Eagle Tasks".
        Your task is to take a user's goal or refinement and generate a clear, actionable plan.

        The user's request is: "${userPrompt}"

        Based on this, generate or update the list of main tasks and relevant sub-tasks.
        Assign a reasonable 'dueDate' for each main task relative to today's date (${new Date().toISOString()}).
        Assign a 'priority' for each task ('Low', 'Medium', or 'High').
        Also, generate a list of 1-3 relevant 'tags' for each task as an array of strings.

        IMPORTANT: Do not generate more than ${process.env.MAX_AI_TASKS} main tasks.
                
        You MUST respond with ONLY a valid JSON object in the following format. Do not include any other text, explanations or markdown formatting.
        The JSON format is:
        {
          "tasks": [
            {
              "title": "Task Title",
              "description": "A brief description of the task.",
              "dueDate": "YYYY-MM-DDTHH:mm:ss.sssZ",
              "priority": "High",
              "tags": [ "planning", "research" ]
              "subTasks": [
                { "text": "First sub-task" },
                { "text": "Second sub-task" }
              ]
            }
          ]
        }
    `;
    let attempt = 0;
    const MAX_ATTEMPTS = 3;
    while(attempt < MAX_ATTEMPTS){
        try {
          const chat = model.startChat({
              history,
              generationConfig,
          });
          const result = await chat.sendMessage(fullPrompt);
          const response = result.response;

          const plan = JSON.parse(response.text());
        // Return both the plan and the full conversation history for the next turn

          return {
            plan,
            history: await chat.getHistory(),
        };
    } catch (error) {
        attempt++;
        if (attempt >= MAX_ATTEMPTS){
          console.error("AI service failed after multiple attempts:", error);
          throw new Error('Failed to generate task plan from AI service.');
        }
        console.log(`AI service attempt ${attempt} failed, retrying...`);
      }
    }
};




/**
 * Takes a user's high-level goal and uses the Gemini API to generate a structured list of tasks.
 * @param {string} userPrompt - The user's goal, e.g., "Plan my trip to Japan for next month".
 * @returns {Promise<object>} - A JSON object containing an array of tasks.
 */
export const generateTasksFromPrompt = async (userPrompt) => {
    // --- This is the Prompt Engineering part ---
    const fullPrompt = `
        You are a world-class project planning assistant for an application called "Eagle Tasks".
        Your task is to take a user's goal and break it down into a clear, actionable plan.

        The user's goal is: "${userPrompt}"

        Based on this goal, generate a list of main tasks and relevant sub-tasks.
        Assign a reasonable 'dueDate' for each main task relative to today's date (${new Date().toISOString()}).
        Assign a 'priority' for each task ('Low', 'Medium', or 'High').
        
        You MUST respond with ONLY a valid JSON object in the following format. Do not include any other text, explanations, or markdown formatting.

        The JSON format is:
        {
          "tasks": [
            {
              "title": "Task Title",
              "description": "A brief description of the task.",
              "dueDate": "YYYY-MM-DDTHH:mm:ss.sssZ",
              "priority": "High",
              "subTasks": [
                { "text": "First sub-task" },
                { "text": "Second sub-task" }
              ]
            }
          ]
        }
    `;

    try {
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        // Clean the response to ensure it's a valid JSON string
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        // Parse the JSON string into an object
        return JSON.parse(cleanedText);
    } catch (error) {
        console.error("Error generating tasks from Gemini API:", error);
        throw new Error('Failed to generate task plan from AI service.');
    }
};

