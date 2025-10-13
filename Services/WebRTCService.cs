using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using SIPSorcery.Net;
using SIPSorceryMedia.Abstractions;

namespace RemoteDesktopServer.Services;

public class WebRtcService
{
    private const int RtpListenPort = 5004;
    private readonly ILogger<WebRtcService> _logger;
    private readonly List<RTCPeerConnection> _peerConnections = new();
    private readonly RTPSession _rtpSession;
    private readonly Lock _pcLock = new();

    public WebRtcService(ILogger<WebRtcService> logger)
    {
        _logger = logger;

        // Create an RTPSession to receive incoming RTP (video) from an external source.
        // NOTE: this constructor usage may be specific to your SIPSorcery build — adjust if you used a different overload.
        var rtpEndPoint = new IPEndPoint(IPAddress.Loopback, RtpListenPort);

        // Using the RTPSession constructor that accepts a bind address / port is fine.
        // The docs show RTPSession is the class to receive raw RTP packets and raise OnRtpPacketReceived.
        _rtpSession = new RTPSession(
            isMediaMultiplexed: false,
            isRtcpMultiplexed: true,
            isSecure: false,
            bindAddress: rtpEndPoint.Address,
            bindPort: rtpEndPoint.Port);

        _rtpSession.OnRtpPacketReceived += OnRtpPacketReceived;
        _rtpSession.Start();

        _logger.LogInformation("RTP listener started on {RtpEndPoint}.", rtpEndPoint);
    }

    // When the RTPSession receives an RTP packet we forward the RTP payload into each connected RTCPeerConnection.
    // SIPSorcery RTCPeerConnection inherits RTPSession and provides SendRtpRaw(...) methods we can call.
    private void OnRtpPacketReceived(IPEndPoint remoteEndPoint, SDPMediaTypesEnum media, RTPPacket rtpPacket)
    {
        if (media != SDPMediaTypesEnum.video) return;

        List<RTCPeerConnection> snapshot;
        lock (_pcLock)
        {
            snapshot = _peerConnections.ToList();
        }

        foreach (var pc in snapshot.Where(pc => pc.connectionState == RTCPeerConnectionState.connected))
        {
            // Forward raw payload into the peer connection using SendRtpRaw.
            // There are multiple overloads available. We use the most convenient one.
            try
            {
                // RTPPacket typically has Header fields such as SequenceNumber, Timestamp, PayloadType and Marker.
                // If your RTPPacket property names differ, adjust accordingly.
                var payload = rtpPacket.Payload; // byte[]
                var timestamp = rtpPacket.Header.Timestamp; // uint
                var markerBit = rtpPacket.Header.MarkerBit != 0 ? 1 : 0;
                var payloadType = rtpPacket.Header.PayloadType; // int
                var seqNum = rtpPacket.Header.SequenceNumber;

                pc.SendRtpRaw(SDPMediaTypesEnum.video, payload, timestamp, markerBit, payloadType, seqNum);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to forward RTP packet to peer connection.");
            }
        }
    }
    
    

    public async Task HandleWebSocket(WebSocket webSocket)
    {
        
        var config = new RTCConfiguration
        {
            iceServers = [new RTCIceServer { urls = "stun:stun.l.google.com:19302" }]
        };

        var pc = new RTCPeerConnection(config);

        lock (_pcLock) _peerConnections.Add(pc);

        _logger.LogInformation("Peer connection with STUN server created and added.");
        
        try
        {

            var h264Format = new VideoFormat(
                VideoCodecsEnum.H264,
                96
            );
            
            var videoTrack = new MediaStreamTrack([h264Format], MediaStreamStatusEnum.SendOnly);

            pc.addTrack(videoTrack);
            
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create/add video track. If you want H264 support on the server you may need SIPSorceryMedia.FFmpeg or to supply VideoFormat objects.");
        }

        // ICE candidate event -> send candidate JSON to client
        pc.onicecandidate += candidate =>
        {
            if (candidate == null)
            {
                _logger.LogInformation("ICE gathering complete.");
                var emptyPayload = new { candidate = "0" } ;
                _ = Send(webSocket, JsonSerializer.Serialize(emptyPayload));
                return;
            }

            // Defensive check for an empty candidate string
            if (string.IsNullOrWhiteSpace(candidate.candidate))
            {
                _logger.LogDebug("Ignoring empty or null ICE candidate string.");
                return;
            }

            try
            {
                // **THIS IS THE CRITICAL FIX**
                // Manually create a simple object with only the data we need.
                // This avoids serializing the complex underlying IPAddress object.
                var candidateInit = new
                {
                    candidate.candidate,
                    candidate.sdpMid,
                    candidate.sdpMLineIndex,
                    candidate.usernameFragment
                };

                // Nest this simple object in the payload
                var payload = new { candidate = candidateInit };

                // Now, serialize the simple payload object
                var candidateJson = JsonSerializer.Serialize(payload);

                _ = Send(webSocket, candidateJson);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to serialize/send ICE candidate.");
            }
        };

        pc.onconnectionstatechange += state =>
        {
            _logger.LogInformation("Peer connection state changed to {State}.", state);
            if (state != RTCPeerConnectionState.closed &&
                state != RTCPeerConnectionState.failed &&
                state != RTCPeerConnectionState.disconnected) return;
            try { pc.Close("Connection lost."); }
            catch (Exception ex) 
            {
                _logger.LogWarning("Error occured on state change: {ex}.", ex);

            }
            lock (_pcLock) _peerConnections.Remove(pc);
        };

        var buffer = new byte[8192];

        try
        {
            while (webSocket is { State: WebSocketState.Open, CloseStatus: null })
            {
                var result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    _logger.LogInformation("WebSocket closed by client.");
                    break;
                }

                var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                using var doc = JsonDocument.Parse(message);
                var root = doc.RootElement;

                // SDP offer from client
                if (root.TryGetProperty("sdp", out var sdpElement) && root.TryGetProperty("type", out var typeElement))
                {
                    var remoteSdp = sdpElement.GetString();
                    var type = typeElement.GetString();

                    if (!string.IsNullOrWhiteSpace(remoteSdp) && !string.IsNullOrWhiteSpace(type))
                    {
                        var offer = new RTCSessionDescriptionInit
                        {
                            type = type == "offer" ? RTCSdpType.offer : RTCSdpType.answer,
                            sdp = remoteSdp
                        };

                        // setRemoteDescription returns an enum SetDescriptionResultEnum
                        var setResult = pc.setRemoteDescription(offer);
                        if (setResult != SetDescriptionResultEnum.OK)
                        {
                            _logger.LogError("setRemoteDescription failed: {Result}", setResult);
                            // Send error back or continue depending on your logic
                            continue;
                        }

                        // Create answer
                        var answer = pc.createAnswer();

                        // setLocalDescription is async
                        await pc.setLocalDescription(answer);

                        // Send answer back to client
                        var answerJson = JsonSerializer.Serialize(new { type = "answer", answer.sdp });
                        await Send(webSocket, answerJson);
                    }
                }
                // ICE candidate from client
                else if (root.TryGetProperty("candidate", out var candidateElement) && candidateElement.ValueKind != JsonValueKind.Null)
                {
                    try
                    {
                        // Candidate object shape should match RTCIceCandidateInit
                        var candInit = JsonSerializer.Deserialize<RTCIceCandidateInit>(candidateElement.GetRawText());
                        if (candInit != null)
                        {
                            pc.addIceCandidate(candInit);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to parse/add ICE candidate from client.");
                    }
                }
                else
                {
                    _logger.LogDebug("Unknown message from websocket: {Msg}", message);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WebSocket receive loop failed.");
        }
        finally
        {
            try { pc.Close("WebSocket connection ended."); }
            catch
            {
                // ignored
            }

            lock (_pcLock) _peerConnections.Remove(pc);
        }
    }

    private static Task Send(WebSocket ws, string message)
    {
        if (ws.State != WebSocketState.Open) return Task.CompletedTask;
        var bytes = Encoding.UTF8.GetBytes(message);
        return ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
    }
}
