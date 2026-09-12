export type MidtransNotificationResponse = {
  order_id: string;
  transaction_status: string;
  fraud_status?: string;
};