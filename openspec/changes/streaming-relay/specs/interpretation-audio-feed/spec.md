# Spec Delta

## Purpose

Delivers the interpreter-only audio track to listeners' browsers (mainly phones in the conference room, on Wi-Fi or 5G) with low latency, restricted to people holding the AG access code.

## ADDED Requirements

### Requirement: Interpreter-only audio feed
The relay SHALL publish audio track 3 as an audio-only feed encoded in a codec playable by browsers over WebRTC, available while the ingest stream is live.

#### Scenario: Feed available during the AG
- **WHEN** the ingest stream is live
- **THEN** an audio-only interpretation feed is available for WebRTC playback containing only the interpreter's voice

### Requirement: Low-latency delivery
The interpretation feed SHALL be delivered over WebRTC (WHEP), with a target end-to-end latency (interpreter's microphone to listener's ear) under 1 second on a normal connection.

#### Scenario: Latency measurement
- **WHEN** a listener on the venue Wi-Fi or on 5G plays the feed and a test sound is made into the interpreter's microphone
- **THEN** the listener hears it less than 1 second later

### Requirement: Same entry point for Wi-Fi and mobile data
The feed SHALL be reachable at one public HTTPS address on the web app's host, so that listeners get it the same way on the venue Wi-Fi or on mobile data.

#### Scenario: Listener on 5G
- **WHEN** a listener with the access cookie opens the feed on mobile data
- **THEN** playback starts as it does for a listener on the venue Wi-Fi

### Requirement: Access restricted by the web app's check
Every WebRTC signaling request for the feed SHALL be authorized by the web app's access check; unauthorized requests SHALL be refused before any media session is negotiated.

#### Scenario: Request with a valid access cookie
- **WHEN** a browser holding a valid participant access cookie requests the feed
- **THEN** the signaling request is forwarded to the media server and playback can start

#### Scenario: Request without access
- **WHEN** a client without a valid access cookie requests the feed
- **THEN** the request is refused with an unauthorized status and no media session is created

### Requirement: Minimal public surface
Apart from the feed's WebRTC signaling endpoint and its media ports, no media-server interface (API, metrics, HLS, built-in player pages, other paths) SHALL be reachable from the internet.

#### Scenario: Probing other media-server endpoints
- **WHEN** an external client requests the media server's API, metrics, HLS output or built-in player page
- **THEN** the request is refused or not routed
