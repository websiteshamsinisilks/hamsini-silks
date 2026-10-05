import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import type { CartItem } from '../../context/contextTypes';
import { Auth } from '@/api/auth';
import { CustomerApi } from '@/api/customer';
import GuestUser from '../guestUser';
import AccessDenied from '../accessDenied';
import { RazorpayApi } from '@/utils/razorpayUtils';
import {
  normalizeOtpValue,
  normalizePhoneValue,
  normalizePincodeValue,
} from '@/utils/cn';
import { OrderData } from '@/types';
import { getSelectedSizeOption } from '@/utils/productInventory';
import { ProductsApi } from '@/api/products';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

type PaymentMethod = {
  id: string;
  label: string;
  description: string;
  enabled?: boolean;
};

const INITIAL_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'cod', label: 'Cash on Delivery', description: 'Pay at doorstep' },
  {
    id: 'razorpay',
    label: 'Razorpay',
    description: 'Cards, UPI, wallets and net banking',
  },
];

export default function CheckoutPage() {
  const navigate = useNavigate();
  const {
    cart,
    user,
    buyNowItem,
    showToast,
    couponCode,
    couponDiscountPercentage,
    setCouponCode,
    setCouponDiscountPercentage,
    orderData,
    setOrderData,
  } = useStore();
  const {
    placeOrder,
    clearCart,
    validatePhone,
    getPaymentMethods,
    checkShiprocketRates,
  } = CustomerApi();
  const { sendPhoneOtp } = Auth();
  const { handleRazorpayPayment } = RazorpayApi();
  const { fetchAllProducts } = ProductsApi();

  if (!user.loggedIn && user.role !== 'customer') return;

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingPincode, setShippingPincode] = useState('');
  const [shiprocketCourierId, setShiprocketCourierId] = useState('');
  const [etd, setEtd] = useState('');
  const [noCourier, setNoCourier] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(
    INITIAL_PAYMENT_METHODS,
  );

  const [payment, setPayment] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const countdownRef = useRef<number | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentFeedback, setPaymentFeedback] = useState<{
    type: 'idle' | 'loading' | 'success' | 'error';
    message: string;
  }>({ type: 'idle', message: '' });

  const checkoutItems = useMemo(() => {
    if (buyNowItem) return [buyNowItem];

    return cart.filter((item) => {
      const selectedSize = getSelectedSizeOption(item.product, item.size);
      return Boolean(selectedSize && selectedSize.units > 0);
    });
  }, [buyNowItem, cart]);

  const orderSubtotal = buyNowItem
    ? buyNowItem.product.price * buyNowItem.quantity
    : checkoutItems.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0,
      );
  const discountAmount = Math.round(
    orderSubtotal * (couponDiscountPercentage / 100),
  );
  const shippingFree = orderSubtotal >= 5000;
  const shippingCharge = shippingFree ? 0 : 150;
  const orderTotal = orderSubtotal - discountAmount + shippingCharge;

  useEffect(() => {
    const loadMethods = async () => {
      if (!user.loggedIn || user.role !== 'customer') return;
      const methods = await getPaymentMethods();
      if (Array.isArray(methods) && methods.length > 0) {
        setPaymentMethods(methods);
      }
    };

    loadMethods();
  }, [user.loggedIn, user.role]);

  const handleSendOtp = async () => {
    const normalizedPhone = normalizePhoneValue(phone);
    if (!/^\d{10}$/.test(normalizedPhone)) {
      showToast('Please enter a valid 10-digit phone number.', 'error');
      return;
    }

    setSendingOtp(true);
    try {
      await sendPhoneOtp(normalizedPhone);
      setOtpSent(true);
      setOtpVerified(false);
      setOtp('');
      setResendCountdown(30);
    } catch (error) {
      console.error('Send OTP failed', error);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    await handleSendOtp();
  };

  useEffect(() => {
    if (resendCountdown <= 0) {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      return;
    }

    countdownRef.current = window.setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [resendCountdown]);

  const handleVerifyOtp = async () => {
    const normalizedPhone = normalizePhoneValue(phone);
    const normalizedOtp = normalizeOtpValue(otp);

    if (!/^\d{10}$/.test(normalizedPhone)) {
      showToast('Please enter a valid 10-digit phone number.', 'error');
      return;
    }
    if (!/^\d{6}$/.test(normalizedOtp)) {
      showToast('Please enter a valid 6-digit OTP.', 'error');
      return;
    }

    setVerifyingOtp(true);
    try {
      const result = await validatePhone(normalizedPhone, normalizedOtp);
      if (result?.success) {
        setOtpVerified(true);
        showToast('Phone verified for COD order.', 'success');
        // Automatically place order after OTP verification
        await new Promise((resolve) => setTimeout(resolve, 500)); // Small delay for user feedback
        await handlePlaceOrder();
      }
    } catch (error) {
      console.error('Verify OTP failed', error);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleRazorPay = () =>
    handleRazorpayPayment({
      setIsProcessingPayment,
      setPaymentFeedback,
      name,
      email,
      phone,
      address,
      setPayment,
      setOrderId,
      setOtpSent,
      setOtp,
      setOtpVerified,
      orderData,
    });

  const handlePlaceOrder = async () => {
    if (payment === 'cod' && !otpVerified && user.phone !== phone) {
      showToast(
        'Please verify your phone with OTP before placing a COD order.',
        'error',
      );
      return;
    }

    if (payment === 'razorpay') {
      await handleRazorPay();
      return;
    }

    const orderResult = await placeOrder(orderData as OrderData);

    if (orderResult?.success) {
      fetchAllProducts();
      const savedOrder = orderResult.data;
      setOrderId(savedOrder._id);
      await clearCart();
      setCouponCode('');
      setCouponDiscountPercentage(0);
      setOtpSent(false);
      setOtp('');
      setOtpVerified(false);
      setResendCountdown(0);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handlePlaceOrder();
  };

  useEffect(() => {
    const fetchShippingInfo = async () => {
      const shippingInfo = await checkShiprocketRates({
        delivery_code: shippingPincode,
        order_price: orderTotal,
      });

      if (!shippingInfo || Object.keys(shippingInfo).length === 0) {
        setNoCourier(true);
        setShippingCity('');
        setShippingState('');
        setShiprocketCourierId('');
        setEtd('');
        return;
      }

      setNoCourier(false);
      setShippingCity(shippingInfo?.city || '');
      setShippingState(shippingInfo?.state || '');
      setShiprocketCourierId(String(shippingInfo?.courier_company_id || ''));
      setEtd(shippingInfo?.etd || '');
    };

    if (shippingPincode.length === 6) {
      fetchShippingInfo();
    } else {
      setNoCourier(false);
      setShippingCity('');
      setShippingState('');
      setEtd('');
    }
  }, [shippingPincode]);

  const formattedOrderData = useMemo<OrderData>(
    () => ({
      order_date: new Date().toISOString(),
      shipping_email: email,
      shipping_phone: phone,
      shipping_name: name,
      shipping_address: address,
      shipping_city: shippingCity,
      shipping_state: shippingState,
      shipping_country: 'India',
      shipping_pincode: shippingPincode,
      shipping_charges: shippingCharge,
      sub_total: orderSubtotal,
      total: orderTotal,
      discountApplied: discountAmount,
      items: checkoutItems.map((item: CartItem) => ({
        sku: item.product._id,
        name: item.product.name,
        selling_price: item.product.price,
        discount: Number(
          ((item.product.price * couponDiscountPercentage) / 100).toFixed(2),
        ),
        units: item.quantity,
        size: item.size,
      })),
      promoCode: couponCode || '',
      shiprocketCourierId,
      paymentMethod: 'COD',
      status: 'NEW',
    }),
    [
      address,
      checkoutItems,
      couponCode,
      couponDiscountPercentage,
      email,
      name,
      orderSubtotal,
      orderTotal,
      phone,
      shippingCity,
      shippingPincode,
      shippingState,
      shiprocketCourierId,
    ],
  );

  useEffect(() => {
    setOrderData(formattedOrderData);
  }, [formattedOrderData, setOrderData]);

  if (!user.loggedIn) return <GuestUser page="checkout" />;
  if (user.role !== 'customer') return <AccessDenied page="checkout" />;

  if (checkoutItems.length === 0 && !orderId && !buyNowItem) {
    return (
      <div className="min-h-screen bg-[#fdf8f1] flex items-center justify-center">
        <div className="text-center py-16 px-4">
          <div className="text-5xl mb-4">🛍️</div>
          <p className="text-maroon-800 font-serif italic text-lg mb-4">
            Your bag is empty.
          </p>
          <button
            onClick={() => navigate('/shop')}
            className="px-6 py-3 bg-maroon-900 text-gold-100 rounded-full font-bold text-sm cursor-pointer"
          >
            Explore Catalogue
          </button>
        </div>
      </div>
    );
  }

  /* ── SUCCESS SCREEN ── */
  if (orderId) {
    return (
      <div className="min-h-screen bg-[#fdf8f1] flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-3xl border-2 border-gold-300 p-8 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-mandala opacity-10 pointer-events-none" />
            <div className="relative">
              {/* Animated success icon */}
              <div className="w-24 h-24 bg-gradient-to-br from-gold-400 to-gold-600 rounded-full flex items-center justify-center mx-auto mb-4 text-5xl shadow-lg animate-float">
                🪷
              </div>
              <div className="text-xs font-bold tracking-[0.4em] text-gold-700 mb-2 uppercase">
                ॐ मङ्गलम् ॐ
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-maroon-900 mb-2">
                Order Placed!
              </h2>
              <p className="text-sm text-maroon-700/80 mb-6 leading-relaxed">
                Your heirloom saree has been commissioned. Our merchants will be
                confirming you order and dispatch tracking will be sent to your
                email.
              </p>

              {/* Order info card */}
              <div className="bg-maroon-50 rounded-2xl p-4 text-left mb-6 space-y-2.5 border border-gold-200">
                {[
                  { label: 'Order ID', val: orderId },
                  { label: 'Patron', val: name },
                  { label: 'Email', val: email },
                  {
                    label: 'Payment',
                    val: payment === 'razorpay' ? 'Razorpay' : 'COD',
                  },
                  {
                    label: 'Status',
                    val: '⏳ NEW',
                    highlight: true,
                  },
                ].map((r) => (
                  <div
                    key={r.label}
                    className="flex justify-between items-center text-xs"
                  >
                    <span className="text-maroon-700">{r.label}</span>
                    <span
                      className={`font-bold ${r.highlight ? 'text-gold-700' : 'text-maroon-900'}`}
                    >
                      {r.val}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate('/shop')}
                  className="flex-1 py-3 rounded-xl bg-gold-50 text-maroon-900 text-sm font-bold border border-gold-200 hover:bg-gold-100 transition-colors cursor-pointer"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── CHECKOUT FORM ── */
  return (
    <div className="min-h-screen bg-[#fdf8f1]">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gold-100 px-4 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-2 text-xs text-maroon-700">
          <Link to="/" className="hover:text-maroon-900">
            Home
          </Link>
          <span>›</span>
          {!buyNowItem && (
            <>
              <Link to="/cart" className="hover:text-maroon-900">
                Bag
              </Link>
              <span>›</span>
            </>
          )}
          <span className="text-maroon-900 font-semibold">Checkout</span>
        </div>
      </div>

      {/* Progress steps */}
      <div className="bg-white border-b border-gold-100 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-2 text-xs">
          {(buyNowItem
            ? ['Product', 'Checkout', 'Confirmed']
            : ['Bag', 'Checkout', 'Confirmed']
          ).map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 1 ? 'bg-maroon-900 text-gold-200' : i === 0 ? 'bg-gold-200 text-maroon-900' : 'bg-maroon-100 text-maroon-500'}`}
              >
                {i + 1}
              </div>
              <span
                className={
                  i === 1 ? 'font-bold text-maroon-900' : 'text-maroon-500'
                }
              >
                {step}
              </span>
              {i < 2 && <span className="text-maroon-300">›</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* ── Form ── */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">
            {/* Delivery section */}
            <div className="bg-white rounded-2xl border border-gold-100 shadow-xs p-5 sm:p-6">
              <h2 className="font-display text-base font-bold text-maroon-900 mb-5 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-maroon-900 text-gold-200 text-xs flex items-center justify-center font-bold">
                  1
                </span>
                Delivery Details
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-maroon-900 mb-1.5">
                    Full Name *
                  </label>
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gold-200 rounded-xl text-sm text-maroon-900 focus:outline-none focus:border-maroon-700 transition-colors font-medium"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-maroon-900 mb-1.5">
                      Email *
                    </label>
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gold-200 rounded-xl text-sm text-maroon-900 focus:outline-none focus:border-maroon-700 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-maroon-900 mb-1.5">
                      Phone *
                    </label>
                    <input
                      required
                      type="tel"
                      value={phone}
                      maxLength={10}
                      onChange={(event) => {
                        let value = event.target.value;
                        if (value.startsWith('0')) {
                          value = value.slice(1);
                        }
                        setPhone(value);
                      }}
                      disabled={otpVerified}
                      className={`w-full px-4 py-3 border-2 rounded-xl text-sm text-maroon-900 focus:outline-none transition-colors ${otpVerified ? 'border-emerald-300 bg-emerald-50 text-emerald-900 cursor-not-allowed' : 'border-gold-200 focus:border-maroon-700'}`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-maroon-900 mb-1.5">
                    Delivery Address *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gold-200 rounded-xl text-sm text-maroon-900 focus:outline-none focus:border-maroon-700 transition-colors resize-none leading-relaxed"
                  />
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-maroon-900 mb-1.5">
                      Pincode *
                    </label>
                    <input
                      required
                      type="text"
                      value={shippingPincode}
                      onChange={(e) =>
                        setShippingPincode(
                          normalizePincodeValue(e.target.value),
                        )
                      }
                      className={`w-full px-4 py-3 border-2 rounded-xl text-sm text-maroon-900 focus:outline-none transition-colors ${noCourier ? 'border-red-500 focus:border-red-600' : 'border-gold-200 focus:border-maroon-700'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-maroon-900 mb-1.5">
                      City *
                    </label>
                    <input
                      required
                      type="text"
                      value={shippingCity}
                      disabled
                      className="w-full px-4 py-3 border-2 border-gold-200 rounded-xl text-sm text-maroon-900 focus:outline-none focus:border-maroon-700 transition-colors cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-maroon-900 mb-1.5">
                      State *
                    </label>
                    <input
                      required
                      type="text"
                      value={shippingState}
                      disabled
                      className="w-full px-4 py-3 border-2 border-gold-200 rounded-xl text-sm text-maroon-900 focus:outline-none focus:border-maroon-700 transition-colors cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
              <div>
                {noCourier ? (
                  <p className="text-xs text-red-600 mt-3">
                    No courier service is available for this pincode.
                  </p>
                ) : etd ? (
                  <p className="text-xs text-maroon-700/70 mt-3">
                    Estimated Delivery:{' '}
                    <span className="font-semibold">{etd}</span>
                  </p>
                ) : null}
              </div>
            </div>

            {/* Payment section */}
            <div className="bg-white rounded-2xl border border-gold-100 shadow-xs p-5 sm:p-6">
              <h2 className="font-display text-base font-bold text-maroon-900 mb-5 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-maroon-900 text-gold-200 text-xs flex items-center justify-center font-bold">
                  2
                </span>
                Payment Method
              </h2>
              <div className="space-y-3">
                {paymentMethods.map((pm) => (
                  <label
                    key={pm.id}
                    className={`flex items-center gap-4 rounded-2xl border-2 px-4 py-4 transition-all ${
                      payment === pm.id
                        ? 'border-maroon-900 bg-maroon-50'
                        : 'border-gold-200 hover:border-gold-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={pm.id}
                      checked={payment === pm.id}
                      onChange={() => {
                        if (!phone || !address || !name || !email) {
                          showToast(
                            'Please fill in all delivery details before selecting a payment method.',
                            'error',
                          );
                          return;
                        }
                        setPayment(pm.id);
                        setPaymentFeedback({ type: 'idle', message: '' });
                      }}
                      className="accent-maroon-900"
                    />
                    <span className="text-xl">
                      {pm.id === 'cod' ? '💵' : '💳'}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-maroon-900">
                        {pm.label}
                      </div>
                      <div className="text-xs text-maroon-700/70">
                        {pm.description}
                      </div>
                    </div>
                    {payment === pm.id && (
                      <span className="text-sm font-semibold text-maroon-900">
                        Selected
                      </span>
                    )}
                  </label>
                ))}

                {paymentFeedback.type !== 'idle' && (
                  <div
                    className={`rounded-2xl border p-3 text-sm ${
                      paymentFeedback.type === 'error'
                        ? 'border-rose-200 bg-rose-50 text-rose-800'
                        : paymentFeedback.type === 'success'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-gold-200 bg-[#fff8ef] text-maroon-800'
                    }`}
                  >
                    {paymentFeedback.message}
                  </div>
                )}
              </div>

              {payment === 'COD' && (
                <div className="mt-4 rounded-2xl border border-gold-100 bg-[#fff8ef] p-4">
                  <p className="text-sm font-semibold text-maroon-900 mb-3">
                    Cash on Delivery requires phone OTP verification.
                  </p>

                  {!otpSent ? (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="w-full py-3 rounded-xl bg-maroon-900 hover:bg-maroon-800 text-gold-100 font-bold text-sm tracking-wide transition-colors cursor-pointer shadow-md"
                    >
                      {sendingOtp ? 'Sending OTP…' : 'Send OTP'}
                    </button>
                  ) : otpVerified ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 font-semibold">
                      ✓ OTP verified for {phone || 'your phone number'}. Ready
                      to place order.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-maroon-900 mb-1.5">
                          Enter OTP
                        </label>
                        <input
                          type="text"
                          value={otp}
                          onChange={(e) =>
                            setOtp(normalizeOtpValue(e.target.value))
                          }
                          className="w-full px-4 py-3 border-2 border-gold-200 rounded-xl text-sm text-maroon-900 focus:outline-none focus:border-maroon-700 transition-colors"
                          placeholder=""
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={verifyingOtp || otp.length < 6}
                        className="w-full py-3 rounded-xl bg-maroon-900 hover:bg-maroon-800 text-gold-100 font-bold text-sm tracking-wide transition-colors cursor-pointer shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {verifyingOtp
                          ? 'Verifying and placing order…'
                          : `Verify & Place Order · ₹${orderTotal.toLocaleString('en-IN')}`}
                      </button>

                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={resendCountdown > 0}
                        className="w-full py-3 rounded-xl border-2 border-gold-200 text-maroon-900 font-bold text-sm tracking-wide transition-colors cursor-pointer hover:bg-gold-50 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {resendCountdown > 0
                          ? `Resend OTP in ${resendCountdown}s`
                          : 'Resend OTP'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Submit */}
            {payment !== 'COD' || otpVerified ? (
              <button
                type="submit"
                disabled={isProcessingPayment}
                className="w-full py-4 rounded-2xl bg-maroon-900 hover:bg-maroon-800 text-gold-100 font-bold text-sm sm:text-base tracking-wider shadow-lg transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isProcessingPayment
                  ? 'Processing…'
                  : payment === 'razorpay'
                    ? `Pay ₹${orderTotal.toLocaleString('en-IN')} via Razorpay`
                    : `🪷 Confirm Order · ₹${orderTotal.toLocaleString('en-IN')}`}
              </button>
            ) : null}
          </form>

          {/* ── Summary panel ── */}
          <div className="lg:col-span-5 space-y-4 lg:top-24">
            <div className="bg-white rounded-2xl border border-gold-100 shadow-xs p-5">
              <h3 className="font-display text-sm font-bold text-maroon-900 uppercase tracking-wider border-b border-gold-100 pb-3 mb-4">
                Your Order ({buyNowItem ? 1 : checkoutItems.length}{' '}
                {(buyNowItem ? 1 : checkoutItems.length) === 1
                  ? 'item'
                  : 'items'}
                )
              </h3>
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {buyNowItem ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={buyNowItem.product.image}
                      alt={buyNowItem.product.name}
                      className="w-12 h-16 object-cover rounded-lg border border-gold-100 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-maroon-900 block truncate">
                        {buyNowItem.product.name}
                      </span>
                      <span className="text-[10px] text-maroon-700/70">
                        Qty: {buyNowItem.quantity}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-maroon-900 shrink-0">
                      ₹
                      {(
                        buyNowItem.product.price * buyNowItem.quantity
                      ).toLocaleString('en-IN')}
                    </span>
                  </div>
                ) : (
                  checkoutItems.map(({ product: p, quantity, size }) => (
                    <div key={p._id} className="flex items-center gap-3">
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-12 h-16 object-cover rounded-lg border border-gold-100 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-maroon-900 block truncate">
                          {p.name}
                        </span>
                        <span className="text-[10px] text-maroon-700/70">
                          Qty: {quantity} · Size: {size}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-maroon-900 shrink-0">
                        ₹{(p.price * quantity).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-gold-100 mt-4 pt-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-maroon-700">
                  <span>Subtotal</span>
                  <span className="font-semibold text-maroon-900">
                    ₹{orderSubtotal.toLocaleString('en-IN')}
                  </span>
                </div>
                {couponCode && discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>
                      Coupon <span className="font-semibold">{couponCode}</span>
                    </span>
                    <span className="font-semibold">
                      - ₹{discountAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-maroon-700">Shipping</span>
                  <span
                    className={
                      shippingFree
                        ? 'text-emerald-700 font-semibold'
                        : 'font-semibold text-maroon-900'
                    }
                  >
                    {shippingFree ? 'FREE' : '₹150'}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-base border-t border-gold-100 pt-2 mt-2">
                  <span className="text-maroon-900">Total</span>
                  <span className="font-display text-lg text-maroon-900">
                    ₹{orderTotal.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Security badges */}
            <div className="bg-maroon-50 rounded-2xl p-4 flex items-center gap-3 border border-gold-200">
              <span className="text-2xl shrink-0">🔒</span>
              <div className="text-xs text-maroon-800">
                <strong className="block">256-bit SSL Encrypted</strong>
                Your payment details are fully protected and never stored.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
