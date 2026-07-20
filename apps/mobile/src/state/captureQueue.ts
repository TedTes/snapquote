import { create } from "zustand";

export type QueuedCaptureAsset = {
  id: string;
  jobId: string;
  type: "photo" | "audio";
  localUri: string;
  uploadState: "queued" | "uploading" | "uploaded" | "failed";
  retryCount: number;
  createdAt: string;
};

type CaptureQueueState = {
  assets: QueuedCaptureAsset[];
  enqueue: (asset: QueuedCaptureAsset) => void;
  markUploadState: (
    id: string,
    uploadState: QueuedCaptureAsset["uploadState"],
    retryCount?: number
  ) => void;
};

export const useCaptureQueue = create<CaptureQueueState>((set) => ({
  assets: [],
  enqueue: (asset) =>
    set((state) => ({
      assets: [...state.assets, asset]
    })),
  markUploadState: (id, uploadState, retryCount) =>
    set((state) => ({
      assets: state.assets.map((asset) =>
        asset.id === id
          ? {
              ...asset,
              uploadState,
              retryCount: retryCount ?? asset.retryCount
            }
          : asset
      )
    }))
}));
