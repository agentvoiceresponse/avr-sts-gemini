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
```

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

AVR is free and open-source. If you find it valuable, consider supporting its development:

<a href="https://ko-fi.com/agentvoiceresponse" target="_blank"><img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support us on Ko-fi"></a>

## License

MIT License - see the [LICENSE](LICENSE.md) file for details.
