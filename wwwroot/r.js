import { InputServiceClient } from './InputServiceClientPb.js';
import * as input_pb from './input_pb.js';
// 👇 Import HubConnectionBuilder directly from your local file
import { HubConnectionBuilder } from './signalr.js';

const videoElement = document.getElementById('remoteVideo');
const overlay = document.getElementById('overlay');
const grpcClient = new InputServiceClient(`${window.location.protocol}//${window.location.host}`);

let pc;
let connection;

function createPeerConnection() {
    pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.ontrack = (event) => {
        console.log("Track received:", event.track);
        if (videoElement.srcObject !== event.streams[0]) {
            videoElement.srcObject = event.streams[0];
            overlay.style.display = 'none';
            videoElement.play().catch(e => console.error("Video play failed:", e));
        }
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            connection.invoke("SendCandidate", event.candidate)
                .catch(err => console.error("SendCandidate Error:", err));
        }
    };

    pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log("Peer connection state:", state);
        overlay.innerText = `Connection: ${state}`;
        if (state === 'connected' || state === 'completed') {
            overlay.style.display = 'none';
        } else {
            overlay.style.display = 'block';
        }
    };
}

async function startSignalR() {
    // 👇 Notice we no longer use the global 'signalR' object
    connection = new HubConnectionBuilder()
        .withUrl("/webrtchub")
        .withAutomaticReconnect()
        .build();

    // The rest of the logic remains the same...

    connection.on("ReceiveAnswer", async (answer) => {
        console.log("Received SDP Answer from server");
        if (pc.signalingState !== 'stable') {
            await pc.setRemoteDescription(answer);
        }
    });

    connection.on("ReceiveCandidate", async (candidate) => {
        console.log("Received ICE Candidate from server");
        if (candidate) {
            await pc.addIceCandidate(candidate);
        }
    });

    connection.onclose(async () => {
        console.log("SignalR connection closed.");
        overlay.innerText = `Connection: disconnected`;
        overlay.style.display = 'block';
    });

    try {
        await connection.start();
        console.log("SignalR Connected.");

        createPeerConnection();

        const offer = await pc.createOffer({ offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);

        await connection.invoke("SendOffer", pc.localDescription);
        console.log("Sent SDP Offer to server");

    } catch (err) {
        console.error("SignalR Connection Error: ", err);
        setTimeout(startSignalR, 5000);
    }
}

// --- Input Handling (Unchanged) ---
videoElement.addEventListener('contextmenu', e => e.preventDefault());

videoElement.addEventListener('mousemove', (e) => {
    const rect = videoElement.getBoundingClientRect();
    const x = e.clientX / rect.width;
    const y = e.clientY / rect.height;
    const request = new input_pb.MouseMoveEvent();
    request.setX(x);
    request.setY(y);
    grpcClient.sendMouseMove(request, {}, (err) => {
        if (err) console.error("sendMouseMove Error:", err);
    });
});

videoElement.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const request = new input_pb.MouseButtonEvent();
    request.setButton(e.button);
    grpcClient.sendMouseDown(request, {}, (err) => {
        if (err) console.error("sendMouseDown Error:", err);
    });
});

videoElement.addEventListener('mouseup', (e) => {
    e.preventDefault();
    const request = new input_pb.MouseButtonEvent();
    request.setButton(e.button);
    grpcClient.sendMouseUp(request, {}, (err) => {
        if (err) console.error("sendMouseUp Error:", err);
    });
});

videoElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    const request = new input_pb.MouseWheelEvent();
    request.setDeltaY(e.deltaY > 0 ? 1 : -1);
    grpcClient.sendMouseWheel(request, {}, (err) => {
        if (err) console.error("sendMouseWheel Error:", err);
    });
});

window.addEventListener('keydown', (e) => {
    e.preventDefault();
    const request = new input_pb.KeyEvent();
    request.setKey(e.code);
    grpcClient.sendKeyDown(request, {}, (err) => {
        if (err) console.error("sendKeyDown Error:", err);
    });
});

window.addEventListener('keyup', (e) => {
    e.preventDefault();
    const request = new input_pb.KeyEvent();
    request.setKey(e.code);
    grpcClient.sendKeyUp(request, {}, (err) => {
        if (err) console.error("sendKeyUp Error:", err);
    });
});

// Start the connection process
startSignalR();