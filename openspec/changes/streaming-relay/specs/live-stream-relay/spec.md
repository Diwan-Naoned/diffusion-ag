# Spec Delta

## Purpose

Receives the venue's single multitrack live stream and redistributes it to the two public YouTube live streams (original sound and sound with interpretation), so the venue only has to upload once.

## ADDED Requirements

### Requirement: Authenticated multitrack ingest
The relay SHALL accept one SRT publication containing one video track and three audio tracks (1: room, 2: room + interpreter, 3: interpreter only), and SHALL reject publications that do not present the configured publish credentials.

#### Scenario: OBS publishes with valid credentials
- **WHEN** OBS publishes an SRT stream with the configured publish credentials and 1 video + 3 audio tracks
- **THEN** the relay accepts the stream and exposes all four tracks to the fan-out

#### Scenario: Publication with wrong credentials
- **WHEN** a client publishes to the SRT endpoint with missing or wrong credentials
- **THEN** the relay refuses the publication and no fan-out starts

### Requirement: Fan-out to two YouTube live streams
While the ingest stream is live, the relay SHALL push the video with audio track 1 to YouTube stream A and the video with audio track 2 to YouTube stream B, without re-encoding the video.

#### Scenario: Both YouTube streams receive the right audio
- **WHEN** the ingest stream is live
- **THEN** YouTube stream A receives the video with the room sound only
- **AND** YouTube stream B receives the same video with the room sound mixed with the interpreter

### Requirement: Independent YouTube outputs
A failure of one YouTube output SHALL NOT interrupt the other YouTube output or the interpretation feed.

#### Scenario: One YouTube ingest rejects the stream
- **WHEN** YouTube stream B becomes unreachable or rejects the connection while the ingest is live
- **THEN** YouTube stream A and the interpretation feed keep running
- **AND** the relay retries the failed output

### Requirement: Automatic recovery after publisher reconnection
The relay SHALL keep its ingest endpoint available when the publisher disconnects, and SHALL resume all outputs automatically when the publisher reconnects, without operator action on the VPS.

#### Scenario: Venue connection switches from Wi-Fi to 5G
- **WHEN** the OBS connection drops and OBS reconnects to the same endpoint from another network
- **THEN** the fan-out restarts by itself and both YouTube streams and the interpretation feed resume

#### Scenario: Publisher stops
- **WHEN** OBS stops publishing
- **THEN** the fan-out stops and no orphaned processes remain on the VPS

### Requirement: Single venue upload
The relay SHALL require only one outgoing stream from the venue, whose bitrate fits within the venue's 5G backup uplink (about 9 Mb/s).

#### Scenario: Running on the 5G backup
- **WHEN** the venue laptop publishes over the 5G backup at the recommended OBS bitrate
- **THEN** both YouTube streams and the interpretation feed are served without the venue sending additional streams

### Requirement: Internal ingest path is not publicly readable
The full multitrack ingest stream SHALL NOT be readable from the internet; only the relay's own fan-out may read it.

#### Scenario: Attempt to read the ingest path
- **WHEN** an external client tries to read the ingest stream over any protocol exposed by the VPS
- **THEN** the request is refused
