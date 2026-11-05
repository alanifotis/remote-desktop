# Remote Desktop Server

A high-performance, low-latency remote desktop server built with **.NET 10** and **FFmpeg**, utilizing WebRTC and hardware-accelerated NVIDIA NVENC encoding for real-time desktop sharing.

## Description
This project streams your Windows desktop to a web browser in real time using WebRTC. It captures the screen via FFmpeg's `gdigrab`, encodes it using hardware-accelerated NVIDIA NVENC (`h264_nvenc`), and feeds it into a .NET 10 WebRTC backend (`SIPSorcery`) combined with gRPC and WebSockets.

## Prerequisites
- **Windows OS** (required for `gdigrab` screen capture).
- **.NET 10 SDK** installed.
- **FFmpeg** installed and added to your system PATH with NVENC support.

## Download & Installation
1. Clone the repository:
   ```bash
   git clone [https://github.com/alanifotis/remote-desktop.git](https://github.com/alanifotis/remote-desktop.git)
   cd remote-desktop
   ```
2. Ensure you have .NET 10 and FFmpeg installed.

## How to Run

### Step 1: Start the FFmpeg Streamer
Open a terminal and run the FFmpeg capture command to stream your desktop to the local RTP listener and generate the `ffmpeg.sdp` file:

```bash
ffmpeg -f gdigrab -framerate 60 -i desktop -vf "scale=1920:1080:force_original_aspect_ratio=decrease:flags=bilinear,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p" -c:v h264_nvenc -profile:v baseline -preset:v p1 -tune:v ll -delay 0 -rc vbr -b:v 6M -maxrate 8M -bufsize 2M -g 60 -bf 0 -ssrc 112233 -pkt_size 1200 -f rtp rtp://127.0.0.1:5004 -sdp_file ffmpeg.sdp
```

### Step 2: Run the .NET Server
In a separate terminal window, navigate to the project directory and start the application:

```bash
dotnet run
```