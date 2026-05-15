import { List, Action, ActionPanel, showToast, Toast } from "@raycast/api";
import { postCommand, getEndpoint } from "./api";
import { useEffect, useState } from "react";

interface Preset {
  id: string;
  name: string;
  description: string;
}

export default function RunPreset() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEndpoint("/presets")
      .then((data) => {
        setPresets(data as unknown as Preset[]);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  return (
    <List isLoading={loading}>
      {presets.map((preset) => (
        <List.Item
          key={preset.id}
          title={preset.name}
          subtitle={preset.description}
          actions={
            <ActionPanel>
              <Action
                title={`Run ${preset.name}`}
                onAction={async () => {
                  await postCommand(`/presets/${preset.id}/run`);
                  await showToast({
                    style: Toast.Style.Success,
                    title: `Running "${preset.name}"`,
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
