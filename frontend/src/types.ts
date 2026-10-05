export type OrderStatus =
  | 'NEW'
  | 'READY TO PACK'
  | 'PACKED'
  | 'PICKLISTED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURN PENDING'
  | 'RETURNED';

export type OrderItem = {
  sku: string;
  name: string;
  selling_price: number;
  discount?: number;
  units: number;
  size: string;
  category?: string;
  image?: string;
};

export type OrderData = {
  discountApplied?: number;
  _id?: string;
  order_id?: string;
  customerId?: string;
  order_date: string;
  shipping_email: string;
  shipping_phone: string;
  shipping_name: string;
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_country: string;
  shipping_pincode: string;
  shipping_charges: number;
  sub_total: number;
  total: number;
  items: OrderItem[];
  paymentMethod: string;
  promoCode?: string;
  shiprocketCourierId?: string;
  status: OrderStatus;
};

export type RazorpayPaymentProps = {
  setIsProcessingPayment: React.Dispatch<React.SetStateAction<boolean>>;
  setPaymentFeedback: React.Dispatch<
    React.SetStateAction<{
      type: 'idle' | 'loading' | 'success' | 'error';
      message: string;
    }>
  >;
  name: String;
  email: String;
  phone: String;
  address: String;
  setPayment: React.Dispatch<React.SetStateAction<string>>;
  setOrderId: React.Dispatch<React.SetStateAction<string | null>>;
  setOtpSent: React.Dispatch<React.SetStateAction<boolean>>;
  setOtp: React.Dispatch<React.SetStateAction<string>>;
  setOtpVerified: React.Dispatch<React.SetStateAction<boolean>>;
  orderData: OrderData | null;
};
