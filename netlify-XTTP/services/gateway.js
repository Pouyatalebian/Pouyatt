// Global configuration for the remote entry point
// Ensure the identifier 'UPSTREAM_GATEWAY' is defined in your dashboard
const REMOTE_HUB = Netlify.env.get("UPSTREAM_GATEWAY") || "https://default-service.com";

/**
 * Main traffic controller for incoming requests
 * Handles direct streaming between client and remote server
 */
export default async (req, ctx) => {
  try {
    const currentUrl = new URL(req.url);
    // Combine base URL with local routing segments
    const destination = new URL(currentUrl.pathname + currentUrl.search, REMOTE_HUB).href;

    // Clone and sanitize request metadata
    const transportHeaders = new Headers(req.headers);
    const forbiddenKeys = ["host", "x-forwarded-proto", "x-forwarded-host"];
    forbiddenKeys.forEach(attr => transportHeaders.delete(attr));

    // Initialize the outbound connection with native streaming support
    const outboundRequest = new Request(destination, {
      method: req.method,
      headers: transportHeaders,
      body: req.body, // Direct pipe for ReadableStream
      redirect: "manual",
    });

    // Execute the remote call
    const remoteResponse = await fetch(outboundRequest);

    // Filter response headers to prevent protocol conflicts
    const finalHeaders = new Headers();
    const hopByHop = ["transfer-encoding", "connection", "keep-alive", "te", "upgrade"];
    
    for (const [name, val] of remoteResponse.headers.entries()) {
      if (!hopByHop.includes(name.toLowerCase())) {
        finalHeaders.set(name, val);
      }
    }

    // Deliver the payload back to the client as a live stream
    return new Response(remoteResponse.body, {
      status: remoteResponse.status,
      statusText: remoteResponse.statusText,
      headers: finalHeaders,
    });
  } catch (err) {
    console.warn("Connection Fault:", err.message);
    return new Response(`Gateway Timeout: ${err.message}`, { status: 504 });
  }
};
