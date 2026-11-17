import React from "react";
import { Package } from "lucide-react";

export default function CheckoutState({ title, message, action, onAction, loading = false }) {
  return <main className="shop-checkout-page"><section className="shop-checkout-state"><ShoppingStateIcon/><h1>{title}</h1><p role={loading ? "status" : undefined}>{message}</p>{action && <button className="button button-dark" onClick={onAction}>{action}</button>}</section></main>;
}

function ShoppingStateIcon(){return <Package size={36} aria-hidden="true"/>;}
