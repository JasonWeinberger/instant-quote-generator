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
    <div className="flex-1 overflow-x-auto pb-2 sm:pb-0">
      <div className="flex space-x-2">
        {INDUSTRIES.map((ind: IndustryOption) => {
          const isSelected = selected === ind.id;
          const isAvailable = !ind.disabled;

          return (
            <button
              key={ind.id}
              onClick={() => isAvailable && onSelect(ind.id)}
              disabled={!isAvailable || disabled}
              className={`
                whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all border
                ${isSelected 
                  ? 'bg-slate-900 text-white border-slate-900' 
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                }
                ${!isAvailable ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'cursor-pointer'}
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