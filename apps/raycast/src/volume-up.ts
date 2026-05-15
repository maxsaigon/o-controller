import { showHUD } from "@raycast/api";
import { postCommand } from "./api";

export default async function VolumeUp() {
  await postCommand("/commands/volume", { value: "up" });
  await showHUD("🔊 Volume up");
}
