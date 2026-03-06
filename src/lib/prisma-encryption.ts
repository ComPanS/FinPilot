import { Prisma } from "@prisma/client";
import { encrypt, decrypt } from "./encryption";

type FieldType = "string" | "json";

const ENCRYPTED_FIELDS: Record<string, Record<string, FieldType>> = {
  cashFlowProfile: { name: "string" },
  regularExpense: { name: "string" },
  regularIncome: { name: "string" },
  manualTransaction: { description: "string" },
  cashFlowHistory: { oldData: "json", newData: "json" },
  forecastSnapshot: { forecastData: "json" },
  whatIfScenario: { name: "string", changesJson: "json" },
  expenseCategory: { name: "string" },
  incomeCategory: { name: "string" },
  aiRequest: { prompt: "string", response: "string" },
};

const WRITE_OPS = new Set(["create", "createMany", "update", "updateMany", "upsert"]);
const READ_OPS = new Set([
  "findUnique",
  "findFirst",
  "findMany",
  "findUniqueOrThrow",
  "findFirstOrThrow",
]);

async function encryptValue(value: unknown, type: FieldType): Promise<unknown> {
  if (value == null) return value;
  if (type === "string") {
    return typeof value === "string" ? await encrypt(value) : value;
  }
  if (type === "json") {
    const str = typeof value === "string" ? value : JSON.stringify(value);
    return { _e: await encrypt(str) };
  }
  return value;
}

async function decryptValue(value: unknown, type: FieldType): Promise<unknown> {
  if (value == null) return value;
  if (type === "string") {
    return typeof value === "string" ? await decrypt(value) : value;
  }
  if (type === "json") {
    const obj = value as Record<string, unknown>;
    if (obj && typeof obj === "object" && "_e" in obj && typeof obj._e === "string") {
      return JSON.parse(await decrypt(obj._e)) as unknown;
    }
    return value; // backward compat: unencrypted json
  }
  return value;
}

async function processData(
  data: Record<string, unknown> | Record<string, unknown>[] | undefined,
  fields: Record<string, FieldType>,
  encrypting: boolean
): Promise<void> {
  if (!data) return;
  const processOne = async (obj: Record<string, unknown>) => {
    for (const [key, type] of Object.entries(fields)) {
      if (key in obj && obj[key] != null) {
        obj[key] = encrypting
          ? await encryptValue(obj[key], type)
          : await decryptValue(obj[key], type);
      }
    }
  };
  if (Array.isArray(data)) {
    for (const item of data) await processOne(item);
  } else {
    await processOne(data);
  }
}

async function processResult(result: unknown, model: string, operation: string): Promise<unknown> {
  const fields = ENCRYPTED_FIELDS[model];
  if (!fields || !READ_OPS.has(operation)) return result;
  const processOne = async (obj: Record<string, unknown>) => {
    for (const [key, type] of Object.entries(fields)) {
      if (key in obj && obj[key] != null) {
        obj[key] = await decryptValue(obj[key], type);
      }
    }
  };
  if (Array.isArray(result)) {
    for (const r of result) {
      if (typeof r === "object" && r) await processOne(r as Record<string, unknown>);
    }
  } else if (result && typeof result === "object") {
    await processOne(result as Record<string, unknown>);
  }
  return result;
}

async function processArgs(model: string, operation: string, args: Record<string, unknown>): Promise<void> {
  const fields = ENCRYPTED_FIELDS[model];
  if (!fields || !WRITE_OPS.has(operation)) return;
  if (operation === "create") {
    await processData(args.data as Record<string, unknown>, fields, true);
  } else if (operation === "createMany") {
    const data = args.data;
    if (data) {
      await processData(Array.isArray(data) ? data : [data as Record<string, unknown>], fields, true);
    }
  } else if (operation === "update" || operation === "updateMany") {
    await processData(args.data as Record<string, unknown>, fields, true);
  } else if (operation === "upsert") {
    await processData(args.create as Record<string, unknown>, fields, true);
    await processData(args.update as Record<string, unknown>, fields, true);
  }
}

export function encryptionExtension() {
  return Prisma.defineExtension((client) =>
    client.$extends({
      name: "encryption",
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const modelName = model ?? "";
            await processArgs(modelName, operation, args as Record<string, unknown>);
            const result = await query(args);
            return processResult(result, modelName, operation);
          },
        },
      },
    })
  );
}
