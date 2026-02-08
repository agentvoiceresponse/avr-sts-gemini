# Agent Voice Response - Gemini Speech-to-Speech Integration

[![Discord](https://img.shields.io/discord/1347239846632226998?label=Discord&logo=discord)](https://discord.gg/DFTU69Hg74)
[![GitHub Repo stars](https://img.shields.io/github/stars/agentvoiceresponse/avr-sts-gemini?style=social)](https://github.com/agentvoiceresponse/avr-sts-gemini)
[![Docker Pulls](https://img.shields.io/docker/pulls/agentvoiceresponse/avr-sts-gemini?label=Docker%20Pulls&logo=docker)](https://hub.docker.com/r/agentvoiceresponse/avr-sts-gemini)
[![Ko-fi](https://img.shields.io/badge/Support%20us%20on-Ko--fi-ff5e5b.svg)](https://ko-fi.com/agentvoiceresponse)

This repository showcases the integration between **Agent Voice Response** and **Gemini Live Speech-to-Speech API**. The application leverages Gemini's powerful language model to process audio input from users, providing intelligent, context-aware responses in real-time audio format with automatic audio format conversion.

## Features

- **Real-time Streaming**: WebSocket-based audio streaming with Gemini Live API
- **Audio Format Conversion**: Automatic conversion between 8kHz, 16kHz, and 24kHz sample rates
- **Gemini Integration**: Direct integration with Google's Gemini Live Speech-to-Speech API
- **Configurable Audio Settings**: Customizable sample rates and buffer sizes
- **Session Management**: Efficient WebSocket session handling for continuous audio streaming

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure the following variables:

Required:

```
GEMINI_API_KEY: Google API key with access to Gemini Live
```

Optional:

```
PORT (default: 6037)
GEMINI_MODEL (default: gemini-2.5-flash-preview-native-audio-dialog)
GEMINI_INSTRUCTIONS (system prompt)

# Choose one of the following instruction loading methods:
GEMINI_INSTRUCTIONS="You are a helpful assistant that can answer questions and help with tasks."  # Method 1: Direct variable
#GEMINI_URL_INSTRUCTIONS="https://your-api.com/instructions"  # Method 2: Web service
#GEMINI_FILE_INSTRUCTIONS="./instructions.txt"  # Method 3: Local file

```

### Gemini thinking settings

We’ve added support for the following Gemini settings:

- `GEMINI_THINKING_LEVEL=MINIMAL`
- `GEMINI_THINKING_BUDGET=0`

More details here 👉 https://ai.google.dev/gemini-api/docs/thinking?hl=en

Supported values for `GEMINI_THINKING_LEVEL`:

- `THINKING_LEVEL_UNSPECIFIED`
- `LOW`
- `MEDIUM`
- `HIGH`
- `MINIMAL`

`GEMINI_THINKING_BUDGET`:

- `0` → turn off thinking
- `-1` → enable dynamic thinking


## Usage

### Starting the Server

```bash
npm install
npm start
```

### Making Requests

Send a POST request to `/speech-to-speech-stream` with:

- **Headers:**
  - `x-uuid`: Unique identifier for the call
  - `Content-Type`: `audio/pcm` or appropriate audio format

- **Body:** Raw audio data stream (8kHz PCM recommended)

## API Response

The service returns a stream of audio data from Gemini. The response includes:

- Real-time audio chunks from the AI
- Audio format conversion (8kHz ↔ 16kHz ↔ 24kHz)
- Session management and WebSocket communication

### Instruction Loading Methods

The application supports three different methods for loading AI instructions, with a specific priority order:

#### 1. Environment Variable (Highest Priority)
Set the `GEMINI_INSTRUCTIONS` environment variable with your custom instructions:

```bash
GEMINI_INSTRUCTIONS="You are a specialized customer service agent for a tech company. Always be polite and helpful."
```

#### 2. Web Service (Medium Priority)
If no environment variable is set, the application can fetch instructions from a web service using the `GEMINI_URL_INSTRUCTIONS` environment variable:

```bash
GEMINI_URL_INSTRUCTIONS="https://your-api.com/instructions"
```

The web service should return a JSON response with a `system` field containing the instructions:
```json
{
  "system": "You are a helpful assistant that provides technical support."
}
```

The application will include the session UUID in the request headers as `X-AVR-UUID` for personalized instructions.

#### 3. File (Lowest Priority)
If neither environment variable nor web service is configured, the application can load instructions from a local file using the `GEMINI_FILE_INSTRUCTIONS` environment variable:

```bash
GEMINI_FILE_INSTRUCTIONS="./instructions.txt"
```

The file should contain plain text instructions that will be used as the system prompt.

#### Priority Order
The application checks for instructions in the following order:
1. **Environment Variable** (`GEMINI_INSTRUCTIONS`) - Used if set
2. **Web Service** (`GEMINI_URL_INSTRUCTIONS`) - Used if environment variable is not set
3. **File** (`GEMINI_FILE_INSTRUCTIONS`) - Used if neither environment variable nor web service is configured
4. **Default Instructions** - Fallback if none of the above are available

This priority system allows for flexible configuration where you can override instructions at different levels depending on your deployment needs.



## Error Handling

The service handles various error scenarios:

- Missing required environment variables
- Invalid API responses
- WebSocket connection failures
- Audio processing errors
- Audio format conversion issues

## Docker Support

```bash
# Build the image
docker build -t avr-sts-gemini .

# Run with environment file
docker run --env-file .env -p 6037:6037 avr-sts-gemini
```

## Support & Community

*   **GitHub:** [https://github.com/agentvoiceresponse](https://github.com/agentvoiceresponse) - Report issues, contribute code.
*   **Discord:** [https://discord.gg/DFTU69Hg74](https://discord.gg/DFTU69Hg74) - Join the community discussion.
*   **Docker Hub:** [https://hub.docker.com/u/agentvoiceresponse](https://hub.docker.com/u/agentvoiceresponse) - Find Docker images.
*   **Wiki:** [https://wiki.agentvoiceresponse.com/en/home](https://wiki.agentvoiceresponse.com/en/home) - Project documentation and guides.

## Support AVR

AVR is free and open-source.
Any support is entirely voluntary and intended as a personal gesture of appreciation.
Donations do not provide access to features, services, or special benefits, and the project remains fully available regardless of donations.

<a href="https://ko-fi.com/agentvoiceresponse" target="_blank"><img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support us on Ko-fi"></a>

## License

MIT License - see the [LICENSE](LICENSE.md) file for details.
