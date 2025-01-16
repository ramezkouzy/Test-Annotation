// components/LeftSidebar.tsx
import React, { useState } from 'react';
import { ChevronDown, Info, BookOpen, Keyboard, BarChart } from 'lucide-react';

interface Guideline {
  key: string;
  desc: string;
}

interface LeftSidebarProps {
  text?: string;
  annotations?: any[];
  guidelines?: Guideline[];
}

interface SectionState {
  guidelines: boolean;
  shortcuts: boolean;
  stats: boolean;
}

const DEFAULT_GUIDELINES = [
  { key: "Factor_Pro", desc: "Supports the final chosen approach" },
  { key: "Factor_Con", desc: "Argues against/complicates the final approach" },
  { key: "Reasoning", desc: "Explains *why* certain factors lead to the choice" },
  { key: "Decision", desc: "The final statement of what was chosen" },
  { key: "Hypothetical", desc: '"What if" or alternative scenario' },
  { key: "Confidence", desc: "Degree of certainty" },
  { key: "Other_Comment", desc: "Everything else" }
];

const DEFAULT_SHORTCUTS = [
  { key: '1-9', desc: 'Select label' },
  { key: 'Right Click', desc: 'Remove annotation' },
  { key: 'Ctrl+Z', desc: 'Undo' },
  { key: 'Ctrl+Y', desc: 'Redo' }
];

const LeftSidebar: React.FC<LeftSidebarProps> = ({ 
  text = '', 
  annotations = [], 
  guidelines = DEFAULT_GUIDELINES 
}) => {
  const [openSections, setOpenSections] = useState<SectionState>({
    guidelines: true,
    shortcuts: true,
    stats: true
  });

  const toggleSection = (section: keyof SectionState) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  interface SidebarSectionProps {
    title: string;
    icon: React.ElementType;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
  }

  const SidebarSection: React.FC<SidebarSectionProps> = ({ 
    title, 
    icon: Icon, 
    isOpen, 
    onToggle, 
    children 
  }) => (
    <div className="border-b border-gray-200 last:border-0">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Icon className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        </div>
        <ChevronDown 
          className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
            isOpen ? 'transform rotate-180' : ''
          }`}
        />
      </button>
      <div 
        className={`px-4 overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-96 pb-4' : 'max-h-0'
        }`}
      >
        {children}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Guidelines Section */}
      <SidebarSection 
        title="Guidelines" 
        icon={BookOpen}
        isOpen={openSections.guidelines}
        onToggle={() => toggleSection('guidelines')}
      >
        <div className="space-y-3 text-sm text-gray-600">
          <a 
            href="https://thoracic-verse-eca.notion.site/Annotation-Guideline-17b17fd39cab805caed7cc9900ffcf61?pvs=4"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800"
          >
            <Info className="h-3 w-3" />
            <span>View Full Guidelines</span>
          </a>
          <div className="space-y-2">
            {guidelines.map((guideline, index) => (
              <div key={index} className="group">
                <div className="font-medium text-gray-900">{guideline.key}</div>
                <div className="text-xs text-gray-500 group-hover:text-gray-700">
                  {guideline.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SidebarSection>

      {/* Shortcuts Section */}
      <SidebarSection 
        title="Keyboard Shortcuts" 
        icon={Keyboard}
        isOpen={openSections.shortcuts}
        onToggle={() => toggleSection('shortcuts')}
      >
        <div className="space-y-2">
          {DEFAULT_SHORTCUTS.map((shortcut, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                {shortcut.key}
              </kbd>
              <span className="text-gray-600">{shortcut.desc}</span>
            </div>
          ))}
        </div>
      </SidebarSection>

      {/* Statistics Section */}
      <SidebarSection 
        title="Statistics" 
        icon={BarChart}
        isOpen={openSections.stats}
        onToggle={() => toggleSection('stats')}
      >
        <div className="space-y-2">
          {[
            { label: 'Total Annotations', value: annotations.length },
            { label: 'Characters', value: text.length },
            { label: 'Words', value: text?.trim().split(/\s+/).length || 0 }
          ].map((stat, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span className="text-gray-600">{stat.label}</span>
              <span className="font-medium text-gray-900">{stat.value}</span>
            </div>
          ))}
        </div>
      </SidebarSection>
    </div>
  );
};

export default LeftSidebar;