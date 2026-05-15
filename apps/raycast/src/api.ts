import { getPreferenceValues, showToast, Toast } from "@raycast/api";

interface Preferences {
  serviceUrl: string;
}

function getServiceUrl(): string {
  const { serviceUrl } = getPreferenceValues<Preferences>();
  return serviceUrl.replace(/\/$/, ""); // trim trailing slash
}

/**
 * Send a POST request to the O-Control service.
 */
export async function postCommand(
  path: string,
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const url = `${getServiceUrl()}${path}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return (await response.json()) as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Service Unreachable",
        message: "Cannot connect to O-Control service. Check if it is running.",
      });
    } else {
      await showToast({
        style: Toast.Style.Failure,
        title: "Command Failed",
        message,
      });
    }

    throw error;
  }
}

/**
 * Send a GET request to the O-Control service.
 */
export async function getEndpoint(
  path: string,
): Promise<Record<string, unknown>> {
  const url = `${getServiceUrl()}${path}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Service Unreachable",
        message: "Cannot connect to O-Control service.",
      });
    }

    throw error;
  }
}
