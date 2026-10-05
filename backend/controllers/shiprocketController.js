import moment from 'moment-timezone';
import OrderSchema from '../models/OrdersSchema.js';
import dotenv from 'dotenv';
dotenv.config();

const SHIPROCKET_BASE = process.env.SHIPROCKET_API_URL;
const SHIPROCKET_EMAIL = process.env.SHIPROCKET_EMAIL;
const SHIPROCKET_PASSWORD = process.env.SHIPROCKET_PASSWORD;

const getAuthHeaders = (token) => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  Authorization: `Bearer ${token}`,
});

export async function getShiprocketAuth(req, res) {
  try {
    const response = await fetch(`${SHIPROCKET_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: SHIPROCKET_EMAIL,
        password: SHIPROCKET_PASSWORD,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: data });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Shiprocket auth error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export const fetchShiprocketToken = async () => {
  const response = await fetch(`${SHIPROCKET_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: SHIPROCKET_EMAIL,
      password: SHIPROCKET_PASSWORD,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.token) {
    throw new Error(data.message || 'Failed to fetch Shiprocket auth token');
  }
  return data.token;
};

export async function findBestShiprocketCourier(
  {
    delivery_code,
    order_price,
    order_weight = 1,
    cod = 0,
    pickup_code = '502032',
  },
  token,
) {
  if (!delivery_code || !order_price) {
    throw new Error(
      'delivery_code and order_price are required to select a courier',
    );
  }

  const authToken = token || (await fetchShiprocketToken());
  const shiprocket_url = `${SHIPROCKET_BASE}/courier/serviceability`;
  const pickup_postcode = `pickup_postcode=${encodeURIComponent(String(pickup_code))}`;
  const delivery_postcode = `delivery_postcode=${encodeURIComponent(String(delivery_code))}`;
  const codParam = `cod=${encodeURIComponent(String(cod))}`;
  const order_value = `order_value=${encodeURIComponent(String(order_price))}`;
  const weight = `weight=${encodeURIComponent(String(order_weight))}`;

  const response = await fetch(
    `${shiprocket_url}/?${pickup_postcode}&${delivery_postcode}&${codParam}&${order_value}&${weight}`,
    {
      method: 'GET',
      headers: getAuthHeaders(authToken),
    },
  );

  const shippingInfo = await response.json();
  const availableCouriers =
    shippingInfo?.data?.available_courier_companies || [];

  if (!response.ok || !availableCouriers.length) {
    const errorMessage =
      shippingInfo?.message ||
      shippingInfo?.errors ||
      'Unable to fetch courier serviceability';
    throw new Error(errorMessage);
  }

  const bestCourier = availableCouriers
    .filter((c) => c.SLA_Adherence >= 0)
    .sort((a, b) => {
      const scoreA =
        (a.delivery_performance || 0) * 2 +
        (a.pickup_performance || 0) +
        (a.tracking_performance || 0) +
        (a.rto_performance || 0) -
        (a.freight_charge || 0) / 50;
      const scoreB =
        (b.delivery_performance || 0) * 2 +
        (b.pickup_performance || 0) +
        (b.tracking_performance || 0) +
        (b.rto_performance || 0) -
        (b.freight_charge || 0) / 50;
      return scoreB - scoreA;
    })[0];

  if (!bestCourier) {
    throw new Error('No courier available for this destination');
  }

  return bestCourier;
}

export async function createShiprocketAdhocOrder(orderData, token) {
  if (!orderData) {
    throw new Error('Order data is required to create a Shiprocket order');
  }

  const authToken = token || (await fetchShiprocketToken());
  const payload = {
    order_id: orderData.order_id || orderData._id,
    order_date: moment(orderData.order_date)
      .tz('Asia/Kolkata')
      .format('YYYY-MM-DD HH:mm'),

    pickup_location: 'work',

    billing_customer_name: orderData.shipping_name,
    billing_last_name: '',
    billing_address: orderData.shipping_address,
    billing_address_2: '',
    billing_city: orderData.shipping_city,
    billing_pincode: orderData.shipping_pincode,
    billing_state: orderData.shipping_state,
    billing_country: orderData.shipping_country,
    billing_email: orderData.shipping_email,
    billing_phone: orderData.shipping_phone,

    shipping_is_billing: true,

    order_items: orderData.items,
    payment_method: orderData.paymentMethod,
    sub_total: orderData.total + orderData.discountApplied - orderData.shipping_charges,
    shipping_charges: orderData.shipping_charges,
    total_discount: orderData.discountApplied,

    length: 15,
    breadth: 10,
    height: 5,
    weight: orderData.items
      ? Math.max(
          0.5,
          orderData.items.reduce(
            (sum, item) => sum + (Number(item.units) || 1) * 0.45,
            0,
          ),
        )
      : 0.45,
  };

  const response = await fetch(`${SHIPROCKET_BASE}/orders/create/adhoc`, {
    method: 'POST',
    headers: getAuthHeaders(authToken),
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      data.message || data.error || 'Shiprocket order creation failed',
    );
  }

  return { data, payload };
}

export async function assignShiprocketAwbInternal({
  token,
  shipment_id,
  order_id,
}) {
  if (!order_id || !shipment_id) {
    throw new Error('order_id and shipment_id are required to assign AWB');
  }

  const authToken = token || (await fetchShiprocketToken());
  const response = await fetch(`${SHIPROCKET_BASE}/courier/assign/awb`, {
    method: 'POST',
    headers: getAuthHeaders(authToken),
    body: JSON.stringify({
      shipment_id,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || data.error || 'Shiprocket AWB assignment failed',
    );
  }

  return data;
}

export async function checkShiprocketRates(req, res) {
  try {
    const { pickup_code, delivery_code, cash_od, order_price, order_weight } =
      req.query;

    const pickupPostcode = String(pickup_code).trim();

    if (!pickupPostcode || !delivery_code || !order_price || !order_weight) {
      return res.status(400).json({
        success: false,
        message:
          'pickup_code, delivery_code, weight and order_price are required',
      });
    }

    const available_couriers = await findBestShiprocketCourier(
      {
        pickup_code: pickupPostcode,
        delivery_code,
        order_price: Number(order_price),
        order_weight: Number(order_weight),
        cod: cash_od === 'true' ? 1 : 0,
      },
      null,
    );

    return res
      .status(200)
      .json({ success: true, data: available_couriers ?? {} });
  } catch (error) {
    console.error('Shiprocket rates error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// fetch shiprocket all orders status
export async function fetchShiprocketOrdersStatus() {
  try {
    const authToken = await fetchShiprocketToken();
    const response = await fetch(`${SHIPROCKET_BASE}/orders`, {
      method: 'GET',
      headers: getAuthHeaders(authToken),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: data });
    }

    return data.data;
  } catch (error) {
    console.error('Shiprocket fetch orders error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
