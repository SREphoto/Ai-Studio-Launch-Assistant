export interface StaticGuideCardData {
  title: string;
  content: string; // HTML content
}

export const staticGuideData: StaticGuideCardData[] = [
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
