import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  formatTrackResult,
  isCarrierId,
  listCarriers,
  trackPackage,
} from "../tracking/track.js";
import { CARRIER_IDS } from "../tracking/types.js";

const carrierSchema = z
  .enum(CARRIER_IDS)
  .optional()
  .describe(
    "配送会社 ID。省略時は伝票番号から自動判定します（japanpost / sagawa / yamato / seino / fukuyama）",
  );

export function createPackageTrackingServer() {
  const server = new McpServer({
    name: "package-tracking-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "list_carriers",
    {
      description:
        "対応している配送会社の一覧と、伝票番号の目安（桁・形式）を返します。",
      inputSchema: {},
    },
    async () => {
      const carriers = listCarriers();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ carriers }, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "track_package",
    {
      description:
        "日本の配送会社（日本郵便・佐川急便・ヤマト運輸・西濃運輸・福山通運）の荷物を追跡します。carrier を省略すると伝票番号から自動判定します。",
      inputSchema: {
        tracking_number: z
          .string()
          .min(1)
          .describe("伝票番号 / お問い合わせ番号（ハイフン付き可）"),
        carrier: carrierSchema,
      },
    },
    async ({ tracking_number, carrier }) => {
      if (carrier !== undefined && !isCarrierId(carrier)) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  ok: false,
                  reason: "invalid_input",
                  detail: `未知の carrier: ${carrier}`,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      const output = await trackPackage({
        trackingNumber: tracking_number,
        carrier,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: formatTrackResult(output),
          },
        ],
        isError: !output.ok,
      };
    },
  );

  return server;
}
