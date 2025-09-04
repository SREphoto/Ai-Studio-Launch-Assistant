/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { marked } from "marked";
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// --- Data for the original Deployment Guide ---
interface StaticGuideCardData {
  title: string;
  content: string; // HTML content
}

const staticGuideData: StaticGuideCardData[] = [
  {
    title: "Introduction & Critical Security Warning",
    content: `
      <h2>Purpose of This Guide</h2>
      <p>This guide provides a structured approach to developing and deploying a web application, particularly when interacting with powerful APIs like Google's Gemini. It covers essential steps from initial setup to going live, with a strong emphasis on security and best practices.</p>
      <h2><strong class="critical-warning">CRITICAL: NEVER Expose API Keys in Client-Side Code (Frontend)</strong></h2>
      <p>If your application uses an API key (like a Gemini API key), it <strong>MUST NOT</strong> be embedded directly in your frontend JavaScript code (e.g., in this <code>index.tsx</code> if it were making direct API calls in a public app) or made accessible to the browser in any way for a production application.</p>
      <h3>Why is this critical?</h3>
      <ul>
        <li><strong>Theft:</strong> Anyone can view your website's source code in their browser. If the API key is there, they can steal it.</li>
        <li><strong>Abuse:</strong> A stolen API key can be used by malicious actors to make unauthorized calls, potentially leading to high costs, quota exhaustion, or other misuse under your account.</li>
      </ul>
      <h3>The Secure Architecture:</h3>
      <ol>
        <li><strong>Frontend (Client-Side):</strong> Your web application (HTML, CSS, JavaScript running in the user's browser). It <em>collects user input</em>.</li>
        <li><strong>Backend (Server-Side):</strong> A secure server or cloud function that your frontend calls. This backend service is where your API key is securely stored and used.</li>
        <li><strong>Gemini API (or other service):</strong> The backend service makes requests to the Gemini API using the secured key.</li>
      </ol>
      <p>This guide will show you how to set up such a backend.</p>
      <p class="critical-warning"><strong>Note for this AI Launchpad Tool:</strong> If using the Gemini API directly from the client-side as implemented here, ensure <code>process.env.API_KEY</code> is managed securely and is not exposed in a publicly deployed bundle. For public production apps, a backend proxy is the standard secure method.</p>
    `
  },
  {
    title: "Google Cloud Project Setup",
    content: `
      <h2>1. Create or Select a Google Cloud Project</h2>
      <ul>
        <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">Google Cloud Console</a>.</li>
        <li>If you don't have a project, click "Select a project" then "NEW PROJECT". Follow the prompts.</li>
        <li>Otherwise, select the existing project you want to use.</li>
      </ul>
      <h2>2. Enable Necessary APIs</h2>
      <p>APIs allow your project to use specific Google Cloud services.</p>
      <ul>
        <li>In the Cloud Console, navigate to "APIs & Services" > "Library" using the search bar or navigation menu.</li>
        <li>Search for and enable the following APIs for your project:
          <ul>
            <li><strong>Generative Language API</strong> (or Vertex AI API if using Vertex AI models): Allows use of Gemini models.</li>
            <li><strong>Cloud Functions API</strong>: To create serverless backend functions.</li>
            <li><strong>Secret Manager API</strong>: For securely storing your API key.</li>
            <li><strong>Cloud Build API</strong>: Often required for deploying Cloud Functions (may be enabled automatically).</li>
            <li>(Optional, for hosting) <strong>Firebase API</strong>: If you plan to use Firebase services like Hosting.</li>
          </ul>
        </li>
        <li>Click "Enable" for each API. You might need to wait a moment for enabling to complete.</li>
      </ul>
      <p>Ensure billing is enabled for your project, as many of these services are paid (though they often have free tiers).</p>
    `
  },
  {
    title: "Secure API Key Management (Secret Manager)",
    content: `
      <h2>1. Obtain Your Gemini API Key</h2>
      <p>If you haven't already, get your Gemini API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>.</p>
      <h2>2. Store the API Key in Google Cloud Secret Manager</h2>
      <p>Secret Manager provides a secure and convenient way to store API keys, passwords, certificates, and other sensitive data.</p>
      <ol>
        <li>In the Google Cloud Console, navigate to "Security" > "Secret Manager".</li>
        <li>Click "<strong>Create Secret</strong>".</li>
        <li><strong>Name:</strong> Give your secret a descriptive name (e.g., <code>gemini-api-key</code>). This is the ID you'll use to refer to it.</li>
        <li><strong>Secret value:</strong> Paste your actual Gemini API key into this field.</li>
        <li><strong>Regions:</strong> You can typically leave this as "Automatic" or choose specific regions if needed.</li>
        <li>Leave other settings at their defaults unless you have specific requirements.</li>
        <li>Click "<strong>Create Secret</strong>".</li>
      </ol>
      <h3>Why use Secret Manager?</h3>
      <ul>
        <li><strong>Security:</strong> Keys are encrypted at rest and access can be tightly controlled using IAM permissions.</li>
        <li><strong>Centralization:</strong> Manage all your secrets in one place.</li>
        <li><strong>Auditing:</strong> Access to secrets can be audited.</li>
        <li><strong>Rotation:</strong> Simplifies the process of updating keys.</li>
      </ul>
      <p>You will grant your backend service (Cloud Function) permission to access this secret, rather than embedding the key in code.</p>
    `
  },
    {
    title: "Backend Setup - Cloud Function Proxy",
    content: `
      <h2>Why a Backend Proxy?</h2>
      <p>As emphasized, your API key must not be in the frontend. A backend Cloud Function acts as a secure intermediary:</p>
      <ol>
        <li>Frontend sends a request (e.g., user's prompt) to your Cloud Function.</li>
        <li>Cloud Function (running on Google's servers) retrieves the Gemini API key from Secret Manager.</li>
        <li>Cloud Function makes the actual call to the Gemini API using the key.</li>
        <li>Gemini API responds to your Cloud Function.</li>
        <li>Cloud Function sends the result back to your frontend.</li>
      </ol>

      <h2>Creating the Cloud Function (Node.js Example)</h2>
      <ol>
        <li>In the Cloud Console, go to "Compute" > "<strong>Cloud Functions</strong>".</li>
        <li>Click "<strong>Create Function</strong>".</li>
        <li><strong>Configuration:</strong>
            <ul>
                <li><strong>Environment:</strong> Choose "2nd gen" (recommended for new functions).</li>
                <li><strong>Function name:</strong> E.g., <code>gemini-request-handler</code>.</li>
                <li><strong>Region:</strong> Select a region (e.g., <code>us-central1</code>).</li>
                <li><strong>Trigger type:</strong> Select "HTTP".</li>
                <li><strong>Authentication:</strong> For simplicity during development, select "Allow unauthenticated invocations".
                    <br><strong>Production Note:</strong> For a real app, you'd secure this endpoint (e.g., require authentication, use API Gateway, or Firebase App Check if your frontend is on Firebase).</li>
            </ul>
        </li>
        <li>Click "Next" or "Save" then "Next" to go to the code section.</li>
        <li><strong>Code & Runtime:</strong>
            <ul>
                <li><strong>Runtime:</strong> Select a Node.js version (e.g., Node.js 20).</li>
                <li><strong>Source Code:</strong> "Inline editor" is fine for this example. For complex functions, use ZIP upload or a source repository.</li>
                <li><strong>Entry point:</strong> This is the name of the exported function in your code that will handle requests. E.g., <code>handleGeminiRequest</code>.</li>
            </ul>
        </li>
        <li><strong><code>package.json</code> (Dependencies):</strong>
<pre><code class="language-json">{
  "name": "gemini-proxy-function",
  "version": "1.0.0",
  "dependencies": {
    "@google/generative-ai": "^0.18.0", // Or the latest version
    "express": "^4.19.2", // For easy HTTP handling (common with 2nd gen)
    "cors": "^2.8.5"      // For Cross-Origin Resource Sharing
  }
}</code></pre>
        </li>
        <li><strong><code>index.js</code> (Function Logic):</strong>
<pre><code class="language-javascript">const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require("@google/genai"); // Corrected import

const app = express();

// Configure CORS: For development, allow all. For production, restrict to your frontend's domain.
// Example: app.use(cors({ origin: 'https://your-frontend-domain.com' }));
app.use(cors()); 
app.use(express.json());

// This environment variable will be linked to your Secret Manager secret
const API_KEY = process.env.GEMINI_API_KEY_SECRET; 

if (!API_KEY) {
  console.error("FATAL ERROR: GEMINI_API_KEY_SECRET environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY }); // Correct initialization
const modelName = 'gemini-2.5-flash';

app.post('/', async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: "API key not configured on the server." });
  }

  try {
    const { prompt, systemInstruction } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required in the request body.' });
    }
    
    const contents = prompt; 

    let generationConfig = {};
    if (systemInstruction) {
      generationConfig.systemInstruction = systemInstruction;
    }

    const result = await ai.models.generateContent({ 
        model: modelName,
        contents: contents,
        ...(Object.keys(generationConfig).length > 0 && { config: generationConfig })
    });
    
    const textResponse = result.text; 
    res.status(200).json({ text: textResponse });

  } catch (error) {
    console.error('Error calling Gemini API:', error.message);
    res.status(500).json({ error: 'Failed to process request with AI model.', details: error.message });
  }
});

exports.handleGeminiRequest = app;
</code></pre>
        <p><em>Note: The entry point in the GCP console should be <code>handleGeminiRequest</code>. For 2nd gen Cloud Functions using Express, the framework handles starting the server.</em></p>
        </li>
        <li><strong>Runtime Environment Variables (Linking Secret Manager):</strong>
            <ul>
                <li>Scroll to "Runtime, build and connections settings". Expand "Runtime".</li>
                <li>Under "Runtime environment variables", click "Add variable".</li>
                <li><strong>Name:</strong> <code>GEMINI_API_KEY_SECRET</code> (must match what's used in <code>index.js</code>).</li>
                <li><strong>Value:</strong> Click "Reference a secret".
                    <ul>
                        <li><strong>Secret:</strong> Select the secret you created (e.g., <code>gemini-api-key</code>).</li>
                        <li><strong>Version:</strong> Select "latest".</li>
                        <li>Click "Done".</li>
                    </ul>
                </li>
            </ul>
        </li>
        <li><strong>Service Account Permissions for Secret Access:</strong>
            <ul>
                <li>The Cloud Function runs as a specific service account. This account needs permission to read the secret.</li>
                <li>During function creation or by editing it later, find the "Runtime service account".</li>
                <li>Go to "IAM & Admin" > "IAM" in the GCP console.</li>
                <li>Find this service account. Click the pencil (edit) icon, then "Add another role".</li>
                <li>Select the role "<strong>Secret Manager Secret Accessor</strong>". Save.</li>
            </ul>
        </li>
        <li>Click "<strong>Deploy</strong>". Wait for deployment to complete.</li>
        <li>Once deployed, go to the "<strong>Trigger</strong>" tab of your function. Copy the <strong>Trigger URL</strong>. This is what your frontend will call.</li>
      </ol>
    `
  },
  {
    title: "Frontend Adaptation - Calling Your Backend",
    content: `
      <p>Now, modify your frontend JavaScript (<code>index.tsx</code> or similar) to call your new Cloud Function instead of trying to use the Gemini API SDK directly.</p>
      <p><strong>Remove any direct Gemini SDK initialization and API key handling from your frontend code.</strong></p>
      <pre><code class="language-typescript">// Example: in your index.tsx or a similar frontend file

const YOUR_CLOUD_FUNCTION_URL = 'https_your_region_your_project_id.cloudfunctions.net/gemini-request-handler';

async function callGeminiViaBackend(userPromptText: string, systemInstructionText?: string) {
  try {
    const response = await fetch(YOUR_CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: userPromptText,
        ...(systemInstructionText && { systemInstruction: systemInstructionText })
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from backend.' }));
      console.error('Error from backend:', response.status, errorData);
      throw new Error(errorData.error || \`Backend request failed with status: \${response.status}\`);
    }

    const data = await response.json();
    return data.text; 

  } catch (error) {
    console.error('Network or other error calling backend:', error);
    throw error;
  }
}
</code></pre>
      <p>Make sure your HTML has elements to show loading states and display responses/errors.</p>
    `
  },
  {
    title: "Frontend Build Process",
    content: `
      <p>For a production web app, your TypeScript (<code>.tsx</code>) code needs to be compiled into JavaScript that browsers can understand.</p>
      <h3>Popular Build Tools:</h3>
      <ul>
        <li><strong>Vite:</strong> Modern, fast, and well-regarded.</li>
        <li><strong>esbuild:</strong> Extremely fast bundler and minifier.</li>
      </ul>
      <h3>Example using <code>esbuild</code> (Simple Case):</h3>
      <ol>
        <li>Install esbuild: <code>npm install --save-dev esbuild</code></li>
        <li>Add a build script to your <code>package.json</code>:
<pre><code class="language-json">{
  "scripts": {
    "build": "esbuild index.tsx --bundle --outfile=dist/bundle.js --minify --sourcemap --format=esm --jsx=automatic"
  }
}</code></pre>
        </li>
        <li>Run the build: <code>npm run build</code></li>
        <li>Your <code>index.html</code> should then load the bundled file:
<pre><code class="language-html">&lt;!DOCTYPE html&gt;
&lt;html&gt;
&lt;head&gt;&lt;title&gt;My App&lt;/title&gt;&lt;/head&gt;
&lt;body&gt;
    &lt;div id="app-container"&gt;&lt;/div&gt;
    &lt;script type="module" src="dist/bundle.js"&gt;&lt;/script&gt;
&lt;/body&gt;
&lt;/html&gt;</code></pre>
        </li>
      </ol>
    `
  },
  {
    title: "Hosting Your Frontend",
    content: `
      <p>Once your frontend is built (static HTML, CSS, JS files), you need to host it.</p>
      <h2>Option A: Firebase Hosting (Recommended)</h2>
      <ol>
        <li><strong>Set up Firebase Project.</strong></li>
        <li><strong>Install Firebase CLI:</strong> <code>npm install -g firebase-tools</code></li>
        <li><strong>Login and Initialize:</strong> <code>firebase login</code>, then <code>firebase init hosting</code>. Specify your build output directory (e.g., <code>dist</code>).</li>
        <li><strong>Build your frontend.</strong></li>
        <li><strong>Deploy:</strong> <code>firebase deploy --only hosting</code></li>
      </ol>
      <p>Firebase Hosting provides free SSL, a global CDN, and easy custom domain setup.</p>
      <h2>Option B: Google Cloud Storage (GCS) + Load Balancer</h2>
      <p>More advanced, involves creating a GCS bucket, uploading assets, making it public, and setting up an HTTP(S) Load Balancer.</p>
    `
  },
  {
    title: "CORS Configuration for Your Backend",
    content: `
      <h2>What is CORS?</h2>
      <p>Cross-Origin Resource Sharing restricts web pages from making requests to a different domain. If your frontend and backend are on different domains, configure CORS on the backend.</p>
      <h2>How to Configure CORS in Your Node.js Cloud Function</h2>
      <p>Use the <code>cors</code> npm package.</p>
      <pre><code class="language-javascript">// In your Cloud Function's index.js:
const cors = require('cors');
const app = express();

const allowedOrigins = [ /* Your frontend domains */ ];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};
app.use(cors(corsOptions));
// ... rest of your function
</code></pre>
      <p>Redeploy your function after updating CORS settings.</p>
    `
  },
  {
    title: "Authentication (Conceptual Overview)",
    content: `
      <p>Needed if your app requires user identification, personalized data, or secure features.</p>
      <h2>Options:</h2>
      <ul>
        <li><strong>Firebase Authentication:</strong> Easy to integrate, multiple providers.</li>
        <li><strong>Google Identity Platform:</strong> Enterprise-grade.</li>
        <li><strong>Auth0, Supabase Auth, Custom.</strong></li>
      </ul>
      <h2>General Workflow (Token-Based):</h2>
      <ol>
        <li>Frontend: User logs in, gets ID Token (JWT).</li>
        <li>Frontend: Sends token in <code>Authorization</code> header to backend.</li>
        <li>Backend: Verifies token, processes request.</li>
      </ol>
    `
  },
  {
    title: "Storage / Database (Conceptual Overview)",
    content: `
      <p>Needed to store user data, application state, or content.</p>
      <h2>Options (GCP/Firebase):</h2>
      <ul>
        <li><strong>NoSQL:</strong> Cloud Firestore, Firebase Realtime Database.</li>
        <li><strong>SQL:</strong> Cloud SQL (MySQL, PostgreSQL, SQL Server).</li>
        <li><strong>Object Storage:</strong> Cloud Storage (GCS) for files.</li>
      </ul>
      <p>Typically, all database operations go through your secure backend.</p>
    `
  },
  {
    title: "Monitoring, Logging & Analytics (Conceptual)",
    content: `
      <p>Crucial for observing health, tracking errors, and understanding user behavior.</p>
      <ul>
        <li><strong>Google Cloud's operations suite:</strong> Cloud Monitoring, Cloud Logging.</li>
        <li><strong>Error Tracking:</strong> Sentry, LogRocket.</li>
        <li><strong>User Analytics:</strong> Google Analytics 4 (GA4), Mixpanel.</li>
      </ul>
    `
  },
  {
    title: "CI/CD - Continuous Integration/Deployment (Conceptual)",
    content: `
      <p>Automate build, test, and deployment processes.</p>
      <ul>
        <li><strong>Tools:</strong> GitHub Actions, Google Cloud Build, GitLab CI/CD, Jenkins.</li>
        <li><strong>Benefits:</strong> Faster releases, better code quality, reduced risk.</li>
      </ul>
    `
  }
];


// --- AI Launchpad Types and State ---
type CardType = 'step' | 'decision' | 'option-best' | 'option-other' | 'warning';
type AppView = 'launchpad' | 'guide';

interface SubStep {
  id: string; // e.g., cardId-sub-0
  instruction: string;
  completed: boolean;
}

interface ChatMessage {
  id: string; // e.g., cardId-chat-msg-0
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

interface DetailedCardData {
  id: string;
  title: string;
  type: CardType;
  content: string; // HTML content, to be sanitized or carefully generated
  completed: boolean;
  decisionContextId?: string; // For option cards, links to the parent decision card ID
  activatedByOptionId?: string; // For step/decision cards, this card is only relevant if the specified option ID is chosen

  // For step-by-step breakdown
  subSteps?: SubStep[];
  isBreakingDown?: boolean;
  breakdownError?: string | null;

  // For in-card chat
  chatHistory?: ChatMessage[];
  isChatLoading?: boolean;
  chatError?: string | null;
  currentChatQuery?: string; // Bound to the chat input field for this card

  // For collapsible decision cards
  isExpanded?: boolean;
}

interface ApplicationState {
    projectDescription: string;
    roadmapSteps: RoadmapStep[];
    detailedCards: DetailedCardData[];
    completedDetailedCards: DetailedCardData[];
    archivedCards: DetailedCardData[];
    selectedOptionForDecision: { [decisionCardId: string]: string | null };
}


interface RoadmapStep {
  id: string; // Corresponds to the generated card ID
  title: string;
  type: CardType;
  completed: boolean;
  relatedCardId: string; // ID of the detailed card this roadmap step links to
  isArchived?: boolean;
  activatedByOptionId?: string;
}

let currentView: AppView = 'launchpad';
let currentProjectDescription: string = "";
let roadmapSteps: RoadmapStep[] = [];
let detailedCards: DetailedCardData[] = [];
let completedDetailedCards: DetailedCardData[] = [];
let archivedCards: DetailedCardData[] = [];
let selectedOptionForDecision: { [decisionCardId: string]: string | null } = {};


let isLoadingAiResponse = false;
let globalAiError: string | null = null;

const API_KEY = process.env.API_KEY;
let ai: GoogleGenAI | null = null;

if (API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
    globalAiError = "Failed to initialize AI. API Key might be invalid or not configured correctly.";
  }
} else {
  console.warn("API_KEY environment variable not found. AI Launchpad functionality will be limited or disabled.");
}


// --- DOM Elements ---
const appContainer = document.getElementById('app-container') as HTMLElement;
const loadingOverlay = document.getElementById('loading-overlay') as HTMLElement;
const navLaunchpad = document.getElementById('nav-launchpad') as HTMLAnchorElement;
const navGuide = document.getElementById('nav-guide') as HTMLAnchorElement;
const headerContent = document.querySelector('.header-content');

// --- Helper Functions ---
function generateUniqueId(prefix: string = 'id'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function sanitizeHtml(htmlString: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString; 

    Array.from(tempDiv.getElementsByTagName('script')).forEach(script => script.remove());
    Array.from(tempDiv.querySelectorAll('*')).forEach(el => {
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.toLowerCase().startsWith('on')) {
                el.removeAttribute(attr.name);
            }
            if (attr.name.toLowerCase() === 'href' && attr.value.toLowerCase().startsWith('javascript:')) {
                el.removeAttribute(attr.name);
            }
        });
    });
    return tempDiv.innerHTML;
}

function findCardGlobally(cardId: string): DetailedCardData | undefined {
    return detailedCards.find(c => c.id === cardId) ||
           completedDetailedCards.find(c => c.id === cardId) ||
           archivedCards.find(c => c.id === cardId);
}

function archiveGivenCard(cardToArchive: DetailedCardData, sourceList: DetailedCardData[] = detailedCards) {
    const indexInSource = sourceList.findIndex(c => c.id === cardToArchive.id);
    if (indexInSource > -1) {
        sourceList.splice(indexInSource, 1);
    }
    const indexInCompleted = completedDetailedCards.findIndex(c => c.id === cardToArchive.id);
    if (indexInCompleted > -1) {
        completedDetailedCards.splice(indexInCompleted, 1);
    }

    if (!archivedCards.find(c => c.id === cardToArchive.id)) {
        archivedCards.push(cardToArchive);
    }
    const roadmapItem = roadmapSteps.find(rs => rs.relatedCardId === cardToArchive.id);
    if (roadmapItem) {
        roadmapItem.isArchived = true;
        roadmapItem.completed = false;
    }
    cardToArchive.completed = false;
}


function unarchiveGivenCard(cardToUnarchive: DetailedCardData) {
    const index = archivedCards.findIndex(c => c.id === cardToUnarchive.id);
    if (index > -1) {
        archivedCards.splice(index, 1);
        if (!detailedCards.find(c => c.id === cardToUnarchive.id) && !completedDetailedCards.find(c => c.id === cardToUnarchive.id)) { 
            detailedCards.push(cardToUnarchive); 
        }
        detailedCards.sort((a,b) => {
            const indexA = roadmapSteps.findIndex(rs => rs.id === a.id);
            const indexB = roadmapSteps.findIndex(rs => rs.id === b.id);
            return indexA - indexB;
        });
        const roadmapItem = roadmapSteps.find(rs => rs.relatedCardId === cardToUnarchive.id);
        if (roadmapItem) {
            roadmapItem.isArchived = false;
        }
    }
}


// --- Rendering Functions ---

function renderLaunchpad() {
    appContainer.innerHTML = `
        <div class="launchpad-layout">
            <div class="launchpad-main-content">
                <section class="launchpad-section" id="project-input-section" aria-labelledby="project-input-heading">
                    <h2 id="project-input-heading">1. Describe Your AI Studio Project</h2>
                    <form id="project-description-form">
                        <label for="project-description" class="sr-only">Project Description</label>
                        <textarea id="project-description" name="project-description" placeholder="E.g., 'A chatbot for customer service that uses a specific knowledge base about electronics', 'An image generator for creating fantasy art', 'A simple game where the AI is the opponent'..." required rows="5" aria-required="true">${currentProjectDescription}</textarea>
                        <div class="form-actions">
                            <button type="submit" id="generate-plan-btn">Generate Launch Plan</button>
                            <label for="upload-plan-input" class="button-like-label action-btn" role="button" tabindex="0" aria-controls="upload-plan-input">Upload Plan (.json)</label>
                            <input type="file" id="upload-plan-input" accept=".json" class="sr-only">
                        </div>
                    </form>
                    <div id="global-ai-error-message" class="error-message" style="display: ${globalAiError ? 'block' : 'none'};" role="alert" aria-live="assertive">${globalAiError || ''}</div>
                </section>

                <section class="launchpad-section" id="roadmap-section" aria-labelledby="roadmap-heading" style="display: ${roadmapSteps.length > 0 ? 'block' : 'none'};">
                    <h2 id="roadmap-heading">2. Your AI-Generated Launch Roadmap</h2>
                    <div id="roadmap-overview" role="navigation" aria-label="Roadmap steps">
                        ${renderRoadmapOverview()}
                    </div>
                </section>

                <section class="launchpad-section" id="detailed-steps-section" aria-labelledby="detailed-steps-heading" style="display: ${detailedCards.length > 0 || completedDetailedCards.length > 0 || archivedCards.length > 0 ? 'block' : 'none'};">
                    <h2 id="detailed-steps-heading">3. Detailed Steps & Guidance</h2>
                    <div id="detailed-cards-container">
                        ${detailedCards.length > 0 ? detailedCards.map(card => renderDetailedCard(card, 'active')).join('') : '<p class="empty-state-message">No active steps. Generate a plan or check completed/archived steps.</p>'}
                    </div>
                </section>

                <section class="launchpad-section" id="completed-roadmap-section" aria-labelledby="completed-roadmap-heading" style="display: ${completedDetailedCards.length > 0 ? 'block' : 'none'};">
                    <h2 id="completed-roadmap-heading">Completed Steps</h2>
                    <div id="completed-cards-container">
                        ${completedDetailedCards.map(card => renderDetailedCard(card, 'completed')).join('')}
                    </div>
                </section>

                <section class="launchpad-section" id="archived-items-section" aria-labelledby="archived-items-heading" style="display: ${archivedCards.length > 0 ? 'block' : 'none'};">
                    <h2 id="archived-items-heading">Archived Items</h2>
                    <div id="archived-cards-container">
                        ${archivedCards.map(card => renderDetailedCard(card, 'archived')).join('')}
                    </div>
                </section>
            </div>
            <aside class="launchpad-sidebar">
                <section id="decisions-made-section" class="launchpad-section sidebar-section" aria-labelledby="decisions-made-heading">
                    <h3 id="decisions-made-heading">Decisions Made</h3>
                    <div id="decisions-made-content">
                        ${renderDecisionsMadeSidebar()}
                    </div>
                </section>
                <section id="color-legend-section" class="launchpad-section sidebar-section" aria-labelledby="color-legend-heading">
                    <h3 id="color-legend-heading">Legend</h3>
                    <div id="color-legend-content">
                        ${renderColorLegend()}
                    </div>
                </section>
            </aside>
        </div>
    `;
    attachAllEventListeners();

    if (globalAiError && !API_KEY) {
        const generateBtn = document.getElementById('generate-plan-btn') as HTMLButtonElement;
        if(generateBtn) generateBtn.disabled = true;
        const errorDiv = document.getElementById('global-ai-error-message') as HTMLDivElement;
        if(errorDiv && !errorDiv.textContent) {
             errorDiv.textContent = "AI features are disabled. API_KEY is not configured.";
             errorDiv.style.display = "block";
        }
    }
    const projectDescTextarea = document.getElementById('project-description') as HTMLTextAreaElement;
    if (projectDescTextarea && currentProjectDescription) {
        projectDescTextarea.value = currentProjectDescription;
    }
}

function renderRoadmapOverview(): string {
    let html = '';
    const processedOptionStepIds = new Set<string>();

    // Create a map for quick lookup of detailed card data
    const allCardsMap = new Map<string, DetailedCardData>();
    [...detailedCards, ...completedDetailedCards, ...archivedCards].forEach(c => allCardsMap.set(c.id, c));

    roadmapSteps.forEach(step => {
        if (processedOptionStepIds.has(step.id) || step.isArchived) return; 

        const currentCard = allCardsMap.get(step.relatedCardId);
        if (!currentCard) return;

        // Visibility filter based on selected options
        if (currentCard.activatedByOptionId) {
            const activatingOptionCard = allCardsMap.get(currentCard.activatedByOptionId);
            if (!activatingOptionCard || selectedOptionForDecision[activatingOptionCard.decisionContextId ?? ''] !== currentCard.activatedByOptionId) {
                 // Check if the activating option is itself archived
                const roadmapActivatingOption = roadmapSteps.find(rs => rs.relatedCardId === currentCard.activatedByOptionId);
                if(roadmapActivatingOption?.isArchived) {
                    return; 
                }
                if(selectedOptionForDecision[activatingOptionCard.decisionContextId ?? ''] !== currentCard.activatedByOptionId) {
                   return; 
                }
            }
        }

        if (step.type === 'decision') {
            html += `<div class="roadmap-group">`;
            html += `<div class="roadmap-decision-row">${renderMiniCard(step)}</div>`;
            
            const decisionCardId = step.relatedCardId;
            const optionSteps = roadmapSteps.filter(rs => {
                const detailCard = allCardsMap.get(rs.relatedCardId);
                return detailCard && 
                       (detailCard.type === 'option-best' || detailCard.type === 'option-other') && 
                       detailCard.decisionContextId === decisionCardId && 
                       !rs.isArchived;
            });

            if (optionSteps.length > 0) {
                html += `<div class="roadmap-options-row">`;
                optionSteps.forEach(optStep => {
                    html += renderMiniCard(optStep);
                    processedOptionStepIds.add(optStep.id);
                });
                html += `</div>`;
            }
            html += `</div>`;
        } else if (step.type !== 'option-best' && step.type !== 'option-other') { // Render non-option steps that are not part of a decision group already handled
             html += `<div class="roadmap-group single-step">${renderMiniCard(step)}</div>`;
        }
    });
    if (html.trim() === '') {
      return '<p class="empty-state-message">No roadmap steps to display. Generate or load a plan.</p>';
    }
    return html;
}


function renderMiniCard(step: RoadmapStep, isInnerOption: boolean = false): string {
    let extraClass = '';
    if (step.completed) extraClass = 'completed';
    if (step.isArchived) extraClass = 'archived';
    if (isInnerOption) extraClass += ' inner-option-minicard';
    
    // Find the detailed card to check if it's a decision that's part of completed steps (and thus its options might be archived)
    const detailedCard = findCardGlobally(step.relatedCardId);
    let title = step.title;
    if (detailedCard && detailedCard.type !== 'decision' && detailedCard.decisionContextId) {
        const parentDecision = findCardGlobally(detailedCard.decisionContextId);
        if (parentDecision && parentDecision.completed && selectedOptionForDecision[parentDecision.id] !== step.relatedCardId) {
             extraClass += ' archived'; // Ensure options of completed decisions (that weren't chosen) are styled as archived
        }
    }


    return `
        <div class="mini-card type-${step.type} ${extraClass}" data-scroll-to="card-${step.relatedCardId}" role="button" tabindex="0" aria-label="Scroll to ${step.title}">
            ${title}
        </div>
    `;
}


function renderDetailedCard(card: DetailedCardData, context: 'active' | 'completed' | 'archived'): string {
    let cardContentHtml = card.content;
    if (!card.content.trim().match(/^<\w+/) && card.content.includes('\n')) { 
        try {
            cardContentHtml = marked.parse(card.content) as string;
        } catch (e) {
            console.error("Markdown parsing error for card:", card.id, e);
            cardContentHtml = sanitizeHtml(card.content.replace(/\n/g, '<br>'));
        }
    } else {
         cardContentHtml = sanitizeHtml(card.content);
    }

    const mainTaskCompleted = context === 'archived' ? false : card.completed;
    const cardClasses = `detailed-card type-${card.type} ${mainTaskCompleted ? 'completed-style' : ''} context-${context}`;
    const isDecisionCard = card.type === 'decision';
    // For decision cards, default isExpanded to false if not set, otherwise true.
    const isExpanded = card.isExpanded === undefined ? (isDecisionCard && context === 'active' ? false : true) : card.isExpanded;


    let decisionOptionsHtml = '';
    if (isDecisionCard && context === 'active') { // Only show options for active, expanded decision cards
        const optionCards = [...detailedCards, ...completedDetailedCards, ...archivedCards].filter(
            optCard => (optCard.type === 'option-best' || optCard.type === 'option-other') && optCard.decisionContextId === card.id && !archivedCards.includes(optCard)
        ).sort((a,b) => (a.type === 'option-best' ? -1 : 1)); // Show best option first

        if(optionCards.length > 0) {
            decisionOptionsHtml = `
                <div class="decision-options-container">
                    <h4>Options for this decision:</h4>
                    <div class="decision-options-minicards">
                        ${optionCards.map(optCard => {
                            const correspondingRoadmapStep = roadmapSteps.find(rs => rs.relatedCardId === optCard.id);
                            return correspondingRoadmapStep ? renderMiniCard(correspondingRoadmapStep, true) : '';
                        }).join('')}
                    </div>
                </div>
            `;
        }
    }
    
    const headerTitleHtml = `<h3 id="card-heading-${card.id}">${card.title}</h3>`;
    const decisionToggleIcon = isDecisionCard && context === 'active' ? `<span class="card-toggle-icon" aria-hidden="true">${isExpanded ? '▼' : '▶'}</span>` : '';


    return `
        <article id="card-${card.id}" class="${cardClasses}" aria-labelledby="card-heading-${card.id}">
            <div class="detailed-card-header ${isDecisionCard && context === 'active' ? 'clickable' : ''}" 
                 data-card-id="${card.id}" 
                 ${isDecisionCard && context === 'active' ? `aria-expanded="${isExpanded}" role="button" tabindex="0"` : ''}>
                ${headerTitleHtml}
                ${decisionToggleIcon}
            </div>
            ${ (isDecisionCard && context === 'active' && !isExpanded) ? '' : `
            <div class="card-content-wrapper ${isDecisionCard && context === 'active' && !isExpanded ? 'collapsed' : ''}">
                <div class="card-content">
                    ${cardContentHtml}
                    ${isDecisionCard && context === 'active' && isExpanded ? decisionOptionsHtml : ''}

                    ${context === 'active' && !isDecisionCard ? `
                    <!-- Sub-steps section -->
                    <div class="sub-steps-container" id="sub-steps-for-${card.id}">
                        ${card.isBreakingDown ? '<div class="card-loading small-spinner">Breaking down step...</div>' : ''}
                        ${card.breakdownError ? `<div class="error-message internal-error">${card.breakdownError} <button class="action-btn retry-breakdown-btn" data-card-id="${card.id}">Retry</button></div>` : ''}
                        ${card.subSteps && card.subSteps.length > 0 ? `
                            <h4>Actionable Sub-steps:</h4>
                            <ul class="sub-step-list">
                                ${card.subSteps.map((subStep, index) => `
                                    <li class="sub-step-item ${subStep.completed ? 'completed' : ''}">
                                        <input type="checkbox" id="substep-${card.id}-${index}" data-card-id="${card.id}" data-substep-id="${subStep.id}" ${subStep.completed ? 'checked' : ''} aria-labelledby="substep-label-${card.id}-${index}">
                                        <label for="substep-${card.id}-${index}" id="substep-label-${card.id}-${index}">${sanitizeHtml(subStep.instruction)}</label>
                                    </li>
                                `).join('')}
                            </ul>
                        ` : ''}
                        ${(!card.subSteps || card.subSteps.length === 0) && !card.isBreakingDown && !card.breakdownError && card.type !== 'warning' ? `
                            <button class="action-btn break-down-btn" data-card-id="${card.id}">Break Down Step</button>
                        ` : ''}
                    </div>

                    <!-- In-card chat section -->
                    <div class="in-card-chat-container" id="chat-for-${card.id}">
                        <h4>Talk to AI about this step:</h4>
                        <div class="chat-history">
                            ${(card.chatHistory || []).map(msg => `
                                <div class="chat-message ${msg.sender}">
                                    <strong>${msg.sender === 'user' ? 'You' : 'AI'}:</strong> ${sanitizeHtml(msg.text)}
                                </div>
                            `).join('')}
                        </div>
                        ${card.isChatLoading ? '<div class="card-loading small-spinner">AI is thinking...</div>' : ''}
                        ${card.chatError ? `<div class="error-message internal-error">${card.chatError}</div>` : ''}
                        <form class="in-card-chat-form" data-card-id="${card.id}">
                            <label for="chat-input-${card.id}" class="sr-only">Ask AI a question</label>
                            <textarea id="chat-input-${card.id}" class="chat-input" placeholder="Ask a question about this step..." rows="2" aria-label="Ask AI a question for step ${card.title}">${card.currentChatQuery || ''}</textarea>
                            <button type="submit" class="action-btn ask-ai-btn" ${card.isChatLoading ? 'disabled' : ''}>Ask AI</button>
                        </form>
                    </div>
                    ` : ''}
                </div>
                ${context === 'active' && !isDecisionCard ? `
                <div class="card-footer">
                    <button class="complete-btn ${card.completed ? 'pending-btn' : ''}" data-card-id="${card.id}" aria-pressed="${card.completed}">
                        ${card.completed ? 'Mark as Pending' : 'Mark as Done'}
                    </button>
                </div>
                ` : ''}
                 ${context === 'completed' && !isDecisionCard ? `
                 <div class="card-footer">
                    <button class="complete-btn pending-btn" data-card-id="${card.id}" aria-pressed="true">
                        Mark as Pending
                    </button>
                </div>
                ` : ''}
                ${context === 'active' && isDecisionCard ? `
                 <div class="card-footer">
                    <em class="decision-footer-note">Select an option above and mark it as "Done" to complete this decision.</em>
                </div>
                ` : ''}
            </div>
            `}
        </article>
    `;
}


function renderDecisionsMadeSidebar(): string {
    let html = '<ul class="decisions-made-list">';
    let hasDecisions = false;

    // Iterate through roadmap steps to maintain order if possible,
    // then check if the decision is completed.
    const decisionOrder = roadmapSteps
        .filter(rs => rs.type === 'decision')
        .map(rs => rs.relatedCardId);

    const completedDecisionCards = completedDetailedCards.filter(card => card.type === 'decision');
    
    completedDecisionCards.sort((a,b) => {
        const indexA = decisionOrder.indexOf(a.id);
        const indexB = decisionOrder.indexOf(b.id);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });


    completedDecisionCards.forEach(card => {
        if (selectedOptionForDecision[card.id]) {
            const chosenOptionId = selectedOptionForDecision[card.id];
            const chosenOptionCard = findCardGlobally(chosenOptionId!); // Could be in any list
            if (chosenOptionCard) {
                html += `
                    <li class="decision-made-item">
                        <strong class="decision-title">${sanitizeHtml(card.title)}</strong>
                        <span class="chosen-option">${sanitizeHtml(chosenOptionCard.title)}</span>
                    </li>
                `;
                hasDecisions = true;
            }
        }
    });
    html += '</ul>';
    if (!hasDecisions) {
        return '<p class="empty-state-message">No decisions made yet.</p>';
    }
    return html;
}

function renderColorLegend(): string {
    const legendItems = [
        { type: 'step', label: 'Step: A general task or action item.', class: 'type-step' },
        { type: 'decision', label: 'Decision: A point where a choice needs to be made.', class: 'type-decision' },
        { type: 'option-best', label: 'Option (Best Practice): A recommended choice.', class: 'type-option-best' },
        { type: 'option-other', label: 'Option (Alternative): An alternative choice.', class: 'type-option-other' },
        { type: 'warning', label: 'Warning: An important alert or consideration.', class: 'type-warning' },
        { type: 'status', label: 'Completed: Task or decision is finished.', class: 'completed item-example' },
        { type: 'status', label: 'Archived: Option or step is no longer relevant.', class: 'archived item-example' }
    ];

    return `
        <ul class="color-legend-list">
            ${legendItems.map(item => `
                <li class="legend-item">
                    <span class="legend-swatch ${item.class}" ${item.type === 'status' ? 'aria-label="Example ' + item.label + '"' : ''}>
                        ${item.class.includes('item-example') ? (item.class.includes('completed') ? '✓' : '✗') : ''}
                    </span>
                    <span class="legend-label">${item.label}</span>
                </li>
            `).join('')}
        </ul>
    `;
}


function renderGuide() {
    appContainer.innerHTML = `
        <h2 class="guide-main-heading">Deployment Guide</h2>
        <div id="guide-cards-container">
            ${staticGuideData.map((card, index) => `
                <details class="guide-card" ${index === 0 ? 'open' : ''}>
                    <summary>${card.title}</summary>
                    <div class="card-content">
                        ${card.content} 
                    </div>
                </details>
            `).join('')}
        </div>
    `;
     attachAllEventListeners();
}

function updateLoadingState(isLoading: boolean) {
    if (loadingOverlay) {
        loadingOverlay.style.display = isLoading ? 'flex' : 'none';
        loadingOverlay.setAttribute('aria-hidden', String(!isLoading));
    }
    const generateBtn = document.getElementById('generate-plan-btn') as HTMLButtonElement;
    if(generateBtn) {
        generateBtn.disabled = isLoading || !API_KEY;
    }
}

function updateView() {
    navLaunchpad.classList.toggle('active', currentView === 'launchpad');
    navGuide.classList.toggle('active', currentView === 'guide');

    const scrollPositions: { [key: string]: number } = {};
    if (currentView === 'launchpad') {
        const mainContent = document.querySelector('.launchpad-main-content');
        if (mainContent) scrollPositions.main = mainContent.scrollTop;

        // Persist expanded states of decision cards
        detailedCards.forEach(card => {
             if (card.type === 'decision') {
                const element = document.getElementById(`card-${card.id}`);
                if(element) {
                    const header = element.querySelector('.detailed-card-header');
                    if(header) card.isExpanded = header.getAttribute('aria-expanded') === 'true';
                }
             }
        });
    }


    if (currentView === 'launchpad') {
        renderLaunchpad();
    } else {
        renderGuide();
    }
    updateLoadingState(isLoadingAiResponse);

    if (currentView === 'launchpad') {
        const mainContent = document.querySelector('.launchpad-main-content');
        if (mainContent && scrollPositions.main !== undefined) mainContent.scrollTop = scrollPositions.main;
    }
     attachAllEventListeners();
}


// --- Event Handlers ---
async function handleProjectDescriptionSubmit(event: Event) {
    event.preventDefault();
    if (!ai) {
        globalAiError = "AI client is not initialized. Please ensure API_KEY is set correctly.";
        const errorDiv = document.getElementById('global-ai-error-message') as HTMLDivElement;
        if (errorDiv) {
            errorDiv.textContent = globalAiError;
            errorDiv.style.display = "block";
        }
        console.error(globalAiError);
        return;
    }

    const descriptionTextarea = document.getElementById('project-description') as HTMLTextAreaElement;
    currentProjectDescription = descriptionTextarea.value.trim();

    if (!currentProjectDescription) {
        globalAiError = "Please describe your project.";
        const errorDiv = document.getElementById('global-ai-error-message') as HTMLDivElement;
        if (errorDiv) {
            errorDiv.textContent = globalAiError;
            errorDiv.style.display = "block";
        }
        return;
    }

    isLoadingAiResponse = true;
    globalAiError = null;
    updateLoadingState(true);
    const errorDiv = document.getElementById('global-ai-error-message') as HTMLDivElement;
    if (errorDiv) errorDiv.style.display = 'none';

    const systemInstruction = `
You are an expert AI project launch planner for applications built with AI Studio (using Gemini APIs).
Based on the user's project description, generate a comprehensive list of steps, decisions, options, and potential warnings to help them launch their application.
The output MUST be a valid JSON array of objects. Each object in the array represents a card and must have the following properties:
- "id": A unique string identifier for the card (e.g., "auth-setup", "decision-database"). Use kebab-case and ensure it's unique across all cards.
- "title": A concise, descriptive title for the card (e.g., "Set Up Authentication", "Choose Your Database").
- "type": A string indicating the card type. Must be one of: 'step', 'decision', 'option-best', 'option-other', 'warning'.
- "content": Detailed guidance for this card, formatted as Markdown or basic HTML (paragraphs, lists, links, code blocks). For 'decision' cards, this content should describe the decision to be made. For 'option-*' cards, describe the specific option.
- "decisionContextId" (OPTIONAL): If the card is of type 'option-best' or 'option-other', this field MUST contain the "id" of the 'decision' card it relates to. For all other card types, this field should be omitted.
- "activatedByOptionId" (OPTIONAL): For 'step' or 'decision' cards that are only relevant if a specific 'option-*' card (from a PRECEDING 'decision' card) is chosen, this field MUST contain the "id" of that 'option-*' card. If a step/decision is always relevant or is a top-level item not dependent on a prior option choice, omit this field. Ensure the ID used here is a valid ID of an option card defined in this plan.

Example of a 'decision' card:
{
  "id": "choose-auth",
  "title": "Choose Authentication Method",
  "type": "decision",
  "content": "Select how users will authenticate. Consider factors like ease of use, security, and scalability."
}
Example of an 'option-best' card related to the above decision:
{
  "id": "firebase-auth-option",
  "title": "Option: Firebase Authentication (Recommended)",
  "type": "option-best",
  "content": "Use Firebase Auth for easy integration with multiple providers (Google, Email/Password, etc.) and robust security features.",
  "decisionContextId": "choose-auth"
}
Example of a subsequent 'step' card that depends on choosing Firebase Auth:
{
  "id": "setup-firebase-auth-rules",
  "title": "Setup Firebase Auth Security Rules",
  "type": "step",
  "content": "Configure security rules in Firebase for your authentication setup to protect user data.",
  "activatedByOptionId": "firebase-auth-option"
}
Ensure 'option-best' and 'option-other' cards are placed immediately after their corresponding 'decision' card in the array if possible, or at least ensure their 'decisionContextId' is correctly linking them.
Generate a logical sequence from project inception to deployment readiness.
Do not include "completed", "subSteps", "isExpanded" etc.; the frontend manages these.
`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: currentProjectDescription,
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

        const generatedData: Omit<DetailedCardData, 'completed' | 'subSteps' | 'chatHistory' | 'currentChatQuery' | 'isExpanded'>[] = JSON.parse(jsonStr);

        roadmapSteps = generatedData.map(item => ({
            id: item.id, 
            title: item.title,
            type: item.type,
            completed: false,
            relatedCardId: item.id, 
            isArchived: false,
            activatedByOptionId: item.activatedByOptionId
        }));

        detailedCards = generatedData.map(item => ({
            ...item,
            id: item.id, 
            completed: false,
            subSteps: [],
            chatHistory: [],
            currentChatQuery: '',
            isBreakingDown: false,
            breakdownError: null,
            isChatLoading: false,
            chatError: null,
            isExpanded: item.type !== 'decision', // Decisions start collapsed by default
        }));
        completedDetailedCards = [];
        archivedCards = [];
        selectedOptionForDecision = {};
        
        const roadmapSection = document.getElementById('roadmap-section');
        const detailedStepsSection = document.getElementById('detailed-steps-section');
        if (roadmapSection) roadmapSection.style.display = roadmapSteps.length > 0 ? 'block' : 'none';
        if (detailedStepsSection) detailedStepsSection.style.display = 'block';

    } catch (error) {
        console.error("Error generating launch plan with Gemini API:", error);
        globalAiError = `Failed to generate launch plan: ${error.message || 'Unknown error'}. Check console for details. The AI may have returned an invalid format.`;
        if(errorDiv) {
            errorDiv.textContent = globalAiError;
            errorDiv.style.display = 'block';
        }
        roadmapSteps = [];
        detailedCards = [];
        completedDetailedCards = [];
        archivedCards = [];
    } finally {
        isLoadingAiResponse = false;
        updateView();
    }
}

async function handleBreakDownStep(cardId: string) {
    if (!ai) return;
    const card = detailedCards.find(c => c.id === cardId);
    if (!card) return;

    card.isBreakingDown = true;
    card.breakdownError = null;
    updateView(); 

    const systemInstruction = `
You are an AI assistant. The user is working on the task: "${card.title}".
The overall goal of this task is:
${card.content.substring(0, 500)}... 

Please break this task down into a numbered list of very specific, actionable, how-to style sub-steps.
Each sub-step should be a short instruction. Include specific commands, UI navigation elements to click, or brief code snippets where applicable and highly relevant to performing the sub-step.
Return the sub-steps as a valid JSON array of objects. Each object in the array must have a single key "instruction" with a string value.
For example:
[
  { "instruction": "Log in to the Google Cloud Console at console.cloud.google.com." },
  { "instruction": "Navigate to 'IAM & Admin' > 'Service Accounts'." },
  { "instruction": "Click 'Create Service Account' and fill in the details." }
]
Ensure the output is ONLY the JSON array. Do not include any other text or markdown formatting around the JSON.
Focus on practical, small actions the user can take to complete the main task.
`;
    try {
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
        
        const parsedSubSteps: { instruction: string }[] = JSON.parse(jsonStr);
        card.subSteps = parsedSubSteps.map((s, index) => ({
            id: `${cardId}-sub-${index}`,
            instruction: s.instruction,
            completed: false,
        }));
    } catch (error)
    {
        console.error(`Error breaking down step for card ${cardId}:`, error);
        card.breakdownError = `Failed to get sub-steps: ${error.message || 'Unknown error'}. The AI may have returned an invalid format.`;
        card.subSteps = []; 
    } finally {
        card.isBreakingDown = false;
        updateView();
    }
}

async function handleInCardChatSubmit(cardId: string, userQuery: string) {
    if (!ai || !userQuery.trim()) return;
    const card = findCardGlobally(cardId);
    if (!card) return;

    card.isChatLoading = true;
    card.chatError = null;
    if (!card.chatHistory) card.chatHistory = [];
    card.chatHistory.push({
        id: generateUniqueId(`${cardId}-chat-msg`),
        sender: 'user',
        text: userQuery,
        timestamp: new Date()
    });
    card.currentChatQuery = ''; 

    updateView(); 

    const systemInstruction = `
You are a helpful AI assistant. The user is working on a specific task related to launching an AI Studio project.
The current task is titled: "${card.title}".
The general description of this task is: "${card.content.substring(0, 300)}..."
The user has the following question about this specific task: "${userQuery}"
Please provide a concise and helpful answer to their question, staying strictly within the context of the given task and user question.
If the question is outside this scope, politely state that you can only assist with the current task.
Do not generate overly long responses. Be direct and to the point.
`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userQuery, 
            config: { systemInstruction: systemInstruction }
        });
        card.chatHistory.push({
            id: generateUniqueId(`${cardId}-chat-msg`),
            sender: 'ai',
            text: response.text,
            timestamp: new Date()
        });
    } catch (error) {
        console.error(`Error in-card chat for card ${cardId}:`, error);
        card.chatError = `AI response error: ${error.message || 'Unknown error'}`;
        card.chatHistory.push({ 
            id: generateUniqueId(`${cardId}-chat-msg`),
            sender: 'ai',
            text: `Sorry, I encountered an error: ${error.message || 'Unknown error'}. Please try again.`,
            timestamp: new Date()
        });
    } finally {
        card.isChatLoading = false;
        updateView();
    }
}

function handleToggleComplete(event: Event) {
    const button = event.target as HTMLButtonElement;
    const cardId = button.dataset.cardId;
    if (!cardId) return;

    const isMarkingDone = !button.classList.contains('pending-btn');
    let cardToUpdate: DetailedCardData | undefined = findCardGlobally(cardId);
    if (!cardToUpdate) return;

    const originalSourceList = detailedCards.includes(cardToUpdate) ? detailedCards :
                               completedDetailedCards.includes(cardToUpdate) ? completedDetailedCards :
                               undefined; 

    if (isMarkingDone) {
        // Allow marking done even if not all sub-steps are completed for non-decision cards
        // const allSubstepsCompleted = cardToUpdate.subSteps && cardToUpdate.subSteps.length > 0 ? cardToUpdate.subSteps.every(s => s.completed) : true;
        // if (cardToUpdate.type !== 'decision' && !allSubstepsCompleted) return; // This condition is removed based on new requirement

        cardToUpdate.completed = true;
        if (originalSourceList === detailedCards) {
            detailedCards = detailedCards.filter(c => c.id !== cardId);
            if (!completedDetailedCards.find(c => c.id === cardId)) {
                completedDetailedCards.push(cardToUpdate);
            }
             // Sort completed cards based on their original roadmap order
            completedDetailedCards.sort((a,b) => {
                const indexA = roadmapSteps.findIndex(rs => rs.relatedCardId === a.id);
                const indexB = roadmapSteps.findIndex(rs => rs.relatedCardId === b.id);
                return indexA - indexB;
            });
        }

        if (['option-best', 'option-other'].includes(cardToUpdate.type) && cardToUpdate.decisionContextId) {
            const decisionId = cardToUpdate.decisionContextId;
            selectedOptionForDecision[decisionId] = cardToUpdate.id;

            let decisionCard = findCardGlobally(decisionId);
            if (decisionCard && !decisionCard.completed) {
                decisionCard.completed = true;
                 decisionCard.isExpanded = false; // Collapse decision card when an option is chosen
                if (detailedCards.includes(decisionCard)) {
                    detailedCards = detailedCards.filter(c => c.id !== decisionId);
                    if(!completedDetailedCards.find(c => c.id === decisionId)){
                         completedDetailedCards.push(decisionCard);
                    }
                     completedDetailedCards.sort((a,b) => {
                        const indexA = roadmapSteps.findIndex(rs => rs.relatedCardId === a.id);
                        const indexB = roadmapSteps.findIndex(rs => rs.relatedCardId === b.id);
                        return indexA - indexB;
                     });
                }
                const roadmapDecision = roadmapSteps.find(rs => rs.relatedCardId === decisionId);
                if (roadmapDecision) roadmapDecision.completed = true;
            }

            const allRelevantCards = [...detailedCards, ...completedDetailedCards, ...archivedCards];
            allRelevantCards.forEach(currentCard => {
                if (currentCard.id === cardToUpdate!.id || currentCard.id === decisionId) return;

                // Archive other options of the same decision
                if (currentCard.decisionContextId === decisionId && currentCard.id !== cardToUpdate!.id) {
                     if (!archivedCards.find(ac => ac.id === currentCard.id)) archiveGivenCard(currentCard);
                }
                // Archive steps/decisions that were activated by a *different* option of the *same* decision
                else if (currentCard.activatedByOptionId) {
                    const activatingOption = findCardGlobally(currentCard.activatedByOptionId);
                    if (activatingOption && activatingOption.decisionContextId === decisionId && currentCard.activatedByOptionId !== cardToUpdate!.id) {
                         if (!archivedCards.find(ac => ac.id === currentCard.id)) archiveGivenCard(currentCard);
                    }
                }
            });
            
            [...archivedCards, ...detailedCards].forEach(c => { // Check archivedCards as well
                if(c.activatedByOptionId === cardToUpdate!.id) {
                    unarchiveGivenCard(c);
                }
            });

        }
    } else { // Marking as pending
        cardToUpdate.completed = false;
        if (originalSourceList === completedDetailedCards) {
            completedDetailedCards = completedDetailedCards.filter(c => c.id !== cardId);
            if (!detailedCards.find(c => c.id === cardId)) {
                 detailedCards.push(cardToUpdate);
            }
            detailedCards.sort((a, b) => {
                const indexA = roadmapSteps.findIndex(rs => rs.relatedCardId === a.id);
                const indexB = roadmapSteps.findIndex(rs => rs.relatedCardId === b.id);
                return indexA - indexB;
            });
        }

        if (['option-best', 'option-other'].includes(cardToUpdate.type) && cardToUpdate.decisionContextId) {
            const decisionId = cardToUpdate.decisionContextId;
            if (selectedOptionForDecision[decisionId] === cardToUpdate.id) {
                selectedOptionForDecision[decisionId] = null;

                const decisionCard = findCardGlobally(decisionId);
                if (decisionCard && decisionCard.completed) {
                    decisionCard.completed = false;
                    if (completedDetailedCards.includes(decisionCard)) {
                        completedDetailedCards = completedDetailedCards.filter(c => c.id !== decisionId);
                        if (!detailedCards.find(c => c.id === decisionId)) {
                            detailedCards.push(decisionCard);
                        }
                        detailedCards.sort((a, b) => {
                            const indexA = roadmapSteps.findIndex(rs => rs.relatedCardId === a.id);
                            const indexB = roadmapSteps.findIndex(rs => rs.relatedCardId === b.id);
                            return indexA - indexB;
                        });
                    }
                    const roadmapDecision = roadmapSteps.find(rs => rs.relatedCardId === decisionId);
                    if (roadmapDecision) roadmapDecision.completed = false;
                }
                
                // Unarchive sibling options and cards dependent on them
                 const cardsToPotentiallyUnarchive = archivedCards.filter(ac => {
                    if (ac.decisionContextId === decisionId) return true; // Sibling options
                    if (ac.activatedByOptionId) { // Cards activated by any option of this decision
                        const activatingOpt = findCardGlobally(ac.activatedByOptionId) || archivedCards.find(arcOpt => arcOpt.id === ac.activatedByOptionId);
                        return activatingOpt && activatingOpt.decisionContextId === decisionId;
                    }
                    return false;
                });
                cardsToPotentiallyUnarchive.forEach(c => unarchiveGivenCard(c));


                // Archive steps/decisions that were activated by THIS option (which is now pending)
                 [...detailedCards, ...completedDetailedCards].forEach(c => {
                    if (c.activatedByOptionId === cardToUpdate!.id) {
                        if (!archivedCards.find(ac => ac.id === c.id)) archiveGivenCard(c);
                    }
                });
            }
        }
    }

    const roadmapStepToUpdate = roadmapSteps.find(rs => rs.relatedCardId === cardId);
    if (roadmapStepToUpdate) {
        roadmapStepToUpdate.completed = cardToUpdate.completed;
        if (!cardToUpdate.completed) roadmapStepToUpdate.isArchived = false; 
    }
    
    updateView();
}


function handleSubStepToggle(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    const cardId = checkbox.dataset.cardId;
    const subStepId = checkbox.dataset.substepId;

    if (cardId && subStepId) {
        const card = findCardGlobally(cardId);
        if (card && card.subSteps) {
            const subStep = card.subSteps.find(s => s.id === subStepId);
            if (subStep) {
                subStep.completed = checkbox.checked;
            }
        }
        // No full updateView needed, just re-render the specific card or toggle class. For simplicity, full updateView is okay for now.
        updateView(); 
    }
}

function handleChatInputChange(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    const formElement = textarea.closest('.in-card-chat-form'); 

    if (formElement instanceof HTMLFormElement) { 
        const cardId = formElement.dataset.cardId;
        if (cardId) {
            const card = findCardGlobally(cardId);
            if (card) {
                card.currentChatQuery = textarea.value;
            }
        }
    }
}

function handleDownloadPlan() {
    const state: ApplicationState = {
        projectDescription: currentProjectDescription,
        roadmapSteps,
        detailedCards,
        completedDetailedCards,
        archivedCards,
        selectedOptionForDecision
    };
    const jsonString = JSON.stringify(state, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-launchpad-plan-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function handleUploadPlan(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const jsonString = e.target?.result as string;
                const loadedState: ApplicationState = JSON.parse(jsonString);
                
                if (loadedState && loadedState.roadmapSteps && loadedState.detailedCards) {
                    currentProjectDescription = loadedState.projectDescription || "";
                    roadmapSteps = loadedState.roadmapSteps;
                    detailedCards = loadedState.detailedCards;
                    completedDetailedCards = loadedState.completedDetailedCards || [];
                    archivedCards = loadedState.archivedCards || [];
                    selectedOptionForDecision = loadedState.selectedOptionForDecision || {};

                    [...detailedCards, ...completedDetailedCards, ...archivedCards].forEach(card => {
                        if (card.subSteps === undefined) card.subSteps = [];
                        if (card.chatHistory === undefined) card.chatHistory = [];
                        if (card.currentChatQuery === undefined) card.currentChatQuery = "";
                        if (card.isBreakingDown === undefined) card.isBreakingDown = false;
                        if (card.breakdownError === undefined) card.breakdownError = null;
                        if (card.isChatLoading === undefined) card.isChatLoading = false;
                        if (card.chatError === undefined) card.chatError = null;
                        if (card.activatedByOptionId === undefined) card.activatedByOptionId = undefined;
                         // When loading, decisions in active list are collapsed, others expanded.
                        if (card.isExpanded === undefined) {
                            card.isExpanded = !(card.type === 'decision' && detailedCards.includes(card));
                        }
                    });
                     roadmapSteps.forEach(rs => {
                        if(rs.activatedByOptionId === undefined) rs.activatedByOptionId = undefined;
                        if(rs.isArchived === undefined) rs.isArchived = false;
                     });
                    
                    globalAiError = null;
                    const errorDiv = document.getElementById('global-ai-error-message') as HTMLDivElement;
                    if (errorDiv) errorDiv.style.display = 'none';
                    updateView();
                } else {
                    throw new Error("Invalid plan file format. Missing core properties.");
                }
            } catch (error) {
                console.error("Error loading plan:", error);
                globalAiError = `Failed to load plan: ${error.message}. Ensure it's a valid JSON file.`;
                const errorDiv = document.getElementById('global-ai-error-message') as HTMLDivElement;
                 if (errorDiv) {
                    errorDiv.textContent = globalAiError;
                    errorDiv.style.display = 'block';
                }
            }
        };
        reader.readAsText(file);
        input.value = ''; 
    }
}

function handleDecisionCardHeaderClick(event: Event) {
    const headerElement = (event.currentTarget as HTMLElement);
    const cardId = headerElement.dataset.cardId;
    if (!cardId) return;

    const card = findCardGlobally(cardId); // Check all lists for the card
    if (card && card.type === 'decision' && !card.completed && !archivedCards.includes(card)) { // Only active decision cards are toggleable
        card.isExpanded = !card.isExpanded;
        // Don't call updateView() directly, as it re-reads from DOM for expansion.
        // Instead, directly manipulate the ARIA attribute and class for the clicked card.
        const cardElement = document.getElementById(`card-${card.id}`);
        if (cardElement) {
            const contentWrapper = cardElement.querySelector('.card-content-wrapper');
            const toggleIcon = headerElement.querySelector('.card-toggle-icon');
            headerElement.setAttribute('aria-expanded', String(card.isExpanded));
            if (contentWrapper) {
                contentWrapper.classList.toggle('collapsed', !card.isExpanded);
            }
            if (toggleIcon) {
                toggleIcon.innerHTML = card.isExpanded ? '▼' : '▶';
            }
            // If expanding, re-render just THIS card's options if it's an active decision card
            if (card.isExpanded && detailedCards.includes(card)) {
                // To refresh options, we might need a more targeted re-render of the card's content,
                // or ensure renderDetailedCard correctly handles this.
                // For simplicity, a full updateView is acceptable if performance is not an issue.
                // However, let's try to avoid full re-render if state is managed correctly.
                // The current renderDetailedCard should correctly show options if isExpanded is true.
                // The issue might be that updateView() re-reads isExpanded from DOM if not careful.
                // We've set card.isExpanded in the state, so the next updateView() will reflect it.
                // A targeted re-render of just this card might be:
                // cardElement.outerHTML = renderDetailedCard(card, 'active');
                // attachAllEventListeners(); // Re-attach for the new card content
                // This is simpler for now:
                 updateView(); // This will pick up the new isExpanded state.
            }
        }
    }
}


function attachAllEventListeners() {
    const form = document.getElementById('project-description-form') as HTMLFormElement;
    if (form) { 
        form.removeEventListener('submit', handleProjectDescriptionSubmit); 
        form.addEventListener('submit', handleProjectDescriptionSubmit);
    }
    
    document.querySelectorAll('.mini-card').forEach(card => {
        card.removeEventListener('click', miniCardClickHandler);
        card.addEventListener('click', miniCardClickHandler);
        card.removeEventListener('keydown', miniCardKeyHandler);
        card.addEventListener('keydown', miniCardKeyHandler);
    });

    document.querySelectorAll('.detailed-card .complete-btn').forEach(button => {
        button.removeEventListener('click', handleToggleComplete);
        button.addEventListener('click', handleToggleComplete);
    });
    document.querySelectorAll('.detailed-card .break-down-btn, .detailed-card .retry-breakdown-btn').forEach(button => {
        button.removeEventListener('click', breakDownButtonClickHandler);
        button.addEventListener('click', breakDownButtonClickHandler);
    });
    document.querySelectorAll('.detailed-card .in-card-chat-form').forEach(chatFormEl => {
        if (chatFormEl instanceof HTMLFormElement) {
            chatFormEl.removeEventListener('submit', inCardChatFormSubmitHandler);
            chatFormEl.addEventListener('submit', inCardChatFormSubmitHandler);
        }
    });
    document.querySelectorAll('.detailed-card .chat-input').forEach(input => {
        input.removeEventListener('input', handleChatInputChange);
        input.addEventListener('input', handleChatInputChange);
    });
    document.querySelectorAll('.detailed-card .sub-step-list input[type="checkbox"]').forEach(checkbox => {
        checkbox.removeEventListener('change', handleSubStepToggle);
        checkbox.addEventListener('change', handleSubStepToggle);
    });
    document.querySelectorAll('.detailed-card-header.clickable').forEach(header => {
        header.removeEventListener('click', handleDecisionCardHeaderClick);
        header.addEventListener('click', handleDecisionCardHeaderClick);
        header.removeEventListener('keydown', (e: Event) => decisionCardHeaderKeydownHandler(e as KeyboardEvent));
        header.addEventListener('keydown', (e: Event) => decisionCardHeaderKeydownHandler(e as KeyboardEvent));
    });


    const uploadPlanInput = document.getElementById('upload-plan-input');
    if (uploadPlanInput) {
        uploadPlanInput.removeEventListener('change', handleUploadPlan);
        uploadPlanInput.addEventListener('change', handleUploadPlan);
    }
    const uploadPlanLabel = document.querySelector('label[for="upload-plan-input"]');
    if (uploadPlanLabel) {
        const keydownListener = (e: Event) => {
            if (e instanceof KeyboardEvent && (e.key === 'Enter' || e.key === ' ')) {
                 e.preventDefault();
                (document.getElementById('upload-plan-input') as HTMLElement)?.click();
            }
        };
        uploadPlanLabel.removeEventListener('keydown', keydownListener);
        uploadPlanLabel.addEventListener('keydown', keydownListener);
    }
}

function miniCardClickHandler(this: HTMLElement) {
    const cardId = this.getAttribute('data-scroll-to');
    if (cardId) {
        const targetElement = document.getElementById(cardId); 
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            const cardData = findCardGlobally(cardId.replace('card-', ''));
            if (cardData && cardData.type === 'decision' && !cardData.completed && !archivedCards.find(c=>c.id === cardData.id)) { // Only active, non-archived decisions
                if (!cardData.isExpanded) {
                    cardData.isExpanded = true;
                    // Directly update the DOM for instant feedback before full re-render
                    const header = targetElement.querySelector('.detailed-card-header.clickable');
                    const contentWrapper = targetElement.querySelector('.card-content-wrapper');
                    const toggleIcon = header?.querySelector('.card-toggle-icon');
                    if (header) header.setAttribute('aria-expanded', 'true');
                    if (contentWrapper) contentWrapper.classList.remove('collapsed');
                    if (toggleIcon) toggleIcon.innerHTML = '▼';
                    updateView(); // Re-render to ensure options are shown correctly if logic depends on it
                }
            }
        } else {
             console.warn(`Mini-card target ${cardId} not found.`);
        }
    }
}
function miniCardKeyHandler(this: HTMLElement, event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        miniCardClickHandler.call(this);
    }
}
function decisionCardHeaderKeydownHandler(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleDecisionCardHeaderClick(event);
    }
}
function breakDownButtonClickHandler(this: HTMLButtonElement) {
    const cardId = this.dataset.cardId;
    if (cardId) handleBreakDownStep(cardId);
}
function inCardChatFormSubmitHandler(this: HTMLFormElement, event: Event) {
    event.preventDefault();
    const cardId = this.dataset.cardId;
    const input = this.querySelector('.chat-input') as HTMLTextAreaElement;
    if (cardId && input && input.value.trim()) {
        handleInCardChatSubmit(cardId, input.value.trim());
    }
}


// --- Initialization ---
function initializeApp() {
    if (!appContainer || !loadingOverlay || !navLaunchpad || !navGuide || !headerContent) {
        console.error("Critical DOM elements are missing. Application cannot start.");
        document.body.innerHTML = "<p>Error: Application critical elements are missing. Please reload.</p>";
        return;
    }

    navLaunchpad.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentView !== 'launchpad') {
            currentView = 'launchpad';
            updateView();
        }
    });

    navGuide.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentView !== 'guide') {
            currentView = 'guide';
            updateView();
        }
    });
    
    if (!API_KEY) {
      globalAiError = "AI features require an API_KEY. Please set the API_KEY environment variable. Without it, the AI Launchpad will not function.";
    }

    if (!document.getElementById('download-plan-btn') && headerContent) {
        const downloadButton = document.createElement('button');
        downloadButton.id = 'download-plan-btn';
        downloadButton.classList.add('action-btn', 'header-action-btn');
        downloadButton.textContent = 'Download Plan';
        downloadButton.setAttribute('aria-label', 'Download current launch plan as JSON file');
        downloadButton.addEventListener('click', handleDownloadPlan);
        headerContent.appendChild(downloadButton);
    }

    updateView(); 
}

document.addEventListener('DOMContentLoaded', initializeApp);


if(API_KEY && ai === null && !globalAiError) { 
    globalAiError = "AI client failed to initialize despite API_KEY being present. Check console.";
    console.error(globalAiError);
}