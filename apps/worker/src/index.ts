import { pathToFileURL } from "node:url";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { processJob, type ProcessJobPayload } from "./pipeline.js";

export const PROCESS_JOB_QUEUE = "process_job";

export function startWorker(redisUrl: string) {
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null
  });

  return new Worker<ProcessJobPayload>(
    PROCESS_JOB_QUEUE,
    async (job) => {
      return await Promise.resolve(processJob(job.data));
    },
    {
      connection
    }
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const worker = startWorker(redisUrl);

  worker.on("completed", (job) => {
    console.log(`Completed ${PROCESS_JOB_QUEUE} job ${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Failed ${PROCESS_JOB_QUEUE} job ${job?.id ?? "unknown"}`, error);
  });
}
