import { YooKassa, CurrencyEnum } from "yookassa-sdk";

function getYooKassa() {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) throw new Error("YooKassa not configured");
  return YooKassa({ shop_id: shopId, secret_key: secretKey, debug: false });
}

export interface CreatePaymentParams {
  amount: number;
  description: string;
  returnUrl: string;
  metadata?: Record<string, string>;
}

export async function createPayment(params: CreatePaymentParams) {
  const sdk = getYooKassa();
  const payment = await sdk.payments.create({
    amount: {
      value: params.amount.toFixed(2),
      currency: CurrencyEnum.RUB,
    },
    confirmation: {
      type: "redirect",
      return_url: params.returnUrl,
    },
    description: params.description,
    metadata: params.metadata ?? {},
  });
  return payment;
}

export async function getPayment(paymentId: string) {
  const sdk = getYooKassa();
  return sdk.payments.load(paymentId);
}
