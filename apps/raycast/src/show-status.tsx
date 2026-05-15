import { Detail } from "@raycast/api";
import { useEffect, useState } from "react";
import { getEndpoint } from "./api";

interface ReceiverState {
  connected: boolean;
  power: string;
  input: string;
  volume: number;
  muted: boolean;
  playback: string;
  nowPlaying: {
    title: string;
    artist: string;
    album: string;
  };
}

export default function ShowStatus() {
  const [state, setState] = useState<ReceiverState | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    getEndpoint("/state")
      .then((data) => setState(data as unknown as ReceiverState))
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return <Detail markdown={`# ❌ Error\n\n${error}`} />;
  }

  if (!state) {
    return <Detail isLoading markdown="Loading..." />;
  }

  const md = `
# 🎵 O-Control Status

| Property | Value |
|----------|-------|
| Connected | ${state.connected ? "✅ Yes" : "❌ No"} |
| Power | ${state.power === "on" ? "🟢 On" : "🔴 Off"} |
| Input | ${state.input} |
| Volume | ${state.volume} ${state.muted ? "🔇 (muted)" : ""} |
| Playback | ${state.playback} |

${
  state.nowPlaying?.title
    ? `## 🎶 Now Playing

| Field | Value |
|-------|-------|
| Title | ${state.nowPlaying.title} |
| Artist | ${state.nowPlaying.artist} |
| Album | ${state.nowPlaying.album} |`
    : ""
}
  `.trim();

  return <Detail markdown={md} />;
}
