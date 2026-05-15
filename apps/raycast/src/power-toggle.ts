import { showHUD } from "@raycast/api";
import { postCommand } from "./api";

export default async function PowerToggle() {
  await postCommand("/commands/power", { action: "toggle" });
  await showHUD("⚡ Power toggled");
}
