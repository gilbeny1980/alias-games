import AdvertiseForm from "@/components/alias/AdvertiseForm";

export const metadata = { title: "לפרסם ב״יובל״", robots: { index: false } };

export default function AdvertisePage() {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-red-500 via-red-600 to-red-700 p-4 flex justify-center">
      <div className="w-full max-w-md py-6">
        <AdvertiseForm />
      </div>
    </div>
  );
}
