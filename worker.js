export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. WebSocket Gateway (Signaling & Multi-party Mesh)
    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket Upgrade", { status: 426 });
      }

      const socketKey = url.searchParams.get("keyword");
      if (socketKey !== env.GATEWAY_KEYWORD) {
        return new Response("Unauthorized Gateway Access", { status: 403 });
      }

      return handleWebSocketSession(request, env);
    }

    // 2. REST API Gateway Header Guard
    if (url.pathname.startsWith("/api/")) {
      const clientKey = request.headers.get("x-host-keyword");
      if (clientKey !== env.GATEWAY_KEYWORD) {
        return new Response(JSON.stringify({ error: "Gateway Access Denied." }), {
          status: 403,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-host-keyword",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Frictionless Device Authentication & Auto-Registration
    if (url.pathname === "/api/auth" && request.method === "POST") {
      try {
        const { uuid, display_name } = await request.json();
        const clientIp = request.headers.get("cf-connecting-ip") || "unknown";

        if (!uuid) {
          return new Response(JSON.stringify({ error: "Missing device UUID" }), { status: 400, headers: corsHeaders });
        }

        // Check if device already has an assigned profile
        let { results } = await env.DB.prepare("SELECT * FROM users WHERE device_uuid = ?")
          .bind(uuid)
          .all();

        let user;

        if (results.length === 0) {
          // --- AUTO-REGISTRATION GENERATION LOOP ---
          let isUnique = false;
          let newNumber = "";

          while (!isUnique) {
            newNumber = Math.floor(100000 + Math.random() * 900000).toString();
            const check = await env.DB.prepare("SELECT id FROM users WHERE assigned_number = ?")
              .bind(newNumber)
              .all();
            if (check.results.length === 0) {
              isUnique = true;
            }
          }

          const nameToStore = display_name || `Node-${newNumber}`;

          // Write new frictionless account to the edge database
          await env.DB.prepare(
            "INSERT INTO users (device_uuid, display_name, assigned_number) VALUES (?, ?, ?)"
          )
          .bind(uuid, nameToStore, newNumber)
          .run();

          // Fetch the newly provisioned row
          const freshUser = await env.DB.prepare("SELECT * FROM users WHERE device_uuid = ?")
            .bind(uuid)
            .all();
          user = freshUser.results[0];
        } else {
          user = results[0];
        }

        // Log connectivity event
        await env.DB.prepare("INSERT INTO auth_logs (user_id, ip_address) VALUES (?, ?)")
          .bind(user.id, clientIp)
          .run();

        return new Response(JSON.stringify({
          success: true,
          status: results.length === 0 ? "account_created" : "authenticated",
          user: {
            id: user.id,
            assigned_number: user.assigned_number,
            display_name: user.display_name
          }
        }), { status: 200, headers: corsHeaders });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};

// --- WEBSOCKET MESH ROUTER ---
const roomSessions = {};

async function handleWebSocketSession(request, env) {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();

  let currentRoomId = null;
  let clientUuid = crypto.randomUUID();

  server.addEventListener("message", async (msg) => {
    try {
      const data = JSON.parse(msg.data);

      switch (data.type) {
        case "join-room":
          currentRoomId = data.roomId;
          if (!roomSessions[currentRoomId]) roomSessions[currentRoomId] = [];

          roomSessions[currentRoomId].forEach(session => {
            session.ws.send(JSON.stringify({
              type: "peer-joined",
              socketId: clientUuid,
              userNumber: data.userNumber,
              displayName: data.displayName
            }));
          });

          roomSessions[currentRoomId].push({ id: clientUuid, ws: server });
          break;

        case "send-offer":
          forwardToPeer(data.toSocketId, {
            type: "receive-offer",
            fromSocketId: clientUuid,
            fromNumber: data.fromNumber,
            offer: data.offer
          });
          break;

        case "send-answer":
          forwardToPeer(data.toSocketId, {
            type: "receive-answer",
            fromSocketId: clientUuid,
            answer: data.answer
          });
          break;

        case "send-ice-candidate":
          forwardToPeer(data.toSocketId, {
            type: "receive-ice-candidate",
            fromSocketId: clientUuid,
            candidate: data.candidate
          });
          break;

        case "leave-room":
          cleanUpSession(currentRoomId, clientUuid);
          break;
      }
    } catch (e) {
      server.send(JSON.stringify({ error: "Invalid message payload schema" }));
    }
  });

  server.addEventListener("close", () => {
    cleanUpSession(currentRoomId, clientUuid);
  });

  return new Response(null, { status: 101, webSocket: client });
}

function forwardToPeer(targetSocketId, payload) {
  for (const roomId in roomSessions) {
    const target = roomSessions[roomId].find(s => s.id === targetSocketId);
    if (target) {
      target.ws.send(JSON.stringify(payload));
      break;
    }
  }
}

function cleanUpSession(roomId, clientUuid) {
  if (roomId && roomSessions[roomId]) {
    roomSessions[roomId] = roomSessions[roomId].filter(s => s.id !== clientUuid);
    roomSessions[roomId].forEach(session => {
      session.ws.send(JSON.stringify({ type: "peer-left", socketId: clientUuid }));
    });
    if (roomSessions[roomId].length === 0) delete roomSessions[roomId];
  }
}
