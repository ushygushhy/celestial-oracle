import { skyNow } from "@/lib/services/sky-service";
import { SkyView } from "@/components/sky/SkyView";

export default function SkyPage() {
  return <SkyView initial={skyNow(new Date())} />;
}
