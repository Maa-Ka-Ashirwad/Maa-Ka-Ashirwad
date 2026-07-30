"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Tracks how many browser tabs/devices are logged into the store right now,
// using a Supabase Realtime Presence channel. This is the actual mechanism
// behind the "2 users online" indicator in the UI mock — every signed-in
// user joins the same channel and everyone sees the live count update.
export function PresenceBadge() {
  const [count, setCount] = useState(1);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("store-presence", {
      config: { presence: { key: crypto.randomUUID() } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setCount(Object.keys(state).length || 1);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs text-good bg-good/10 px-2.5 py-1 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-good animate-pulse" />
      {count} {count === 1 ? "user" : "users"} online
    </div>
  );
}
