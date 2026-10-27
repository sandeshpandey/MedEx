import { AppHeader } from "@/components/AppHeader";
import { CartApp } from "@/components/cart/CartApp";

export default function CartPage() {
  return (
    <>
      <AppHeader title="Cart and checkout" />
      <CartApp />
    </>
  );
}
