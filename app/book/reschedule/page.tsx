import { AppHeader } from "@/components/AppHeader";
import { BookApp } from "@/components/book/BookApp";

export default function ReschedulePage() {
  return (
    <>
      <AppHeader title="Reschedule" />
      <BookApp reschedule />
    </>
  );
}
