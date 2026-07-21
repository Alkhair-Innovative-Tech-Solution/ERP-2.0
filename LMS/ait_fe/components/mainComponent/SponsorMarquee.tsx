'use client';

import Image from 'next/image';
import Link from 'next/link';

interface Sponsor {
  name: string;
  logo: string;
  website?: string;
}

const sponsors: Sponsor[] = [
  { 
    name: 'TechCorp', 
    logo: "https://idaraalkhair.com/wp-content/uploads/2024/04/idaraalkhair0-black-logo.png",
    website: "https://techcorp.com"
  },
  { 
    name: 'DigitalFirst', 
    logo: "https://idaraalkhair.com/wp-content/uploads/2024/04/idaraalkhair0-black-logo.png",
    website: "https://digitalfirst.com"
  },
  { 
    name: 'FutureWorks', 
    logo: "https://idaraalkhair.com/wp-content/uploads/2024/04/idaraalkhair0-black-logo.png"
  },
  { 
    name: 'InnovateLabs', 
    logo: "https://idaraalkhair.com/wp-content/uploads/2024/04/idaraalkhair0-black-logo.png"
  },
  { 
    name: 'CloudTech', 
    logo: "https://idaraalkhair.com/wp-content/uploads/2024/04/idaraalkhair0-black-logo.png"
  },
];

export default function SponsorMarquee() {
  return (
    <section className="py-16 bg-gradient-to-br from-SeaGrean/10 via-cream to-SeaGrean/10 dark:from-Blue/20 dark:via-Black dark:to-Blue/20 transition-all duration-500">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-4xl font-[400] bg-gradient-to-r from-Black to-SeaGrean dark:from-SeaGrean dark:to-cream bg-clip-text text-transparent">
            Trusted By Industry Leaders
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Partnering with top organizations to deliver excellence in education
          </p>
        </div>

        <div className="relative overflow-hidden py-8">
          {/* Gradient Overlays */}
          <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-cream to-transparent dark:from-Black z-10" />
          <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-cream to-transparent dark:from-Black z-10" />
          
          <div className="flex animate-marquee-infinite gap-12">
            {[...sponsors, ...sponsors].map((sponsor, index) => (
              <div key={`${sponsor.name}-${index}`} className="flex-none">
                {sponsor.website ? (
                  <Link href={sponsor.website} target="_blank" rel="noopener noreferrer">
                    <div className="w-40 h-40 relative group p-4 rounded-xl 
                      bg-white/50 dark:bg-Blue/30 backdrop-blur-sm
                      hover:bg-SeaGrean/5 dark:hover:bg-Orange/5 
                      transition-all duration-300 transform hover:scale-105
                      border border-SeaGrean/10 dark:border-Orange/10
                      hover:border-SeaGrean dark:hover:border-Orange">
                      <Image
                        src={sponsor.logo}
                        alt={sponsor.name}
                        fill
                        className="object-contain p-2 filter dark:invert"
                      />
                    </div>
                  </Link>
                ) : (
                  <div className="w-40 h-40 relative group p-4 rounded-xl 
                    bg-white/50 dark:bg-Blue/30 backdrop-blur-sm
                    hover:bg-SeaGrean/5 dark:hover:bg-Orange/5 
                    transition-all duration-300 transform hover:scale-105
                    border border-SeaGrean/10 dark:border-Orange/10
                    hover:border-SeaGrean dark:hover:border-Orange">
                    <Image
                      src={sponsor.logo}
                      alt={sponsor.name}
                      fill
                      className="object-contain p-2 filter dark:invert"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
