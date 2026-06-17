/**
 * Chiron Plugin for ElizaOS
 *
 * 在任何 Agent 执行链上交易前拦截，调用 Chiron L1 校验，
 * 仅在校验通过 (PASS) 时放行交易。
 */
import { Chiron } from "@chiron/sdk";

export interface ChironPluginConfig {
  chainId: number;
  chironContract: string;
  rpcUrl: string;
  privateKey: string;
  mode: "enforce" | "alert" | "off";
}

export class ChironPlugin {
  private sdk: Chiron;
  private config: ChironPluginConfig;

  constructor(config: ChironPluginConfig) {
    this.config = config;
    this.sdk = new Chiron({
      chainId: config.chainId,
      securityLevel: "standard",
    });
  }

  /** 校验交易并返回结果 */
  async verify(intent: any, tx: any) {
    if (this.config.mode === "off") {
      return { allowed: true, receipt: null };
    }

    const receipt = await this.sdk.verify(intent, tx);
    const allowed = receipt.l1Result === "PASS";

    if (!allowed && this.config.mode === "enforce") {
      throw new Error(
        `Chiron 拦截: L1=${receipt.l1Result}, 原因: ${receipt.reason}`
      );
    }

    return { allowed, receipt };
  }
}

// ElizaOS plugin factory
export function createChironPlugin(config: ChironPluginConfig) {
  return new ChironPlugin(config);
}
