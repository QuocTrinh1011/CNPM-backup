import React from 'react';
import { CreditCard, RefreshCw, ShieldCheck, Truck } from 'lucide-react';

export function ProductBenefits({ page, product }) {
  return (
          <div className={page ? "product-details product-benefits" : "product-details"}>
            <span>
              <ShieldCheck size={15} />{" "}
              {product.material || "Chất liệu chọn lọc"}
            </span>
            <span>
              <RefreshCw size={15} /> Đổi size trong 30 ngày
            </span>
            <span>
              <Truck size={15} /> Giao hàng toàn quốc
            </span>
            {page && <span><CreditCard size={15} /> Thanh toán COD</span>}
          </div>
  );
}
