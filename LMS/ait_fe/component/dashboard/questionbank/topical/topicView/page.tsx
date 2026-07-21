"use client"

import MDCAT from "@/assets/MDCATBanner.png";
import { useUser } from "../../../../../../hooks/useUser";
import Image from "next/image";
import { useRouter } from "next/navigation";

const TopicView = () => {
    const router = useRouter()
    const user = useUser((state) => state.user)
    const topics = ["Electrolytes", "Atom and it’s structure", "Organic Chemistry", "In-organic Chemistry", "Chemical Bonding", "Acids and Bases", "Kinetics", "Solutions and Solubility", 'Electrochemistry'];
    return (
        <div className="flex-1 md:p-6 p-4 lg:py-7 py-4 bg-gray-100 md:mr-0 mx-auto">
            {/* <h1 className="md:text-3xl text-xs w-full md:w-auto font-semibold mb-4 md:mb-0 md:pb-9">Welcome Back, {user?.full_name} 👋</h1> */}
            <div>
                <Image src={MDCAT} alt="NMDCAT" className="w-full " />
                <div className="flex items-center justify-center mt-6">
                    <div className="w-full max-w-[1000px] h-[500px] bg-[#D9D9D9] rounded-lg shadow-md p-6 border-2 border-white px-10">
                        <h1><span className="text-red-500 font-bold">Logo </span> NMCAT 2023 &gt; Chemistry</h1>
                        <div className="flex  justify-start flex-col md:flex-row space-x-6">
                            <h1 className="mt-7">Select the topics</h1>
                            <div className="w-full mt-3 max-w-md h-[400px] bg-white rounded-lg shadow-md p-6 border-2 border-white px-10 flex justify-start flex-col space-y-2">
                                {topics.map((topic, index) => (
                                    <div key={index} className="mb-2 flex items-center space-x-2">
                                        <span className="font-bold rounded-full bg-gray-500 text-white p-2 ">{index + 1}.</span>
                                        <button onClick={() => router.push('/dashboard/question-bank/topical/topicview/mode')}>{topic}</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    )
}

export default TopicView
