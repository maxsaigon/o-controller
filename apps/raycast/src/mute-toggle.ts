import { showHUD } from "@raycast/api";
import { postCommand } from "./api";

export default async function MuteToggle() {
  await postCommand("/commands/mute", { action: "toggle" });
  await showHUD("🔇 Mute toggled");
}
