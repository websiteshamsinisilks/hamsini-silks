import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  sku: { type: String, required: true },
  name: { type: String, required: true },
  selling_price: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  units: { type: Number, required: true },
  size: { type: String, default: 'Standard' },
});

const orderSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true, unique: true },
    order_date: { type: Date, default: Date.now },
    customerId: { type: String, required: true },

    shipping_email: { type: String, required: true },
    shipping_phone: { type: String, required: true },

    shipping_name: { type: String, required: true },
    shipping_address: { type: String, required: true },
    shipping_city: { type: String, required: true },
    shipping_state: { type: String, required: true },
    shipping_country: { type: String, default: 'India' },
    shipping_pincode: { type: String, required: true },
    shipping_charges: { type: Number, default: 0 },

    sub_total: { type: Number, required: true },

    order_id: { type: String, required: true, unique: true },
    items: { type: [productSchema], required: true },

    status: {
      type: String,
      enum: [
        'NEW',
        'READY TO PACK',
        'PACKED',
        'PICKLISTED',
        'SHIPPED',
        'DELIVERED',
        'CANCELLED',
        'RETURN PENDING',
        'RETURNED',
      ],
      default: 'NEW',
    },
    promoCode: {
      type: String,
      default: null,
    },
    discountApplied: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['COD', 'Prepaid', 'Razorpay'],
      default: 'COD',
    },
    shiprocketOrderId: {
      type: String,
      default: null,
    },
    shiprocketAwb: {
      type: String,
      default: null,
    },
    shiprocketCourierId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true, _id: false },
);

export default mongoose.model('Order', orderSchema);
