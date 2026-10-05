import {
  canDownloadInvoice,
  getCustomerDisplayStatus,
  getOrderRoadmap,
  printInvoice,
  statusIcon,
  statusMap,
} from '@/utils/orderUtils';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';
import { OrderData } from '@/types';
import { useStore } from '@/context/StoreContext';

// ── PrintInvoice Button Component ────────────────────────────────────────────────
function PrintInvoice({ order }: { order: OrderData }) {
  if (!canDownloadInvoice(order)) return null;

  return (
    <button
      onClick={() => printInvoice(order)}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-maroon-900 text-gold-100 rounded-lg self-end mt-4 text-[10px] font-bold hover:bg-maroon-800 transition-colors cursor-pointer shrink-0 shadow-sm"
    >
      <Icon.print /> Print Invoice
    </button>
  );
}

export default function OrderRow({ order }: { order: OrderData }) {
  const { user } = useStore();
  const [expanded, setExpanded] = useState(false);
  const roadmap = getOrderRoadmap(order.status);
  const roadmapRef = useRef<HTMLDivElement | null>(null);
  const currentStepRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!expanded) return;

    const scrollRoadmapToCurrent = window.setTimeout(() => {
      if (!roadmapRef.current || !currentStepRef.current) return;

      const container = roadmapRef.current;
      const currentStep = currentStepRef.current;
      const containerWidth = container.clientWidth;
      const stepWidth = currentStep.offsetWidth;
      const stepLeft = currentStep.offsetLeft;
      const offsetLeft = Math.max(
        0,
        stepLeft - Math.max(0, (containerWidth - stepWidth) / 2),
      );

      container.scrollTo({
        left: offsetLeft,
        behavior: 'smooth',
      });
    }, 80);

    return () => window.clearTimeout(scrollRoadmapToCurrent);
  }, [expanded, order._id, roadmap.current]);

  return (
    <div
      className={`bg-white rounded-2xl border border-gold-100 shadow-xs overflow-hidden transition-all ${expanded ? 'shadow-md' : ''}`}
    >
      <div
        className="flex flex-nowrap whitespace-nowrap items-center gap-4 p-4 cursor-pointer hover:bg-maroon-50/30 transition-colors justify-between"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="min-w-[110px] flex flex-col gap-1.5">
          <span className="font-display text-sm font-bold text-maroon-900 block">
            #{order._id}
          </span>
          <span className="text-[11px] text-maroon-700/60">
            {new Date(order.order_date).toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata',
            })}
          </span>
          <span
            className={`inline-flex w-fit items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${statusMap[order.status]}`}
          >
            {getCustomerDisplayStatus(order.status)}
          </span>
        </div>

        <div className="hidden sm:flex flex-col items-end lg:mr-8 h-full flex-1 min-w-0">
          <span className="font-semibold text-sm text-maroon-900 block truncate">
            {order.shipping_name}
          </span>
          <span className="text-[11px] text-maroon-700/70 truncate block">
            {order.shipping_email} | {order.shipping_phone}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          {order.items.slice(0, 2).map((item, i) => (
            <img
              key={i}
              src={item.image}
              alt=""
              className="w-8 h-10 object-cover rounded-lg border border-gold-100"
            />
          ))}
          {order.items.length > 2 && (
            <span className="text-xs text-maroon-700 font-medium">
              +{order.items.length - 2}
            </span>
          )}
        </div>
        <div className="min-w-[90px] text-right hidden sm:block">
          <span className="font-display text-sm font-bold text-maroon-900">
            ₹{order.total.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-maroon-700/60 block">
            {order.paymentMethod}
          </span>
        </div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={`w-4 h-4 text-maroon-400 transition-transform shrink-0 
              ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {expanded && (
        <div className="border-t border-gold-100 p-4 animate-fadeIn">
          <div className="flex md:flex-row flex-col gap-6">
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-maroon-900 uppercase tracking-wider">
                Delivery Details
              </h4>
              <div className="bg-maroon-50 rounded-xl p-3 text-xs space-y-1.5">
                <div
                  className={`flex ${user.role === 'admin' ? 'flex-col' : 'flex-row gap-2'}`}
                >
                  <span className="text-maroon-700/70 w-16 shrink-0">
                    Name:
                  </span>
                  <span className="font-semibold text-maroon-900">
                    {order.shipping_name}
                  </span>
                </div>
                <div
                  className={`flex ${user.role === 'admin' ? 'flex-col' : 'flex-row gap-2'}`}
                >
                  <span className="text-maroon-700/70 w-16 shrink-0">
                    Email:
                  </span>
                  <span className="text-maroon-900">
                    {order.shipping_email}
                  </span>
                </div>
                <div
                  className={`flex ${user.role === 'admin' ? 'flex-col' : 'flex-row gap-2'}`}
                >
                  <span className="text-maroon-700/70 w-16 shrink-0">
                    Phone:
                  </span>
                  <span className="text-maroon-900">
                    {order.shipping_phone}
                  </span>
                </div>
                <div
                  className={`flex ${user.role === 'admin' ? 'flex-col' : 'flex-row gap-2'}`}
                >
                  <span className="text-maroon-700/70 w-16 shrink-0">
                    Address:
                  </span>
                  <span className="text-maroon-900 leading-relaxed">
                    {order.shipping_address} {order.shipping_city},{' '}
                    {order.shipping_state}, {order.shipping_country} -{' '}
                    {order.shipping_pincode}
                  </span>
                </div>
              </div>
              <h4 className="text-xs font-bold text-maroon-900 uppercase tracking-wider pt-1">
                Items
              </h4>
              <div className="space-y-2">
                {order.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-white rounded-xl p-2.5 border border-gold-100"
                  >
                    <img
                      src={item.image}
                      alt=""
                      className="w-10 h-12 object-cover rounded-lg border border-gold-100 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-maroon-900 block truncate">
                        {item.name}
                      </span>

                      <span className="text-[10px] text-maroon-700/70">
                        {item.category} · Qty: {item.units} · Size: {item.size}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-maroon-900 shrink-0">
                      ₹
                      {(item.selling_price * item.units).toLocaleString(
                        'en-IN',
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 flex flex-col">
              <div className="px-4 pb-4 flex-1">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.24em] text-maroon-700">
                    <span>Order roadmap</span>
                    <span className="ml-3 font-semibold text-maroon-900">
                      {roadmap.current}
                    </span>
                  </div>
                </div>
                <div ref={roadmapRef} className="mt-3 overflow-x-auto">
                  <div className="flex items-center gap-3 ">
                    {roadmap.stages.map((stage, index) => (
                      <div
                        key={stage.status}
                        ref={stage.state === 'current' ? currentStepRef : null}
                        className="flex items-center gap-3"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-full border-2 text-xl font-bold ${stage.state === 'complete'
                                ? 'border-maroon-900 bg-maroon-900 text-white'
                                : stage.state === 'current'
                                  ? 'border-maroon-900 bg-white text-maroon-900'
                                  : 'border-gold-200 bg-gold-100 text-maroon-700'
                              }`}
                          >
                            {stage.icon}
                          </div>
                          <span
                            className={`max-w-[88px] text-center text-[10px] whitespace-nowrap leading-tight ${stage.state === 'current'
                                ? 'font-semibold text-maroon-900'
                                : 'text-maroon-600'
                              }`}
                          >
                            {stage.status}
                          </span>
                        </div>

                        {index < roadmap.stages.length - 1 && (
                          <div
                            className={`h-0.5 flex-1 rounded-full ${stage.state === 'complete'
                                ? 'bg-maroon-900'
                                : 'bg-gold-200'
                              }`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <h4 className="text-xs font-bold text-maroon-900 uppercase tracking-wider mb-3">
                Order Summary
              </h4>
              <div className="bg-gold-50 rounded-xl p-3 border border-gold-200">
                <div className="text-xs font-bold text-maroon-900 mb-1">
                  Summary
                </div>
                <div className="flex justify-between text-xs text-maroon-800 mb-2">
                  <span>Items:</span>
                  <span className="font-bold">
                    {order.items.reduce((a, b) => a + b.units, 0)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-maroon-800 mb-2">
                  <span>Sub Total:</span>
                  <span className="font-bold">₹{order.sub_total.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-xs text-maroon-800 mb-2">
                  <span>Coupon Discount:</span>
                  <span className="font-bold">₹{order.discountApplied?.toLocaleString('en-IN') || '0'}</span>
                </div>
                <div className="flex justify-between text-xs text-maroon-800 mb-2">
                  <span>Shipping Charges:</span>
                  <span className="font-bold">₹{order.shipping_charges.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-xs text-maroon-800 mb-2">
                  <span>Payment:</span>
                  <span className="font-bold">{order.paymentMethod}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-maroon-900 mt-4 pt-4 border-t border-gold-200">
                  <span>Total:</span>
                  <span>₹{order.total.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <PrintInvoice order={order} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
