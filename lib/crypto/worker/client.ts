// Main-thread proxy for crypto worker. Singleton per tab.
"use client";

import * as Comlink from "comlink";
import type { CryptoWorkerApi } from "./types";

let workerInstance: Worker | null = null;
let proxyInstance: Comlink.Remote<CryptoWorkerApi> | null = null;

function makeWorker(): Worker {
  // Next.js 14 supports new Worker(new URL(...), { type: "module" }).
  return new Worker(new URL("./crypto.worker.ts", import.meta.url), {
    type: "module",
    name: "ev-crypto",
  });
}

export function getCryptoWorker(): Comlink.Remote<CryptoWorkerApi> {
  if (typeof window === "undefined") {
    throw new Error("crypto worker only available in browser");
  }
  if (!workerInstance || !proxyInstance) {
    workerInstance = makeWorker();
    proxyInstance = Comlink.wrap<CryptoWorkerApi>(workerInstance);
  }
  return proxyInstance;
}

export function terminateCryptoWorker(): void {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
    proxyInstance = null;
  }
}

export type { CryptoWorkerApi };
