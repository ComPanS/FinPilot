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
    payment_method_data: { type: "sbp" } as never,
    confirmation: {
      type: "redirect",
      return_url: params.returnUrl,
    },
    capture: true,
    description: params.description,
    metadata: params.metadata ?? {},
    save_payment_method: true,
  });
  return payment;
}

export async function getPayment(paymentId: string) {
  const sdk = getYooKassa();
  return sdk.payments.load(paymentId);
}

export async function capturePayment(paymentId: string) {
  const sdk = getYooKassa();
  return sdk.payments.capture(paymentId);
}

export interface CreateRecurringPaymentParams {
  paymentMethodId: string;
  amount: number;
  description: string;
  metadata?: Record<string, string>;
}

export async function createRecurringPayment(
  params: CreateRecurringPaymentParams,
) {
  const sdk = getYooKassa();
  return sdk.payments.create({
    amount: {
      value: params.amount.toFixed(2),
      currency: CurrencyEnum.RUB,
    },
    capture: true,
    payment_method_id: params.paymentMethodId,
    description: params.description,
    metadata: params.metadata ?? {},
  });
}
