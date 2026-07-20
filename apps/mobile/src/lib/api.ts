const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export async function getHealth(): Promise<unknown> {
  const response = await fetch(`${apiBaseUrl}/health`);

  if (!response.ok) {
    throw new Error(`Healthcheck failed with ${response.status}`);
  }

  return response.json();
}
