import React from 'react';
import { Industry, IndustryOption } from '../shared-types';
import { INDUSTRIES } from '../constants';

interface IndustrySelectorProps {
  selected: Industry;
  onSelect: (industry: Industry) => void;
  disabled?: boolean;
}

export const IndustrySelector: React.FC<IndustrySelectorProps> = ({ selected, onSelect, disabled }) => {
  return (
    <div className="w-full overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
      <div className="flex flex-wrap gap-2 sm:gap-3">
        {INDUSTRIES.map((ind: IndustryOption) => {
          const isSelected = selected === ind.id;
          const isAvailable = !ind.disabled;

          return (
            <button
              key={ind.id}
              onClick={() => isAvailable && onSelect(ind.id)}
              disabled={!isAvailable || disabled}
              className={`
                whitespace-nowrap px-5 py-2.5 rounded-xl text-sm font-bold transition-all border shadow-sm
                ${isSelected 
                  ? 'bg-slate-900 text-white border-slate-900 shadow-slate-900/20 transform scale-105' 
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-indigo-100'
                }
                ${!isAvailable ? 'opacity-50 cursor-not-allowed bg-slate-100 shadow-none' : 'cursor-pointer'}
              `}
            >
              {ind.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
