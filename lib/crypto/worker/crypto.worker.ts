// Crypto Web Worker entrypoint. MK held in worker scope only.
// Tab close → worker terminates → MK gone.
import * as Comlink from "comlink";
import { createCryptoWorkerApi } from "./api";

Comlink.expose(createCryptoWorkerApi());

export type { CryptoWorkerApi } from "./types";
