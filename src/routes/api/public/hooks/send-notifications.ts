import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/send-notifications")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { validCronSecret } = await import("@/lib/cron-auth.server");
        if (!validCronSecret(request.headers.get("x-cron-secret"), process.env["CRON_SECRET"])) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { sendNotifications } = await import("@/lib/notifications.server");
        return sendNotifications();
      },
    },
  },
});