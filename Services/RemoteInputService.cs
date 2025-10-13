using System.Numerics;
using Grpc.Core;
using InputSimulatorPro.Resources.Natives;
using static InputSimulatorPro.InputSimulator;

namespace RemoteDesktopServer.Services;

public class RemoteInputService : InputService.InputServiceBase
{
    public RemoteInputService(ILogger<RemoteInputService> logger)
    {
        logger.LogInformation("RemoteInputService initialized.");
    }

    public override Task<EmptyResponse> SendMouseMove(MouseMoveEvent request, ServerCallContext context)
    {
        // Create a Vector2 directly from the normalized coordinates.
        var coordinates = new Vector2((float)request.X, (float)request.Y);

        // Call the correct method, specifying that the coordinates are already normalized.
        Mouse.SetCursorPositionAbsolute(coordinates, useNormalizedCoordinates: true);
        
        return Task.FromResult(new EmptyResponse());
    }

    public override Task<EmptyResponse> SendMouseDown(MouseButtonEvent request, ServerCallContext context)
    {
        // Convert the integer button from the request to the MouseButton enum.
        if (TryGetMouseButton(request.Button, out var button))
        {
            Mouse.KeyDown(button);
        }
        return Task.FromResult(new EmptyResponse());
    }

    public override Task<EmptyResponse> SendMouseUp(MouseButtonEvent request, ServerCallContext context)
    {
        // Convert the integer button from the request to the MouseButton enum.
        if (TryGetMouseButton(request.Button, out var button))
        {
            Mouse.KeyUp(button);
        }
        return Task.FromResult(new EmptyResponse());
    }
    
    public override Task<EmptyResponse> SendMouseWheel(MouseWheelEvent request, ServerCallContext context)
    {
        // Use the correct method name 'VerticalWheel'.
        Mouse.VerticalWheel(request.DeltaY);
        return Task.FromResult(new EmptyResponse());
    }
    
    public override Task<EmptyResponse> SendKeyDown(KeyEvent request, ServerCallContext context)
    {
        if (Enum.TryParse<VirtualKeyShort>(request.Key, true, out var keyCode))
        {
            Keyboard.KeyDown(keyCode);
        }
        return Task.FromResult(new EmptyResponse());
    }
    
    public override Task<EmptyResponse> SendKeyUp(KeyEvent request, ServerCallContext context)
    {
        if (Enum.TryParse<VirtualKeyShort>(request.Key, true, out var keyCode))
        {
            Keyboard.KeyUp(keyCode);
        }
        return Task.FromResult(new EmptyResponse());
    }

    // Helper method to convert integer to MouseButton enum
    private bool TryGetMouseButton(int buttonId, out MouseButton button)
    {
        switch (buttonId)
        {
            case 0:
                button = MouseButton.left;
                return true;
            case 1:
                button = MouseButton.middle;
                return true;
            case 2:
                button = MouseButton.right;
                return true;
            default:
                button = default;
                return false;
        }
    }
}