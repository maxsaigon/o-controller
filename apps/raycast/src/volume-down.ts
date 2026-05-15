import { showHUD } from "@raycast/api";
import { postCommand } from "./api";

export default async function VolumeDown() {
  await postCommand("/commands/volume", { value: "down" });
  await showHUD("🔉 Volume down");
}
