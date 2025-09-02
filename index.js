/**
 * index.js
 * Entry point for the Gemini Speech-to-Speech streaming application.
 * This server handles real-time audio streaming between clients and Gemini's API,
 * performing necessary audio format conversions and WebSocket communication.
 * Supports both agent-specific calls and generic calls.
 *
 * @author Agent Voice Response <info@agentvoiceresponse.com>
 * @see https://www.agentvoiceresponse.com
 */

const express = require("express");
const { create } = require("@alexanderolsen/libsamplerate-js");
const { GoogleGenAI, Modality, TurnCoverage } = require("@google/genai");

require("dotenv").config();

// Initialize Express application
const app = express();

const connectToGeminiSdk = async (callbacks) => {
  const model =
    process.env.GEMINI_MODEL || "gemini-2.5-flash-preview-native-audio-dialog";

  const config = {
    responseModalities: [Modality.AUDIO],
    systemInstruction:
      process.env.GEMINI_INSTRUCTIONS ||
      "You are a helpful assistant and answer in a friendly tone.",
  };

  console.log("Gemini Session Config:", config);
  console.log("Gemini Session Model:", model);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  const session = await ai.live.connect({
    model: model,
    callbacks,
    config,
  });

  return session;
};

/**
 * Handles incoming client audio stream and manages communication with Gemini Live API.
 * Buffers audio chunks and sends fixed-size frames upstream; buffers downlink audio and
 * writes fixed-size frames downstream to the HTTP response.
 */
const handleAudioStream = async (req, res) => {
  console.log("New audio stream received (Gemini)");
  const sessionUuid = req.headers["x-uuid"];
  console.log("Session UUID:", sessionUuid);

  const downsampler = await create(1, 24000, 8000); // 1 channel, 24kHz to 8kHz
  const upsampler = await create(1, 8000, 16000); // 1 channel, 8kHz to 24kHz

  let audioBuffer8k = [];

  function convert24kTo8k(inputBuffer) {
    const inputSamples = new Int16Array(
      inputBuffer.buffer,
      inputBuffer.byteOffset,
      inputBuffer.length / 2
    );
    const downsampledSamples = downsampler.full(inputSamples);
    audioBuffer8k = audioBuffer8k.concat(Array.from(downsampledSamples));
    const audioFrames = [];
    while (audioBuffer8k.length >= 160) {
      const frame = audioBuffer8k.slice(0, 160);
      audioBuffer8k = audioBuffer8k.slice(160);
      audioFrames.push(Buffer.from(Int16Array.from(frame).buffer));
    }

    return audioFrames;
  }

  function convert8kTo16k(inputBuffer) {
    const inputSamples = new Int16Array(
      inputBuffer.buffer,
      inputBuffer.byteOffset,
      inputBuffer.length / 2
    );
    const upsampledSamples = upsampler.full(inputSamples);
    return Buffer.from(Int16Array.from(upsampledSamples).buffer);
  }

  const sdkCallbacks = {
    onopen: function () {
      console.debug("Gemini Session Opened");
    },
    onmessage: function (message) {
      if(message.serverContent?.modelTurn?.parts) {
        const part = message.serverContent?.modelTurn?.parts?.[0];
        if (part?.inlineData) {
          const inlineData = part.inlineData;
          const audioChunk = Buffer.from(inlineData.data, "base64");
          const audioFrames = convert24kTo8k(audioChunk);
          audioFrames.forEach((frame) => {
            res.write(frame);
          });
        }
        if (part?.text) {
          console.debug("Gemini Session Text:", part.text);
        }
      }
    },
    onerror: function (e) {
      console.error("Gemini Session Error:", e.message);
    },
    onclose: function () {
      console.info("Gemini Session Closed");
    },
  };
  const session = await connectToGeminiSdk(sdkCallbacks);

  req.on("data", (chunk) => {
    const upsampledAudio = convert8kTo16k(chunk); // Convert 8kHz to 16kHz
    const base64Audio = upsampledAudio.toString("base64");
    session.sendRealtimeInput({
      audio: {
        data: base64Audio,
        mimeType: "audio/pcm;rate=16000",
      },
    });
  });

  req.on("end", () => {
    console.log("Request stream ended");
    session.close();
  });

  req.on("error", (err) => {
    console.error("Request error:", err);
    session.close();
  });
};

// API Endpoints
app.post("/speech-to-speech-stream", handleAudioStream);

// Start server
const PORT = process.env.PORT || 6037;
app.listen(PORT, () => {
  console.log(`Gemini Speech-to-Speech server running on port ${PORT}`);
});
