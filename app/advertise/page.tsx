import AdvertiseForm from "@/components/alias/AdvertiseForm";

export const metadata = { title: "לפרסם ב-Alias Games", robots: { index: false } };

export default function AdvertisePage() {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 p-4 flex justify-center">
      <div className="w-full max-w-md py-6">
        <AdvertiseForm />
      </div>
    </div>
  );
}
