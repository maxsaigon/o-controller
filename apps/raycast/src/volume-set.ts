import { showHUD, LaunchProps } from "@raycast/api";
import { postCommand } from "./api";

interface VolumeSetArguments {
  level: string;
}

export default async function VolumeSet(
  props: LaunchProps<{ arguments: VolumeSetArguments }>,
) {
  const level = parseInt(props.arguments.level, 10);

  if (isNaN(level) || level < 0 || level > 100) {
    await showHUD("❌ Volume must be 0-100");
    return;
  }

  await postCommand("/commands/volume", { value: level });
  await showHUD(`🔊 Volume set to ${level}`);
}
