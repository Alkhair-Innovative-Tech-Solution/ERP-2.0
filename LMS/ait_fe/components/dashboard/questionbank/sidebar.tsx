import Image from "next/image";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/use-user";

const Sidebar = () => {
  const router = useRouter();
  const user = useUser((state) => state.user);
  const dashboardUrl = user ? `/dashboard/${user.id}` : "/dashboard";

  return (
    <div className="w-64 bg-white shadow-md h-full">
      <div className="p-6 text-2xl font-semibold text-red-600">
        <Image
          src="/assets/dashboardpics/logo.png"
          alt="prepdummy"
          className="h-20 w-auto object-contain"
          width={80}
          height={80}
        />
      </div>
      <div className="mt-24 -ml-5 flex space-y-2 flex-col">

        <button
          className="hover:bg-[#F5D5D5] active:bg-[#F5D5D5] px-8 py-6 rounded-r-lg"
          aria-label="More options"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            className="bi bi-three-dots-vertical"
            viewBox="0 0 16 16"
          >
            <path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0" />
          </svg>
        </button>

        <button
          className="hover:bg-[#F5D5D5] active:bg-[#F5D5D5] px-8 py-6 rounded-r-lg"
          aria-label="More options"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            className="bi bi-exclamation-triangle"
            viewBox="0 0 16 16"
          >
            <path d="M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.15.15 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.2.2 0 0 1-.054.06.1.1 0 0 1-.066.017H1.146a.1.1 0 0 1-.066-.017.2.2 0 0 1-.054-.06.18.18 0 0 1 .002-.183L7.884 2.073a.15.15 0 0 1 .054-.057m1.044-.45a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767z" />
            <path d="M7.002 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7.1 5.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
