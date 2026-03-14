---
name: "qt-network-helper"
framework: claude
---

## When to use
Use when making HTTP/HTTPS requests with QNetworkAccessManager, parsing REST API responses, handling authentication headers, or debugging network errors and SSL issues in a Qt application.

## Example requests
- Write a GET request with QNetworkAccessManager that parses a JSON response
- How do I add a Bearer token header to every request?
- My SSL connection is failing with an unknown certificate error — how do I fix it?
- Implement a simple request queue that limits concurrent calls to 3

## Expected inputs
The API endpoint and method, the request/response format, and any authentication requirements. For bug reports: the existing code and the error message or unexpected behaviour.

## Expected outputs
A complete, non-blocking implementation using QNetworkAccessManager with signals/slots for response handling, correct Content-Type and custom headers, JSON parsing via QJsonDocument, and error handling for network and HTTP-level failures.

## Hard rules
- Never block the event loop waiting for a network reply — always use signals or QNetworkReply finished
- Never ignore SSL errors silently — only suppress with explicit user acknowledgement or pinning
- Always delete QNetworkReply objects after handling to avoid memory leaks
- Never hardcode API keys or tokens in source — always read from config or environment
