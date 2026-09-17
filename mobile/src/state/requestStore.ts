import { create } from "zustand";
import type { ApiWebsiteRequest } from "../api/client";

type RequestStoreState = {
  requests: ApiWebsiteRequest[];
  loading: boolean;
  error: string | null;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setRequests: (requests: ApiWebsiteRequest[]) => void;
  upsertRequest: (request: ApiWebsiteRequest) => void;
  removeRequest: (requestId: string) => void;
};

export const useRequestStore = create<RequestStoreState>((set) => ({
  requests: [],
  loading: false,
  error: null,
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setRequests: (requests) => set({ requests: sortRequests(requests), loading: false, error: null }),
  upsertRequest: (request) => set((state) => ({
    requests: sortRequests([
      request,
      ...state.requests.filter((candidate) => candidate.id !== request.id)
    ]),
    loading: false,
    error: null
  })),
  removeRequest: (requestId) => set((state) => ({
    requests: state.requests.filter((request) => request.id !== requestId)
  }))
}));

export function unreadRequestCount(requests: ApiWebsiteRequest[]) {
  return requests.filter((request) => request.status === "new").length;
}

function sortRequests(requests: ApiWebsiteRequest[]) {
  return [...requests].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
