'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Settings, Home, ChevronDown, Info, BookOpen, Keyboard, BarChart } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import LeftSidebar from './LeftSidebar';  // Adjust path as needed

// Step 1: Add interfaces
interface Label {
  id: number;
  name: string;
  color: string;
}

interface Annotation {
  id: number;
  start: number;
  end: number;
  text: string;
  labelId: number;
  annotator: string; 
}
 
interface Segment {
    start: number;
    end: number;
    text: string;
    annotations: Annotation[];
}


const LABEL_COLORS = {
  Factor_Pro: "#4ade80",
  Factor_Con: "#f87171",
  Reasoning: "#f97316",
  Decision: "#60a5fa",
  Hypothetical: "#eab308",
  Confidence: "#7e22ce",
  Other_Comment: "#14b8a6"
};

const ANNOTATION_GUIDELINES = [
  { key: "Factor_Pro", desc: "Supports the final chosen approach" },
  { key: "Factor_Con", desc: "Argues against/complicates the final approach" },
  { key: "Reasoning", desc: "Explains *why* certain factors lead to the choice" },
  { key: "Decision", desc: "The final statement of what was chosen" },
  { key: "Hypothetical", desc: '"What if" or alternative scenario' },
  { key: "Confidence", desc: "Degree of certainty" },
  { key: "Other_Comment", desc: "Everything else" }
];

const TextAnnotator = () => {
  // Add these interfaces right inside the component if you haven't added them at the top
  interface NewLabel {
    name: string;
    color: string;
  }

  interface ContextMenu {
    visible: boolean;
    x: number;
    y: number;
    annotations: Annotation[];
  }

  // State declarations with proper types
  const [text, setText] = useState<string>("");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<Label | null>(null);
  const [annotatorInitials, setAnnotatorInitials] = useState<string>("");
  const [initialsError, setInitialsError] = useState<boolean>(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ 
    visible: false, 
    x: 0, 
    y: 0, 
    annotations: [] 
  });
  const [historyStack, setHistoryStack] = useState<Annotation[][]>([]);
  const [futureStack, setFutureStack] = useState<Annotation[][]>([]);
  const [showGuidelines, setShowGuidelines] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [projectName, setProjectName] = useState<string>("New Project");
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [labels, setLabels] = useState<Label[]>(
    Object.entries(LABEL_COLORS).map(([name, color], index) => ({
      id: index + 1,
      name,
      color
    }))
  );
  const [newLabel, setNewLabel] = useState<NewLabel>({ 
    name: "", 
    color: "#000000" 
  });

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);

  // Event handlers and utility functions
  const getTextOffset = useCallback((
      container: HTMLElement,
      node: Node,
      offset: number
    ): number => {
      const range = document.createRange();
      range.selectNodeContents(container);
      range.setEnd(node, offset);
      return range.toString().length;
    }, []);
    
    const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      if (!annotatorInitials.trim()) {
        setInitialsError(true);
        return;
      }
      
      const file = event.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => setText(e.target?.result as string);
        reader.readAsText(file);
      }
    }, [annotatorInitials]);
    
    const handleTextSelect = useCallback(() => {
      if (!selectedLabel || !annotatorInitials.trim()) {
        setInitialsError(!annotatorInitials.trim());
        return;
      }
    
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
    
      const range = selection.getRangeAt(0);
      const textContainer = textContainerRef.current;
      if (!textContainer || !textContainer.contains(range.commonAncestorContainer)) return;
    
      let start = getTextOffset(textContainer, range.startContainer, range.startOffset);
      let end = getTextOffset(textContainer, range.endContainer, range.endOffset);
    
      while (start > 0 && /\S/.test(text.charAt(start - 1))) start--;
      while (end < text.length && /\S/.test(text.charAt(end))) end++;
    
      const selectedText = text.slice(start, end);
      if (selectedText && start !== end) {
        const overlapping = annotations.filter(
          ann => start < ann.end && end > ann.start
        );
    
        if (overlapping.length >= 2) {
          alert("Please do not use more than 2 highlights for the same snippet.");
          selection.removeAllRanges();
          return;
        }
    
        setHistoryStack(prev => [...prev, annotations]);
        setFutureStack([]);
    
        const newAnnotation: Annotation = {
          id: Date.now(),
          start,
          end,
          text: selectedText,
          labelId: selectedLabel.id,
          annotator: annotatorInitials
        };
    
        setAnnotations(prev => [...prev, newAnnotation]);
        selection.removeAllRanges();
      }
    }, [selectedLabel, annotatorInitials, text, annotations, getTextOffset]);
    
    const handleUndo = useCallback(() => {
      if (historyStack.length === 0) return;
      const lastState = historyStack[historyStack.length - 1];
      setFutureStack(prev => [...prev, annotations]);
      setAnnotations(lastState);
      setHistoryStack(prev => prev.slice(0, -1));
    }, [historyStack, annotations]);
    
    const handleRedo = useCallback(() => {
      if (futureStack.length === 0) return;
      const nextState = futureStack[futureStack.length - 1];
      setHistoryStack(prev => [...prev, annotations]);
      setAnnotations(nextState);
      setFutureStack(prev => prev.slice(0, -1));
    }, [futureStack, annotations]);
    
    const handleContextMenu = useCallback((
      e: React.MouseEvent,
      annotations: Annotation[]
    ) => {
      e.preventDefault();
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        annotations
      });
    }, []);
    
    const removeAnnotation = useCallback((id: number) => {
      setHistoryStack(prev => [...prev, annotations]);
      setFutureStack([]);
      setAnnotations(prev => prev.filter(ann => ann.id !== id));
      setContextMenu(prev => ({ ...prev, visible: false }));
    }, [annotations]);
    
    const getAnnotatedText = useCallback((): Segment[] => {
      if (!text) return [];
    
      const sorted = [...annotations].sort((a, b) => a.start - b.start || a.end - b.end);
      const boundaries = new Set([0, text.length]);
      sorted.forEach(ann => {
        boundaries.add(ann.start);
        boundaries.add(ann.end);
      });
    
      const segments: Segment[] = [];
      const boundaryArray = Array.from(boundaries).sort((a, b) => a - b);
    
      for (let i = 0; i < boundaryArray.length - 1; i++) {
        const start = boundaryArray[i];
        const end = boundaryArray[i + 1];
        
        const segmentAnnotations = sorted.filter(
          ann => ann.start <= start && ann.end >= end
        );
    
        const segmentText = text.slice(start, end);
        
        segments.push({
          start,
          end,
          text: segmentText,
          annotations: segmentAnnotations
        });
      }
    
      return segments;
    }, [text, annotations]);
    
    // Updated useEffect with TypeScript and proper dependencies
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (/^[1-9]$/.test(event.key)) {
          const index = parseInt(event.key, 10) - 1;
          if (index < labels.length) {
            setSelectedLabel(prev => prev?.id === labels[index].id ? null : labels[index]);
          }
        }
    
        if (event.ctrlKey && event.key === 'z') {
          event.preventDefault();
          handleUndo();
        }
        if (event.ctrlKey && event.key === 'y') {
          event.preventDefault();
          handleRedo();
        }
      };
    
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [labels, handleUndo, handleRedo]);

  // JSX
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Fixed Header */}
      <div className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
        <div className="flex h-16 items-center justify-between px-8">
          <div className="flex items-center space-x-4">
            <Home className="h-6 w-6 text-gray-400" />
            <div className="text-sm text-gray-500">
              <span className="text-gray-900">Annotation</span> / {
                isEditingName ? (
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onBlur={() => setIsEditingName(false)}
                    onKeyPress={(e) => e.key === 'Enter' && setIsEditingName(false)}
                    className="border-b border-gray-300 focus:border-blue-500 outline-none px-1"
                    autoFocus
                  />
                ) : (
                  <span 
                    onClick={() => setIsEditingName(true)}
                    className="cursor-pointer hover:text-blue-500"
                  >
                    {projectName}
                  </span>
                )
              }
            </div>
          </div>
          
          {/* BART Logo */}
          <div className="flex items-center space-x-4">
            <div className="flex flex-col items-end">
              <span className="text-xl font-semibold text-gray-900">BART</span>
              <span className="text-xs text-gray-500">Brachy AI Reasoning Tool</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(prev => !prev)}
            >
              <Settings className="h-5 w-5 text-gray-400" />
            </Button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 shadow-lg rounded-lg p-4 z-50">
            <h3 className="font-medium mb-3">Settings</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Dark Mode</span>
                <Button variant="outline" size="sm">Coming Soon</Button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Auto-save</span>
                <Button variant="outline" size="sm">Every 5 min</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area with Fixed Header Offset */}
      <div className="pt-16 flex-1 overflow-y-auto">
        {/* Content */}
        <div className="mx-auto max-w-7xl px-8 py-8 min-h-[calc(100vh-4rem)] flex flex-col">
          {!text ? (
            /* Initial Upload Section */
            <div className="mb-8">
              <div className="bg-white rounded-lg shadow-sm p-6 max-w-md mx-auto">
                <h2 className="text-lg font-medium mb-4">Before you begin</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Enter your initials
                    </label>
                    <Input
                      type="text"
                      value={annotatorInitials}
                      onChange={(e) => {
                        setAnnotatorInitials(e.target.value.toUpperCase());
                        setInitialsError(false);
                      }}
                      placeholder="Your initials (required)"
                      className={`w-full ${initialsError ? 'border-red-500' : ''}`}
                      maxLength={3}
                    />
                    {initialsError && (
                      <p className="mt-1 text-sm text-red-500">
                        Please enter your initials before proceeding
                      </p>
                    )}
                  </div>
                  
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!annotatorInitials.trim()}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Upload Text File
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Main Grid Layout */
            <div className='grid grid-cols-4 gap-8'>
              {/* Left Sidebar */}
              <div className="col-span-1">
                <LeftSidebar 
                  text={text}
                  annotations={annotations}
                  guidelines={ANNOTATION_GUIDELINES}
                />
              </div>

              {/* Text Area */}
              <div className="col-span-2 flex flex-col">
                <div className="bg-white rounded-lg shadow-sm flex flex-col">

                  {/* Scrollable Text Content */}
                  <div 
                   ref={textContainerRef}
                   className="overflow-y-auto h-[calc(100vh-250px)] p-12"
                   onMouseUp={handleTextSelect}
                   style={{scrollBehavior: 'smooth'}}
                 >
                   <div className="prose max-w-none text-lg leading-relaxed">
                      {getAnnotatedText().map((segment, index) => {
                      // Case 1: No annotations
                      if (segment.annotations.length === 0) {
                        return <span key={index}>{segment.text}</span>;
                      }
                    
                      // Case 2: Single annotation
                      if (segment.annotations.length === 1) {
                        const ann = segment.annotations[0];
                        const label = labels.find(l => l.id === ann.labelId);
                        if (!label) return <span key={index}>{segment.text}</span>;
                    
                        return (
                          <span
                            key={index}
                            style={{ backgroundColor: `${label.color}40` }}
                            className="px-1 rounded cursor-pointer"
                            title={`Annotator: ${ann.annotator}`}
                            onContextMenu={(e) => handleContextMenu(e, segment.annotations)}
                          >
                            {segment.text}
                          </span>
                        );
                      }
                    
                      // Case 3: Multiple annotations
                      const colors = segment.annotations
                        .map(ann => {
                          const label = labels.find(l => l.id === ann.labelId);
                          if (!label) return 'transparent';
                          return `${label.color}40`;
                        })
                        .join(", ");
                    
                      return (
                        <span
                          key={index}
                          style={{ background: `linear-gradient(45deg, ${colors})` }}
                          className="px-1 rounded cursor-pointer"
                          onContextMenu={(e) => handleContextMenu(e, segment.annotations)}
                        >
                          {segment.text}
                        </span>
                      );
                    })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Sidebar - Labels and Tools */}
              <div className="col-span-1 flex flex-col">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-medium mb-6">Labels</h3>

                  {/* Existing Labels */}
                  <div className="space-y-2 mb-8">
                    {labels.map((label, index) => (
                      <Button
                        key={label.id}
                        variant="outline"
                        className={`w-full justify-start transition-all duration-200 ${
                          selectedLabel?.id === label.id 
                            ? 'ring-2 ring-offset-2 shadow-sm' 
                            : 'hover:shadow-sm'
                        }`}
                        style={{
                          borderColor: label.color,
                          color: label.color,
                          backgroundColor: selectedLabel?.id === label.id ? `${label.color}10` : 'transparent'
                        }}
                        onClick={() => setSelectedLabel(prev => prev?.id === label.id ? null : label)}
                      >
                        <div className="flex items-center w-full">
                          <span className="mr-3 text-sm opacity-50">{index + 1}</span>
                          <span className="flex-grow text-left">{label.name}</span>
                          <div 
                            className="w-3 h-3 rounded-full ml-2" 
                            style={{ backgroundColor: label.color }}
                          />
                        </div>
                      </Button>
                    ))}
                  </div>

                  {/* Add New Label Form */}
                  <div className="space-y-4 mb-8">
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={newLabel.color}
                        onChange={(e) => setNewLabel(prev => ({ ...prev, color: e.target.value }))}
                        className="h-8 w-8 rounded cursor-pointer"
                        title="Choose label color"
                      />
                      <Input
                        type="text"
                        placeholder="New label name..."
                        value={newLabel.name}
                        onChange={(e) => setNewLabel(prev => ({ ...prev, name: e.target.value }))}
                        className="flex-grow"
                      />
                    </div>
                    <Button 
                      className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700"
                      variant="ghost"
                      onClick={() => {
                        if (newLabel.name.trim()) {
                          const newLabelEntry = {
                            id: labels.length + 1,
                            name: newLabel.name.trim(),
                            color: newLabel.color
                          };
                          setLabels(prev => [...prev, newLabelEntry]);
                          setNewLabel({ name: "", color: "#000000" });
                        }
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Label
                    </Button>
                  </div>

                  {/* Export Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                      <span>Total Labels: {labels.length}</span>
                      <span>Annotations: {annotations.length}</span>
                    </div>
                    <Button 
                      className="w-full bg-black hover:bg-gray-800 text-white transition-colors"
                      onClick={() => {
                        const exportData = {
                          projectName,
                          text,
                          labels,
                          annotations: annotations.map(ann => ({
                            ...ann,
                            label: labels.find(l => l.id === ann.labelId)?.name
                          })),
                          annotator: annotatorInitials,
                          timestamp: new Date().toISOString()
                        };

                        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `${projectName.toLowerCase().replace(/\s+/g, '-')}-annotations.json`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Export Annotations
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed bg-white rounded-lg shadow-lg py-1 z-50 min-w-[200px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.annotations.map(ann => {
            const label = labels.find(l => l.id === ann.labelId);
            if (!label) return null; // Skip if label not found
            
            return (
              <button
                key={ann.id}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                onClick={() => removeAnnotation(ann.id)}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                <span>Remove {label.name}</span>
              </button>
            );
          })}
          {contextMenu.annotations.length > 1 && (
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 border-t"
              onClick={() => {
                setHistoryStack(prev => [...prev, annotations]);
                setFutureStack([]);
                setAnnotations(prev => 
                  prev.filter(ann => !contextMenu.annotations.find(a => a.id === ann.id))
                );
                setContextMenu(prev => ({ ...prev, visible: false }));
              }}
            >
              Remove All Labels
            </button>
          )}
        </div>
      )}
      
      {/* Click away listeners */}
      {contextMenu.visible && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setContextMenu(prev => ({ ...prev, visible: false }))}
        />
      )}

      {showSettings && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSettings(false)}
        />
      )}

      {/* Hidden file input */}
      <input
        type="file"
        accept=".txt"
        onChange={handleFileUpload}
        ref={fileInputRef}
        className="hidden"
      />
    </div>
  );
};

export default TextAnnotator;