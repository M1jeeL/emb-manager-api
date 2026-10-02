import { PaymentStatus } from '../../../generated/prisma/enums.js';

export interface PaymentAvailableOrderDto {
  id: string;
  orderNumber: number;
  status: string;
  total: string;
  paidAmount: string;
  paymentStatus: PaymentStatus;
  customer: {
    id: string;
    name: string;
    companyName: string | null;
  };
}
