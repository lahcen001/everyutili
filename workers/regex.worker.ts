import { runRegex, type RegexRequest, type RegexResponse } from "@/lib/regex";

export interface RegexWorkerRequest extends RegexRequest {
  id: number;
}

export interface RegexWorkerResponse {
  id: number;
  result: RegexResponse;
}

// Runs the user's pattern off the main thread, so a pattern that backtracks forever
// can be abandoned (the page terminates this worker) instead of freezing the tab.
self.onmessage = (event: MessageEvent<RegexWorkerRequest>) => {
  const { id, ...request } = event.data;
  const response: RegexWorkerResponse = { id, result: runRegex(request) };
  (self as unknown as Worker).postMessage(response);
};

export {};
