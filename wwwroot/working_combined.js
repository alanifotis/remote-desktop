// ======================================================
// --- 1. GRPC IMPORTS ---
// ======================================================
import { InputServiceClient } from './InputServiceClientPb.js';
import * as input_pb from './input_pb.js';


// ======================================================
// --- 2. ON-SCREEN CONSOLE SCRIPT ---
// ======================================================

const logContainer = document.getElementById('log-container');

function logToScreen(message, level = 'log') {
    if (!logContainer) return;
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('p');
    logEntry.className = `log-entry ${level}`;
    logEntry.textContent = `[${timestamp}] ${message}`;
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

const originalConsole = { log: console.log, warn: console.warn, error: console.error, debug: console.debug };

console.log = function() {
    const message = Array.from(arguments).map(String).join(' ');
    logToScreen(message, 'log');
    originalConsole.log.apply(console, arguments);
};
console.warn = function() {
    const message = Array.from(arguments).map(String).join(' ');
    logToScreen(message, 'warn');
    originalConsole.warn.apply(console, arguments);
};
console.error = function() {
    const message = Array.from(arguments).map(String).join(' ');
    logToScreen(message, 'error');
    originalConsole.error.apply(console, arguments);
};
console.debug = function() {
    const message = Array.from(arguments).map(String).join(' ');
    logToScreen(message, 'log');
    originalConsole.debug.apply(console, arguments);
};
window.onerror = function(message, source, lineno, colno, error) {
    console.error(`Uncaught Error: ${message} at ${source}:${lineno}:${colno}`);
    return true;
};


// ======================================================
// --- 3. GRPC INPUT HANDLER ---
// ======================================================

const grpcClient = new InputServiceClient(`${window.location.protocol}//${window.location.host}`);
const videoControl = document.getElementById('videoCtl'); // Get video element

function registerInputHandlers() {
    if (!videoControl) {
        console.error("Failed to find video element #videoCtl for input handlers.");
        return;
    }

    console.log("Stream is active. Registering input handlers.");

    videoControl.addEventListener('contextmenu', e => e.preventDefault());

    videoControl.addEventListener('mousemove', (e) => {
        const rect = videoControl.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const x = e.clientX / rect.width;
        const y = e.clientY / rect.height;
        const request = new input_pb.MouseMoveEvent();
        request.setX(x);
        request.setY(y);
        grpcClient.sendMouseMove(request, {}, (err, response) => { if (err) console.error("sendMouseMove Error:", err); });
    });

    videoControl.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const request = new input_pb.MouseButtonEvent();
        request.setButton(e.button);
        grpcClient.sendMouseDown(request, {}, (err, response) => { if (err) console.error("sendMouseDown Error:", err); });
    });

    videoControl.addEventListener('mouseup', (e) => {
        e.preventDefault();
        const request = new input_pb.MouseButtonEvent();
        request.setButton(e.button);
        grpcClient.sendMouseUp(request, {}, (err, response) => { if (err) console.error("sendMouseUp Error:", err); });
    });

    videoControl.addEventListener('wheel', (e) => {
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


// ======================================================
// --- 4. WEBRTC SCRIPT (The working "Answerer") ---
// ======================================================

const wsProtocol = window.location.protocol === "https:" ? "wss://" : "ws://";
const wsHostname = window.location.hostname;
const wsPort = "8081"; // Your server's WebSocket port
const receiveOfferUrl = `${wsProtocol}${wsHostname}:${wsPort}/`;

let pc;
let ws;
const startBtn = document.getElementById('startButton');
const stopBtn = document.getElementById('stopButton');

async function start() {
    console.log(`Connecting to ${receiveOfferUrl}`);
    if (startBtn) startBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;

    closePeer(); // Close any existing connections

    try {
        ws = new WebSocket(receiveOfferUrl, []);
    } catch (err) {
        console.error("Failed to create WebSocket:", err);
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        return;
    }

    ws.onopen = async function () {
        console.log("WebSocket connected. Waiting for offer...");
        try {
            const rtcConfig = {
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            };
            pc = new RTCPeerConnection(rtcConfig);

            pc.ontrack = ({ track, streams: [stream] }) => {
                track.onunmute = () => {
                    console.log("Adding track to video control.");
                    videoControl.srcObject = stream;
                    registerInputHandlers(); // Register inputs AFTER track is live
                };
            };

            pc.onicecandidate = function (event) {
                if (event.candidate) {
                    if (event.candidate.candidate.includes('.local')) {
                        console.warn("Skipping mDNS/local-IP-hiding candidate:", event.candidate.candidate);
                        return;
                    }
                    console.log("Sending ICE candidate:", event.candidate.candidate);
                    ws.send(JSON.stringify(event.candidate.toJSON()));
                } else {
                    console.log("End of ICE candidates.");
                }
            };

            pc.onicegatheringstatechange = () => console.log("ICE gathering state:", pc.iceGatheringState);
            pc.oniceconnectionstatechange = (e) => {
                console.log("ICE connection state:", pc.iceConnectionState);
                if (pc.iceConnectionState === 'connected') {
                    console.log("WebRTC Connected!");
                } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed') {
                    console.warn("WebRTC Disconnected.");
                    closePeer(); // Trigger cleanup
                }
            };

        } catch (err) {
            console.error("Error during WebRTC setup:", err);
            if (startBtn) startBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = true;
        }
    };

    ws.onmessage = async function (evt) {
        try {
            let data = evt.data;

            if (data.startsWith("{")) {
                const candidate = JSON.parse(data);
                if (candidate.candidate && candidate.candidate.includes('.local')) {
                    console.warn("Skipping mDNS candidate from server:", candidate.candidate);
                    return;
                }
                console.log("Received ICE candidate:", candidate.candidate || "null");
                await pc.addIceCandidate(candidate);
            } else if (data.includes("v=0")) {
                console.log("Received SDP offer.");
                await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: data }));

                console.log("Creating SDP answer.");
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                console.log("Sending SDP answer.");
                ws.send(pc.localDescription.sdp);
            } else {
                console.warn("Unknown message received:", data);
            }
        } catch (err) {
            console.error("Failed to handle message:", err, "Data:", evt.data);
        }
    };

    ws.onclose = function (event) {
        console.warn(`WebSocket closed: ${event.reason || 'No reason specified'} (Code: ${event.code})`);
        if (event.code === 1006 && wsProtocol === "wss://") {
            showCertError();
        }
        // Ensure UI is reset on close
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
    };

    ws.onerror = function (err) {
        console.error("WebSocket error. See browser console for details.");
        if (wsProtocol === "wss://") {
            showCertError();
        }
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
    };
}

function closePeer() {
    if (ws) {
        console.log("Closing WebSocket.");
        ws.onclose = null; // Prevent onclose from firing during manual close
        ws.close();
        ws = null;
    }
    if (pc) {
        console.log("Closing PeerConnection.");
        pc.close();
        pc = null;
    }

    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;

    if (videoControl) videoControl.srcObject = null; // Clear video
}

function showCertError() {
    console.error("--- CERTIFICATE ERROR ---");
    console.error("Secure connection (wss://) failed. This is likely because the device does not trust the server's self-signed certificate.");
    console.error(`Please go to https://${wsHostname}:${window.location.port}/cert to download the CA certificate.`);
    console.error("You must then manually install it in your device's 'Trusted Root' store and restart the browser.");
    console.error("--------------------------");
}


// ======================================================
// --- 5. EVENT LISTENER ATTACHMENT ---
// ======================================================

// This waits for the HTML to be fully loaded before finding the buttons.
// This is the correct, robust way to connect HTML to a module script.
document.addEventListener('DOMContentLoaded', () => {

    if (startBtn) {
        startBtn.addEventListener('click', start);
    } else {
        console.error("Could not find button with id='startButton'");
    }

    if (stopBtn) {
        stopBtn.addEventListener('click', closePeer);
        stopBtn.disabled = true; // Disabled by default
    } else {
        console.error("Could not find button with id='stopButton'");
    }

    console.log("Event listeners registered.");
});