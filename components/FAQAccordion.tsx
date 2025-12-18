'use client';

import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQAccordionProps {
  items: FAQItem[];
}

export default function FAQAccordion({ items }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="w-full">
      {items.map((item, index) => (
        <div key={index} className="border-b border-gray-200">
          <button
            onClick={() => toggleItem(index)}
            className="flex w-full items-center justify-between py-6 text-left hover:opacity-80 transition-opacity"
          >
            <dt className="text-lg font-semibold leading-7 text-black pr-8 flex-1">
              {item.question}
            </dt>
            <svg
              className={`h-5 w-5 flex-shrink-0 text-[#0088CB] transition-transform ${
                openIndex === index ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {openIndex === index && (
            <dd className="pb-6 pl-0 pr-12 text-base leading-7 text-gray-600">
              {item.answer}
            </dd>
          )}
        </div>
      ))}
    </div>
  );
}

