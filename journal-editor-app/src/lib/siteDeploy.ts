export type DeployStatus = { deploymentId: string; sha: string; status: "queued" | "in_progress" | "completed"; conclusion?: string | null; url?: string; local?: boolean };

export async function startSiteDeploy(deploymentId: string, commitSha?: string): Promise<DeployStatus> {
  const response = await fetch("/api/site-deploy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deploymentId, commitSha }) });
  if (!response.ok) throw new Error(await response.text());
  return await response.json() as DeployStatus;
}

export async function getSiteDeploy(deploymentId: string, startedAt?: string): Promise<DeployStatus> {
  const params = new URLSearchParams({ deploymentId });
  if (startedAt) params.set("startedAt", startedAt);
  const response = await fetch(`/api/site-deploy?${params}`);
  if (!response.ok) throw new Error(await response.text());
  return await response.json() as DeployStatus;
}
