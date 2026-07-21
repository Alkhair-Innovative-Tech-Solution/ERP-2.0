"use client";

import { useUser } from "../../../../hooks/useUser";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import useHandleLogout from "../../../lib/logout";

const QuestionBankCard = ({
  id,
  title,
  description,
  categoryName,
  duration,
  btnText,
  imageUrl,
  router,
}: {
  id: string;
  title: string;
  description: string;
  categoryName: string;
  btnText: string;
  duration: number;
  imageUrl: string;
  router: any;
}) => {

  const handlePushLogic = (questionBankId: string, duration: number) => {
    localStorage.setItem("test-duration", JSON.stringify(duration));
    localStorage.setItem("question-bank-id", JSON.stringify(questionBankId));
    router.push("/dashboard/question-bank/solve");
  };

  return (
    <div className="p-4 bg-white shadow-md rounded-lg max-h-[400px] h-[400px] flex flex-col">
      <div className="w-full aspect-[3/1] relative rounded-md overflow-hidden">
        <Image
          src={imageUrl}
          alt={title ?? 'Question Bank Image'}
          fill
          className="object-contain"
          quality={100}
          sizes="(max-width: 640px) 100vw, 400px"
        />
      </div>
      <div className="mr-2 ml-2">

        <h3 className="mt-2 text-lg md:text-xl font-bold truncate">{title}</h3>
        <h4 className="mt-2 text-md text-gray-400">Category: {categoryName}</h4>
        <p className="text-sm md:text-md mt-2 text-gray-500 overflow-y-auto max-h-[80px] md:max-h-[100px]">
          {description}
        </p>
        <div className="mt-2 flex flex-col justify-center w-full mt-auto">
          <button
            className="mt-2 bg-orange-500 text-white px-4 py-2 rounded-2xl flex items-center justify-center space-x-2"
            onClick={() => handlePushLogic(id, duration)}
          >
            <span>{btnText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default function QuestionBanks() {
  const user = useUser((state) => state.user);
  const [data, setData] = useState<any[]>([]);
  const [status, setStatus] = useState<number>(0);
  const handleLogout = useHandleLogout();
  const router = useRouter();

  useEffect(() => {
    const getDashboardQuestionBank = async () => {
      try {
        const res = await fetch("/backend/api/getDashboardMyQuestionBanks", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (res.ok) {
          setData(data?.question_bank_data);
          setStatus(data?.status);
        } else {
          setStatus(res.status);
        }
      } catch (error) {
        console.error("Error fetching Question Bank:", error);
        setStatus(500);
      }
    };
    getDashboardQuestionBank();
  }, []);

  useEffect(() => {
    if (status === 401 && user) {
      handleLogout();
    }
  }, [status, user, handleLogout]);

  return (
    <div className="flex-1 md:p-6 p-4 lg:py-7 py-4 bg-gray-100 md:mr-0 mx-auto">
      <h1 className="md:text-3xl text-xs w-full md:w-auto font-semibold mb-4 md:mb-0 md:pb-9">
        Give these a shot, {user?.full_name} 👋
      </h1>
      {data && data.length > 0 ? (
        <div className="grid md:grid-cols-2 grid-cols-1 gap-4">
          {data.map((qb) => (
            <QuestionBankCard
              key={qb?.id}
              id={qb?.id}
              title={qb?.name}
              description={qb.description}
              categoryName={qb?.category?.name}
              duration={qb.duration}
              btnText="Solve"
              imageUrl={qb?.image ? `${process.env.NEXT_PUBLIC_API_URL}${qb?.image}` : `${process.env.NEXT_PUBLIC_API_URL}/uploads/images/1.jpg`}
              router={router}
            />
          ))}
        </div>
      ) : (
        <p>You haven&apos;t bought any Question Banks yet.</p>
      )}
    </div>
  );
}
