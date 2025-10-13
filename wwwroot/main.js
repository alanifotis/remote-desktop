import { InputServiceClient } from './InputServiceClientPb.js';
import * as input_pb from './input_pb.js';

const videoElement = document.getElementById('remoteVideo');
const overlay = document.getElementById('overlay');
const startButton = document.getElementById('startButton');
const grpcClient = new InputServiceClient(`${window.location.protocol}//${window.location.host}`);
let pc;
let ws;

// *** NEW: Create a buffer for ICE candidates that arrive too early ***
let iceCandidateBuffer = [];

function registerInputHandlers() {
    // ... (This function remains unchanged, no need to copy it again)
    console.log("Stream is active. Registering input handlers.");
    videoElement.addEventListener('contextmenu', e => e.preventDefault());
    videoElement.addEventListener('mousemove', (e) => {
        const rect = videoElement.getBoundingClientRect();
        const x = e.clientX / rect.width;
        const y = e.clientY / rect.height;
        const request = new input_pb.MouseMoveEvent();
        request.setX(x);
        request.setY(y);
        grpcClient.sendMouseMove(request, {}, (err, response) => { if (err) console.error("sendMouseMove Error:", err); });
    });
    videoElement.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const request = new input_pb.MouseButtonEvent();
        request.setButton(e.button);
        grpcClient.sendMouseDown(request, {}, (err, response) => { if (err) console.error("sendMouseDown Error:", err); });
    });
    videoElement.addEventListener('mouseup', (e) => {
        e.preventDefault();
        const request = new input_pb.MouseButtonEvent();
        request.setButton(e.button);
        grpcClient.sendMouseUp(request, {}, (err, response) => { if (err) console.error("sendMouseUp Error:", err); });
    });
    videoElement.addEventListener('wheel', (e) => {
        e.preventDefault();
        const request = new input_pb.MouseWheelEvent();
        request.setDeltaY(e.deltaY > 0 ? 1 : -1);
        grpcClient.sendMouseWheel(request, {}, (err, response) => { if (err) console.error("sendMouseWheel Error:", err); });
    });
    window.addEventListener('keydown', (e) => {
        e.preventDefault();
        const request = new input_pb.KeyEvent();
        request.setKey(e.code);
        grpcClient.sendKeyDown(request, {}, (err, response) => { if (err) console.error("sendKeyDown Error:", err); });
    });
    window.addEventListener('keyup', (e) => {
        e.preventDefault();
        const request = new input_pb.KeyEvent();
        request.setKey(e.code);
        grpcClient.sendKeyUp(request, {}, (err, response) => { if (err) console.error("sendKeyUp Error:", err); });
    });
}

function connect() {
    iceCandidateBuffer = []; // Reset buffer on new connection
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);

    pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.ontrack = (event) => {
        if (videoElement.srcObject !== event.streams[0]) {
            videoElement.srcObject = event.streams[0];
            overlay.style.display = 'none';
            registerInputHandlers();
            videoElement.play().catch(e => console.error("Video play failed:", e));
        }
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({ candidate: event.candidate }));
        }
    };

    pc.onconnectionstatechange = () => { /* ... (This is unchanged) ... */ };

    ws.onopen = async () => {
        console.log("WebSocket connected.");
        const offer = await pc.createOffer({ offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify(pc.localDescription));
    };

    // *** MODIFIED: The ws.onmessage handler is updated to handle the race condition ***
    ws.onmessage = async (event) => {
        try {
            const msg = JSON.parse(event.data);

            if (msg.type === 'answer') {
                if (pc.signalingState !== 'stable') {
                    console.log("Received answer. Setting remote description.");
                    await pc.setRemoteDescription(new RTCSessionDescription(msg));

                    // Now that the remote description is set, process any buffered candidates
                    console.log(`Processing ${iceCandidateBuffer.length} buffered ICE candidates.`);
                    for (const candidate of iceCandidateBuffer) {
                        await pc.addIceCandidate(candidate);
                    }
                    iceCandidateBuffer = []; // Clear the buffer
                }
            } else if (msg.candidate) {
                // If the remote description isn't set yet, buffer the candidate. Otherwise, add it directly.
                if (pc.remoteDescription) {
                    await pc.addIceCandidate(msg.candidate);
                } else {
                    console.log("Buffering ICE candidate until remote description is set.");
                    iceCandidateBuffer.push(msg.candidate);
                }
            }
        } catch (e) {
            console.error("Error processing WebSocket message:", e);
        }
    };

    ws.onclose = () => { /* ... (This is unchanged) ... */ };
    ws.onerror = (error) => { /* ... (This is unchanged) ... */ };
}

// --- Initial Setup ---
startButton.addEventListener('click', () => {
    // ... (This is unchanged)
    startButton.innerText = 'Connecting...';
    startButton.disabled = true;
    connect();
});