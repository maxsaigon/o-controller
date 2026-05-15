import { List, Action, ActionPanel, showToast, Toast } from "@raycast/api";
import { postCommand } from "./api";

const inputs = [
  { id: "cd", name: "CD", icon: "💿" },
  { id: "net", name: "Network", icon: "🌐" },
  { id: "usb", name: "USB", icon: "🔌" },
  { id: "bluetooth", name: "Bluetooth", icon: "📶" },
  { id: "line", name: "Line In", icon: "🎵" },
  { id: "tuner", name: "Tuner", icon: "📻" },
];

export default function InputSwitch() {
  return (
    <List>
      {inputs.map((input) => (
        <List.Item
          key={input.id}
          title={`${input.icon} ${input.name}`}
          actions={
            <ActionPanel>
              <Action
                title={`Switch to ${input.name}`}
                onAction={async () => {
                  await postCommand("/commands/input", { input: input.id });
                  await showToast({
                    style: Toast.Style.Success,
                    title: `Switched to ${input.name}`,
                  });
                }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
