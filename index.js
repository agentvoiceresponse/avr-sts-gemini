/**
 * index.js
 * Entry point for the Gemini Speech-to-Speech streaming WebSocket server.
 * This server handles real-time audio streaming between clients and Gemini's API,
 * performing necessary audio format conversions and WebSocket communication.
 *
 * Client Protocol:
 * - Send {"type": "init", "uuid": "uuid"} to initialize session
 * - Send {"type": "audio", "audio": "base64_encoded_audio"} to stream audio
 * - Receive {"type": "audio", "audio": "base64_encoded_audio"} for responses
 * - Receive {"type": "error", "message": "error_message"} for errors
 *
 * @author Agent Voice Response <info@agentvoiceresponse.com>
 * @see https://www.agentvoiceresponse.com
 */

const WebSocket = require("ws");
const { create } = require("@alexanderolsen/libsamplerate-js");
const { GoogleGenAI, Modality, ThinkingLevel } = require("@google/genai");
const axios = require("axios");
const fs = require("fs").promises;
const { loadTools, getToolHandler } = require("./loadTools");

require("dotenv").config();

const isTruthy = (value) =>
  ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());

/**
 * Returns true when Vertex AI (Google Cloud Console) mode is enabled.
 * Supports SDK-standard and AVR-prefixed env vars.
 */
const isVertexAiMode = () =>
  isTruthy(process.env.GOOGLE_GENAI_USE_VERTEXAI) ||
  isTruthy(process.env.GEMINI_USE_VERTEXAI);

/**
 * Creates a GoogleGenAI client for either Google AI Studio (API key) or Vertex AI.
 *
 * Vertex AI: set GOOGLE_GENAI_USE_VERTEXAI=true (or GEMINI_USE_VERTEXAI=true),
 * GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, and configure ADC
 * (e.g. GOOGLE_APPLICATION_CREDENTIALS or gcloud application-default login).
 *
 * Google AI Studio: set GEMINI_API_KEY (or GOOGLE_API_KEY).
 */
const createGoogleGenAIClient = () => {
  if (isVertexAiMode()) {
    const project =
      process.env.GOOGLE_CLOUD_PROJECT || process.env.GEMINI_VERTEX_PROJECT;
    const location =
      process.env.GOOGLE_CLOUD_LOCATION || process.env.GEMINI_VERTEX_LOCATION;

    if (!project || !location) {
      throw new Error(
        "Vertex AI mode requires GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION " +
          "(or GEMINI_VERTEX_PROJECT and GEMINI_VERTEX_LOCATION)"
      );
    }

    const options = { vertexai: true, project, location };
    if (process.env.GEMINI_API_VERSION) {
      options.apiVersion = process.env.GEMINI_API_VERSION;
    }

    console.log(
      `Google GenAI client: Vertex AI (project=${project}, location=${location})`
    );
    return new GoogleGenAI(options);
  }

  const apiKey =
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  if (!apiKey) {
    throw new Error(
      "Google AI Studio mode requires GEMINI_API_KEY (or GOOGLE_API_KEY). " +
        "For Vertex AI, set GOOGLE_GENAI_USE_VERTEXAI=true with project and location."
    );
  }

  const options = { apiKey };
  if (process.env.GEMINI_API_VERSION) {
    options.apiVersion = process.env.GEMINI_API_VERSION;
  }

  console.log("Google GenAI client: Google AI Studio (API key)");
  return new GoogleGenAI(options);
};

/**
 * Stream Processing
 */

// Global audio resamplers - created once and shared across all connections
let globalDownsampler = null;
let globalUpsampler = null;

/**
 * Initializes global audio resamplers for format conversion.
 * Called once at server startup.
 */
const initializeResamplers = async () => {
  try {
    globalDownsampler = await create(1, 24000, 8000); // 1 channel, 24kHz to 8kHz
    globalUpsampler = await create(1, 8000, 16000); // 1 channel, 8kHz to 16kHz
    console.log("Global audio resamplers initialized");
  } catch (error) {
    console.error("Error initializing resamplers:", error);
    process.exit(1);
  }
};

const connectToGeminiSdk = async (sessionUuid, callbacks) => {
  const model =
    process.env.GEMINI_MODEL || "gemini-3.1-flash-live-preview";

  const config = {
    responseModalities: [Modality.AUDIO],
    systemInstruction:
      "You are a helpful assistant and answer in a friendly tone.",
    thinkingConfig: {
      thinkingLevel: process.env.GEMINI_THINKING_LEVEL || ThinkingLevel.MINIMAL,
    },
  };

  if (process.env.GEMINI_INSTRUCTIONS) {
    config.systemInstruction = process.env.GEMINI_INSTRUCTIONS;
    console.log("Using GEMINI_INSTRUCTIONS from environment variable");
  } else if (process.env.GEMINI_URL_INSTRUCTIONS) {
    try {
      const response = await axios.get(process.env.GEMINI_URL_INSTRUCTIONS, {
        headers: {
          "Content-Type": "application/json",
          "X-AVR-UUID": sessionUuid,
        },
      });
      console.log("Instructions loaded from GEMINI_URL_INSTRUCTIONS");
      const data = await response.data;
      console.log(data);
      config.systemInstruction = data.system;
    } catch (error) {
      console.error(
        `Error loading instructions from ${process.env.GEMINI_URL_INSTRUCTIONS}: ${error.message}`
      );
    }
  } else if (process.env.GEMINI_FILE_INSTRUCTIONS) {
    try {
      const data = await fs.readFile(
        process.env.GEMINI_FILE_INSTRUCTIONS,
        "utf8"
      );
      console.log("Using GEMINI_FILE_INSTRUCTIONS from environment variable");
      console.log(data);
      config.systemInstruction = data;
    } catch (error) {
      console.error(
        `Error loading instructions from ${process.env.GEMINI_FILE_INSTRUCTIONS}: ${error.message}`
      );
    }
  } else {
    console.log("Using default instructions");
    config.systemInstruction = "You are a helpful assistant and answer in a friendly tone.";
  }

  try {
    const tools = loadTools();
    config.tools = [{ functionDeclarations: tools }];
    console.log(`Loaded ${tools.length} tools for Gemini`);
  } catch (error) {
    console.error(`Error loading tools for Gemini: ${error.message}`);
  }

  console.log("Gemini Session Config:", config);
  console.log("Gemini Session Model:", model);

  const ai = createGoogleGenAIClient();

  const session = await ai.live.connect({
    model: model,
    callbacks,
    config,
  });

  return session;
};

/**
 * Handles incoming client WebSocket connection and manages communication with Gemini Live API.
 * Implements buffering for audio chunks received before WebSocket connection is established.
 *
 * @param {WebSocket} clientWs - Client WebSocket connection
 */
const handleClientConnection = (clientWs) => {
  console.log("New client WebSocket connection received");
  let sessionUuid = null;

  let audioBuffer8k = [];
  let session = null;
  let audioFrames = [];

  /**
   * Processes Gemini audio chunks by downsampling and extracting frames.
   * Converts 24kHz audio to 8kHz and extracts 20ms frames (160 samples).
   *
   * @param {Buffer} inputBuffer - Raw audio buffer from Gemini
   * @returns {Buffer[]} Array of 20ms audio frames
   */
  function processGeminiAudioChunk(inputBuffer) {
    // Convert Buffer to Int16Array for processing
    const inputSamples = new Int16Array(
      inputBuffer.buffer,
      inputBuffer.byteOffset,
      inputBuffer.length / 2
    );

    // Downsample from 24kHz to 8kHz using global downsampler
    const downsampledSamples = globalDownsampler.full(inputSamples);

    // Accumulate samples in buffer
    audioBuffer8k = audioBuffer8k.concat(Array.from(downsampledSamples));

    // Extract 20ms frames (160 samples = 320 bytes)
    const audioFrames = [];
    while (audioBuffer8k.length >= 160) {
      const frame = audioBuffer8k.slice(0, 160);
      audioBuffer8k = audioBuffer8k.slice(160);

      // Convert to PCM16LE Buffer (320 bytes)
      audioFrames.push(Buffer.from(Int16Array.from(frame).buffer));
    }

    return audioFrames;
  }

  /**
   * Converts 8kHz audio to 16kHz for sending to Gemini API.
   *
   * @param {Buffer} inputBuffer - 8kHz audio buffer
   * @returns {Buffer} 16kHz audio buffer
   */
  function convert8kTo16k(inputBuffer) {
    const inputSamples = new Int16Array(
      inputBuffer.buffer,
      inputBuffer.byteOffset,
      inputBuffer.length / 2
    );
    const upsampledSamples = globalUpsampler.full(inputSamples);
    return Buffer.from(Int16Array.from(upsampledSamples).buffer);
  }

  // Handle client WebSocket messages
  clientWs.on("message", (data) => {
    try {
      const message = JSON.parse(data);
      switch (message.type) {
        case "init":
          sessionUuid = message.uuid;
          console.log("Session UUID:", sessionUuid);
          // Initialize Gemini connection when client is ready
          initializeGeminiConnection();
          break;

        case "audio":
          // Handle audio data from client
          if (message.audio && session) {
            const audioBuffer = Buffer.from(message.audio, "base64");
            const upsampledAudio = convert8kTo16k(audioBuffer);
            session.sendRealtimeInput({
              audio: {
                data: upsampledAudio.toString("base64"),
                mimeType: "audio/pcm;rate=16000",
              },
            });
          }
          break;

        default:
          console.log("Unknown message type from client:", message.type);
          break;
      }
    } catch (error) {
      console.error("Error processing client message:", error);
    }
  });

  // Initialize Gemini connection
  const initializeGeminiConnection = async () => {
    try {
      session = await connectToGeminiSdk(sessionUuid, {
        onopen: function () {
          console.debug("Gemini Session Opened");
        },
        onmessage: async function (message) {
          if (message.serverContent?.modelTurn?.parts) {
            const part = message.serverContent?.modelTurn?.parts?.[0];
            if (part?.inlineData) {
              const inlineData = part.inlineData;
              const audioChunk = Buffer.from(inlineData.data, "base64");
              audioFrames = processGeminiAudioChunk(audioChunk);
              // Send audio frames to client
              audioFrames.forEach((frame) => {
                clientWs.send(
                  JSON.stringify({
                    type: "audio",
                    audio: frame.toString("base64"),
                  })
                );
              });
            }
          } else if (message.toolCall?.functionCalls) {
            console.log(
              "Gemini Session Tool Calls:",
              message.toolCall.functionCalls
            );
            const functionResponses = [];
            for (const fc of message.toolCall.functionCalls) {
              const handler = getToolHandler(fc.name);
              const obj = {
                id: fc.id,
                name: fc.name,
                response: { result: "" },
              };
              if (!handler) {
                obj.response.result = `I'm sorry, I cannot retrieve the requested information.`;
                functionResponses.push(obj);
              } else {
                obj.response.result = await handler(sessionUuid, fc.args);
                functionResponses.push(obj);
              }
              console.log("Gemini Session Tool Response:", obj.response.result);
            }

            session.sendToolResponse({ functionResponses });
          } else if (message.serverContent?.interrupted) {
            console.log("Gemini Session Interruption");
            audioFrames = [];
            clientWs.send(JSON.stringify({ type: "interruption" }));
          } else {
            // console.log("Gemini Session Message:", message);
          }
        },
        onerror: function (e) {
          console.error("Gemini Session Error:", e.message);
          clientWs.send(
            JSON.stringify({
              type: "error",
              message: e.message,
            })
          );
        },
        onclose: function (e) {
          console.info("Gemini Session Closed", e.reason);
          clientWs.close();
        },
      });
      // begin gemini conversation
      session.sendRealtimeInput({
        text: "Please start the conversation."
      });
    } catch (error) {
      console.error("Error initializing Gemini connection:", error);
      const message =
        error?.message ||
        "Failed to initialize Gemini connection";
      clientWs.send(
        JSON.stringify({
          type: "error",
          message,
        })
      );
    }
  };

  // Handle client WebSocket close
  clientWs.on("close", () => {
    console.log("Client WebSocket connection closed");
    cleanup();
  });

  clientWs.on("error", (err) => {
    console.error("Client WebSocket error:", err);
    cleanup();
  });

  /**
   * Cleans up resources and closes connections.
   */
  function cleanup() {
    if (session) session.close();
    if (clientWs) clientWs.close();
  }
};

/**
 * Global cleanup function to destroy resamplers when the process is terminated.
 */
const cleanupGlobalResources = () => {
  console.log("Cleaning up global resources...");
  if (globalDownsampler) {
    globalDownsampler.destroy();
    globalDownsampler = null;
  }
  if (globalUpsampler) {
    globalUpsampler.destroy();
    globalUpsampler = null;
  }
  console.log("Global resources cleaned up");
};

// Handle process termination signals
process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down gracefully...");
  cleanupGlobalResources();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down gracefully...");
  cleanupGlobalResources();
  process.exit(0);
});

// Initialize resamplers and start server
const startServer = async () => {
  try {
    await initializeResamplers();

    // Create WebSocket server
    const PORT = process.env.PORT || 6037;
    const wss = new WebSocket.Server({ port: PORT });

    wss.on("connection", (clientWs) => {
      console.log("New client connected");
      handleClientConnection(clientWs);
    });

    console.log(
      `Gemini Speech-to-Speech WebSocket server running on port ${PORT}`
    );
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();
