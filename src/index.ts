import { createMcpHandler } from "agents/mcp/server";
import { authorizeSharedSecret } from "./auth.js";
import { createPackageTrackingServer } from "./mcp/server.js";

const mcpHandler = createMcpHandler(createPackageTrackingServer, {
  route: "/mcp",
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return Response.json({
        name: "package-tracking-mcp",
        version: "0.1.0",
        mcp: "/mcp",
        auth: "Authorization: Bearer <MCP_SHARED_SECRET>",
        tools: ["track_package", "list_carriers"],
      });
    }

    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      const unauthorized = await authorizeSharedSecret(
        request,
        env.MCP_SHARED_SECRET,
      );
      if (unauthorized) {
        return unauthorized;
      }
      return mcpHandler(request, env, ctx);
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
