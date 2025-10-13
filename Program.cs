using Microsoft.AspNetCore.Routing.Internal;
using RemoteDesktopServer.Services;

var builder = WebApplication.CreateBuilder(args);

// --- SERVICES (This part is fine) ---
builder.Services.AddGrpc();
builder.Services.AddSingleton<WebRtcService>();
builder.Services.AddSingleton<RemoteInputService>();
builder.Services.AddCors(o => o.AddPolicy("AllowAll", policyBuilder =>
{
    policyBuilder.AllowAnyOrigin()
        .AllowAnyMethod()
        .AllowAnyHeader()
        .WithExposedHeaders("Grpc-Status", "Grpc-Message", "Grpc-Encoding", "Grpc-Accept-Encoding");
}));

// This service is required to dump the routing table.
builder.Services.AddSingleton<DfaGraphWriter>();

var app = builder.Build();

// --- APPLICATION PIPELINE WITH HEAVY LOGGING & EXPLICIT ROUTING ---

var logger = app.Services.GetRequiredService<ILogger<Program>>();
logger.LogWarning("--- Application Starting: Pipeline configuration loaded. ---");

app.Use(async (_, next) =>
{
    await next();
});


app.UseCors();
app.UseDefaultFiles();
app.UseStaticFiles();

logger.LogInformation("A. Activating WebSockets...");
app.UseWebSockets();

logger.LogInformation("B. Activating Endpoint Routing...");
app.UseRouting();

logger.LogInformation("C. Configuring gRPC-Web...");
app.UseGrpcWeb(new GrpcWebOptions { DefaultEnabled = true });

logger.LogInformation("D. Mapping all Endpoints...");

app.Map("/ws", async context =>
{
    if (context.WebSockets.IsWebSocketRequest)
    {
        using var webSocket = await context.WebSockets.AcceptWebSocketAsync();
        var webrtcService = context.RequestServices.GetRequiredService<WebRtcService>();
        await webrtcService.HandleWebSocket(webSocket);
    }
    else
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
    }
});


app.MapGrpcService<RemoteInputService>();

app.Run();