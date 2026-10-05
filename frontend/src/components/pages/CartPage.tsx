import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { CustomerApi } from '@/api/customer';
import { generateSlug } from '@/utils/slug';
import GuestUser from '../guestUser';
import AccessDenied from '../accessDenied';
import { getSelectedSizeOption } from '@/utils/productInventory';

export default function CartPage() {
  const navigate = useNavigate();
  const {
    cart,
    showToast,
    setBuyNowItem,
    user,
    couponCode,
    couponDiscountPercentage,
    setCouponCode,
    setCouponDiscountPercentage,
  } = useStore();
  const { updateQuantity, removeFromCart, validateCoupon } = CustomerApi();
  const [coupon, setCoupon] = useState('');
  const handleCoupon = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!coupon.trim()) {
      showToast('Please enter a coupon code', 'warning');
      return;
    }

    const validation = await validateCoupon(coupon.trim().toUpperCase());
    if (validation) {
      setCouponCode(validation.promoCode);
      setCouponDiscountPercentage(validation.discountPercentage);
      showToast(
        `🎉 ${validation.promoCode} applied — ${validation.discountPercentage}% off!`,
        'success',
      );
    }
  };

  const availableCart = useMemo(
    () =>
      cart.filter((item) => {
        const selectedSize = getSelectedSizeOption(item.product, item.size);
        return Boolean(selectedSize && selectedSize.units > 0);
      }),
    [cart],
  );
  const displayCart = useMemo(() => cart, [cart]);
  const hasItems = displayCart.length > 0;

  const cartSubtotal = availableCart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );
  const savings = Math.round(cartSubtotal * (couponDiscountPercentage / 100));
  const finalTotal = cartSubtotal - savings;
  const shippingFree = cartSubtotal >= 5000;

  if (!user.loggedIn) return <GuestUser page="cart" />;
  if (user.role !== 'customer') return <AccessDenied page="cart" />;

  return (
    <div className="min-h-screen bg-[#fdf8f1]">
      <div className="bg-white border-b border-gold-100 px-4 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="font-display text-xl sm:text-2xl font-bold text-maroon-900">
            Shopping Bag <br />
            <span className="text-maroon-400 text-sm font-normal">
              ({availableCart.length}{' '}
              {availableCart.length === 1 ? 'item' : 'items'})
            </span>
          </h1>
          <button
            onClick={() => navigate('/shop')}
            className="text-sm text-gold-600 font-bold hover:text-gold-700 cursor-pointer"
          >
            ← Continue shopping
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!hasItems ? (
          <div className="text-center py-24 max-w-md mx-auto">
            <div className="text-7xl mb-5">🛍️</div>
            <h2 className="font-display text-2xl font-bold text-maroon-900 mb-2">
              Your bag is empty
            </h2>
            <p className="text-sm text-maroon-700/70 mb-6">
              Discover our heirloom silk sarees and add the ones that speak to
              your heart.
            </p>
            <button
              onClick={() => navigate('/shop')}
              className="px-8 py-3 bg-maroon-900 text-gold-100 rounded-full font-bold text-sm hover:bg-maroon-800 transition-colors cursor-pointer shadow-md"
            >
              Explore Catalogue
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 xl:col-span-8 space-y-4">
              {displayCart.map(({ product: p, quantity, size }) => {
                const d = p.originalPrice
                  ? Math.round(
                      ((p.originalPrice - p.price) / p.originalPrice) * 100,
                    )
                  : 0;
                const selectedSize = getSelectedSizeOption(p, size);
                const isAvailable = Boolean(
                  selectedSize && selectedSize.units > 0,
                );
                return (
                  <div
                    key={`${p._id}-${size}`}
                    className={`bg-white rounded-2xl border border-gold-100 shadow-xs p-4 flex gap-4 hover:border-gold-300 transition-colors ${!isAvailable ? 'opacity-80' : ''}`}
                  >
                    <button
                      onClick={() =>
                        navigate(`/product/${generateSlug(p._id, p.name)}`)
                      }
                      className="shrink-0 cursor-pointer"
                    >
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-20 h-24 sm:w-24 sm:h-32 object-cover rounded-xl border border-gold-100 hover:opacity-90 transition-opacity"
                      />
                    </button>

                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-gold-600 uppercase tracking-wider">
                          {p.category}
                        </span>
                        <h3
                          onClick={() =>
                            navigate(`/product/${generateSlug(p._id, p.name)}`)
                          }
                          className="font-display text-base sm:text-lg font-bold text-maroon-900 cursor-pointer hover:text-maroon-700 transition-colors leading-snug"
                        >
                          {p.name}
                        </h3>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="font-bold text-maroon-900">
                            ₹{p.price.toLocaleString('en-IN')}
                          </span>
                          {p.originalPrice && (
                            <span className="text-xs text-maroon-400 line-through">
                              ₹{p.originalPrice.toLocaleString('en-IN')}
                            </span>
                          )}
                          {d > 0 && (
                            <span className="text-xs text-emerald-700 font-bold">
                              {d}% off
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-maroon-700 mt-1">
                          Size: <span className="font-semibold">{size}</span>
                        </div>
                        {!isAvailable && (
                          <div className="mt-2 inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600">
                            Out of stock
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                        <div className="inline-flex items-center border-2 border-gold-200 rounded-xl overflow-hidden">
                          <button
                            onClick={() =>
                              updateQuantity(p._id, quantity - 1, size)
                            }
                            disabled={!isAvailable}
                            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-maroon-900 font-bold hover:bg-maroon-50 transition-colors cursor-pointer text-base disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            -
                          </button>
                          <span className="w-8 sm:w-10 text-center font-bold text-maroon-900 text-sm">
                            {quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(p._id, quantity + 1, size)
                            }
                            disabled={!isAvailable}
                            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-maroon-900 font-bold hover:bg-maroon-50 transition-colors cursor-pointer text-base disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            +
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-display font-bold text-maroon-900 text-base sm:text-lg">
                            ₹{(p.price * quantity).toLocaleString('en-IN')}
                          </span>
                          <button
                            onClick={() => removeFromCart(p._id, size)}
                            className="text-maroon-400 hover:text-red-500 transition-colors cursor-pointer"
                            title="Remove"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              className="w-4 h-4"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div
                className={`rounded-2xl p-4 border-2 text-sm font-medium ${shippingFree ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-gold-50 border-gold-200 text-gold-800'}`}
              >
                {shippingFree
                  ? "✅ You've unlocked free insured shipping!"
                  : `🚚 Add ₹${(5000 - cartSubtotal).toLocaleString('en-IN')} more for free shipping`}
              </div>
            </div>

            <div className="lg:col-span-5 xl:col-span-4">
              <div className="bg-white rounded-2xl border border-gold-100 shadow-xs p-5 sticky top-24 space-y-5">
                <h2 className="font-display text-base font-bold text-maroon-900 border-b border-gold-100 pb-3">
                  Order Summary
                </h2>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-maroon-700">
                      Subtotal (
                      {availableCart.reduce((a, b) => a + b.quantity, 0)} items)
                    </span>
                    <span className="font-semibold text-maroon-900">
                      ₹{cartSubtotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                  {savings > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Coupon discount ({couponDiscountPercentage}%)</span>
                      <span>- ₹{savings.toLocaleString('en-IN')}</span>
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
                  <div className="flex justify-between font-bold text-base border-t border-gold-100 pt-3">
                    <span className="text-maroon-900">Total</span>
                    <span className="font-display text-maroon-900 text-lg">
                      ₹
                      {(finalTotal + (shippingFree ? 0 : 150)).toLocaleString(
                        'en-IN',
                      )}
                    </span>
                  </div>
                </div>

                <form onSubmit={handleCoupon} className="space-y-2">
                  <label className="text-xs font-bold text-maroon-900 uppercase tracking-wider block">
                    Voucher Code
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1  items-stretch">
                      <input
                        type="text"
                        value={couponCode ? couponCode : coupon}
                        onChange={(e) => setCoupon(e.target.value)}
                        disabled={!!couponCode}
                        placeholder="e.g. BRIDE30"
                        className="flex-1 w-full pr-10 px-3 py-2.5 border-2 border-gold-200 rounded-xl text-xs text-maroon-900 uppercase focus:outline-none focus:border-maroon-700 disabled:opacity-50 disabled:bg-maroon-50 font-semibold"
                      />
                      {couponCode && (
                        <button
                          type="button"
                          onClick={() => {
                            setCouponCode('');
                            setCouponDiscountPercentage(0);
                            setCoupon('');
                            showToast('Coupon removed', 'success');
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-maroon-900 bg-transparent border-none p-0 hover:text-maroon-700 transition-colors cursor-pointer"
                          aria-label="Remove voucher"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            className="w-4 h-4"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={!!couponCode}
                      className="px-3 py-2.5 bg-maroon-900 text-gold-100 text-xs font-bold rounded-xl hover:bg-maroon-800 disabled:opacity-50 cursor-pointer whitespace-nowrap transition-colors"
                    >
                      {couponCode ? '✓ Applied' : 'Apply'}
                    </button>
                  </div>
                  {couponCode && (
                    <p className="text-[10px] text-emerald-700">
                      Coupon <strong>{couponCode}</strong> applied for{' '}
                      <strong>{couponDiscountPercentage}%</strong> off.
                    </p>
                  )}
                </form>

                <button
                  onClick={() => {
                    setBuyNowItem(null);
                    navigate('/checkout');
                  }}
                  disabled={!availableCart.length}
                  className="w-full py-4 rounded-2xl bg-gold-500 hover:bg-gold-400 text-white font-bold text-sm tracking-wider shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {availableCart.length
                    ? 'Proceed to Checkout →'
                    : 'No available items to checkout'}
                </button>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { icon: '🔒', label: 'Secure' },
                    { icon: '✅', label: 'Authentic' },
                    { icon: '↩️', label: 'Easy Return' },
                  ].map((t) => (
                    <div
                      key={t.label}
                      className="text-center bg-maroon-50 rounded-xl p-2"
                    >
                      <div className="text-lg">{t.icon}</div>
                      <div className="text-[10px] font-semibold text-maroon-800 mt-0.5">
                        {t.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
