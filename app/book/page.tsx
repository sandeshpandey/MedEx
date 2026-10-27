import { AppHeader } from "@/components/AppHeader";
import { BookApp } from "@/components/book/BookApp";

export default function BookPage() {
  return (
    <>
      <AppHeader title="Booking" />
      <BookApp />
    </>
  );
}
