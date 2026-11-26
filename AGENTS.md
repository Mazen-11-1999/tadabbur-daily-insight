# Application architecture
- Register shared server-call authentication in `src/start.ts`; private calls must carry a validated bearer token.
- Keep server-function modules thin and helpers server-only; prevent client bundle exposure and transform errors.
- Reserve AI usage through one atomic authenticated database function; concurrent calls must share the same per-user UTC-day limit.
- Store push hours in the device's IANA timezone; calculate delivery dates locally and manage subscriptions by endpoint.
- Account deletion uses an authenticated wrapper, transactional data cleanup, then the privileged auth deletion API; never accept a target user from the client.
- The notification callback requires the user-configured cron header; scheduling credentials must match it before delivery can resume.