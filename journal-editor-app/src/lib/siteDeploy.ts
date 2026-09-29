export type DeployStatus = { deploymentId: string; sha: string; status: "queued" | "in_progress" | "completed"; conclusion?: string | null; url?: string; local?: boolean };

export async function startSiteDeploy(deploymentId: string, commitSha?: string): Promise<DeployStatus> {
  const response = await fetch("/api/site-deploy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deploymentId, commitSha }) });
  if (!response.ok) throw new Error(await response.text());
  return await response.json() as DeployStatus;
}

export async function getSiteDeploy(deploymentId: string): Promise<DeployStatus> {
  const response = await fetch(`/api/site-deploy?deploymentId=${encodeURIComponent(deploymentId)}`);
  if (!response.ok) throw new Error(await response.text());
  return await response.json() as DeployStatus;
}
