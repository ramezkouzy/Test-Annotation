'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Settings, Home, ChevronDown, Info, BookOpen, Keyboard, BarChart, Link2, ChevronRight, X, FileText } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import LeftSidebar from './LeftSidebar';  // Adjust path as needed
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

interface Relation {
  id: number;
  sourceId: number;
  targetId: number;
  type: string;
  value: string;  // Add this line for storing "supports"/"limits" or applicator types
}

interface Metadata {
  id: number;
  annotationId: number;
  key: string;
  value: string;
}

interface AnnotationWithRelations extends Annotation {
  relations?: Relation[];
  metadata?: Metadata[];
}

interface RelationType {
  type: 'applicator' | 'decision';
  value: string;
}

interface HistoryState {
  annotations: Annotation[];
  relations: Relation[];
}

const RELATION_OPTIONS = {
  applicator: ['T&O', 'IS', 'Hybrid'],
  factor: ['supports', 'limits'],
  decision: ['supports', 'limits']
};

const LABEL_COLORS = {
  Factor: "#4ade80",  // Changed from Factor_Pro and removed Factor_Con
  Reasoning: "#f97316",
  Decision: "#60a5fa",
  Hypothetical: "#eab308",
  Confidence: "#7e22ce",
  Other_Comment: "#14b8a6"
};

const ANNOTATION_GUIDELINES = [
  { 
    key: "Factor", 
    desc: "A key element that influences the decision. Use relationships (supports/limits) to indicate how this factor affects the decision" 
  },
  { 
    key: "Reasoning", 
    desc: "Explains *why* certain factors lead to the choice" 
  },
  { 
    key: "Decision", 
    desc: "The final statement of what was chosen" 
  },
  { 
    key: "Hypothetical", 
    desc: '"What if" or alternative scenario' 
  },
  { 
    key: "Confidence", 
    desc: "Degree of certainty" 
  },
  { 
    key: "Other_Comment", 
    desc: "Everything else" 
  }
];

// You might also want to add relationship guidelines:
const RELATIONSHIP_GUIDELINES = [
  {
    key: "supports",
    desc: "The factor positively influences or supports the decision"
  },
  {
    key: "limits",
    desc: "The factor negatively influences or complicates the decision"
  },
  {
    key: "applicator",
    desc: "Links a factor to a specific applicator choice (T&O, IS, or Hybrid)"
  }
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
  const [historyStack, setHistoryStack] = useState<HistoryState[]>([]);
  const [futureStack, setFutureStack] = useState<HistoryState[]>([]);
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
  const [relations, setRelations] = useState<Relation[]>([]);
  const [metadata, setMetadata] = useState<Metadata[]>([]);
  const [showRelationModal, setShowRelationModal] = useState(false);
  const [selectedAnnotationForRelation, setSelectedAnnotationForRelation] = useState<number | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [relationType, setRelationType] = useState<'supports' | 'limits' | null>(null);
  const [showAllRelations, setShowAllRelations] = useState(false);

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
    
        setHistoryStack(prev => [...prev, { annotations, relations }]);
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
      setFutureStack(prev => [...prev, { annotations, relations }]);
      setAnnotations(lastState.annotations);
      setRelations(lastState.relations);
      setHistoryStack(prev => prev.slice(0, -1));
    }, [historyStack, annotations, relations]);
    
    const handleRedo = useCallback(() => {
      if (futureStack.length === 0) return;
      const nextState = futureStack[futureStack.length - 1];
      setHistoryStack(prev => [...prev, { annotations, relations }]);
      setAnnotations(nextState.annotations);
      setRelations(nextState.relations);
      setFutureStack(prev => prev.slice(0, -1));
    }, [futureStack, annotations, relations]);
    
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
      setHistoryStack(prev => [...prev, { annotations, relations }]);
      setFutureStack([]);
      setAnnotations(prev => prev.filter(ann => ann.id !== id));
      setContextMenu(prev => ({ ...prev, visible: false }));
    }, [annotations, relations]);
    
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
    
    const handleAddRelation = (annotationId: number) => {
      setSelectedAnnotationForRelation(annotationId);
      setShowRelationModal(true);
    };
    
    const handleAddMetadata = (annotationId: number) => {
      const key = prompt("Enter metadata key:");
      const value = prompt("Enter metadata value:");
      
      if (key && value) {
        const newMetadata: Metadata = {
          id: Date.now(),
          annotationId,
          key,
          value
        };
        setMetadata(prev => [...prev, newMetadata]);
      }
    };
    
    const getAnnotationRelations = (annotationId: number) => {
      return relations.filter(r => 
        r.sourceId === annotationId || r.targetId === annotationId
      );
    };
    
    const handleRemoveRelation = (relationId: number) => {
      setHistoryStack(prev => [...prev, { annotations, relations }]);
      setRelations(prev => prev.filter(r => r.id !== relationId));
    };
    
    const handleRemoveMetadata = (metadataId: number) => {
      setMetadata(prev => prev.filter(m => m.id !== metadataId));
    };

    const RelationModal = () => {
      const [linkMode, setLinkMode] = useState<'applicator' | 'text'>('applicator');
      const [applicatorValue, setApplicatorValue] = useState('');
      const [targetAnnotation, setTargetAnnotation] = useState<number | null>(null);
    
      const handleCreateRelation = () => {
        if (!selectedAnnotationForRelation || !relationType) return;
    
        const newRelation: Relation = {
          id: Date.now(),
          sourceId: selectedAnnotationForRelation,
          targetId: targetAnnotation || 0,
          type: linkMode === 'applicator' ? 'applicator' : relationType,
          value: linkMode === 'applicator' ? applicatorValue : relationType
        };
    
        setHistoryStack(prev => [...prev, { annotations, relations }]);
        setRelations(prev => [...prev, newRelation]);
        setShowRelationModal(false);
        setLinkMode('applicator');
        setApplicatorValue('');
        setTargetAnnotation(null);
        setRelationType(null);
      };
    
      return (
        <Dialog open={showRelationModal} onOpenChange={setShowRelationModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create {relationType === 'supports' ? 'Supporting' : 'Limiting'} Relation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Link Type</label>
                <div className="flex space-x-2">
                  <Button
                    variant={linkMode === 'applicator' ? 'default' : 'outline'}
                    onClick={() => setLinkMode('applicator')}
                    className="flex-1"
                  >
                    Applicator Choice
                  </Button>
                  <Button
                    variant={linkMode === 'text' ? 'default' : 'outline'}
                    onClick={() => setLinkMode('text')}
                    className="flex-1"
                  >
                    Link to Text
                  </Button>
                </div>
              </div>
    
              {linkMode === 'applicator' ? (
                <div>
                  <label className="block text-sm font-medium mb-1">Applicator Type</label>
                  <select
                    value={applicatorValue}
                    onChange={(e) => setApplicatorValue(e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">Select applicator</option>
                    {RELATION_OPTIONS.applicator.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">Select Text to Link</label>
                  <select
                    value={targetAnnotation || ""}
                    onChange={(e) => setTargetAnnotation(Number(e.target.value))}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">Select annotation</option>
                    {annotations
                      .filter(a => a.id !== selectedAnnotationForRelation)
                      .map(a => {
                        const label = labels.find(l => l.id === a.labelId);
                        return (
                          <option key={a.id} value={a.id}>
                            {`${label?.name || 'Unknown'}: ${a.text.slice(0, 30)}...`}
                          </option>
                        );
                      })}
                  </select>
                </div>
              )}
              
              <Button 
                onClick={handleCreateRelation}
                className="w-full bg-black text-white hover:bg-gray-800"
                disabled={!((linkMode === 'applicator' && applicatorValue) || 
                          (linkMode === 'text' && targetAnnotation))}
              >
                Create Relation
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      );
    };

    const handleDecisionRelation = (annotationId: number | undefined) => {
      if (annotationId) {
        setSelectedAnnotationForRelation(annotationId);
        setShowRelationModal(true);
      }
    };

    const handleSupportsRelation = (annotationId: number) => {
      setSelectedAnnotationForRelation(annotationId);
      setRelationType('supports');
      setShowRelationModal(true);
    };
    
    const handleLimitsRelation = (annotationId: number) => {
      setSelectedAnnotationForRelation(annotationId);
      setRelationType('limits');
      setShowRelationModal(true);
    };

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
            <div className='grid grid-cols-8 gap-4'>
              {/* Left Sidebar */}
              <div className="col-span-2">
                <LeftSidebar 
                  text={text}
                  annotations={annotations}
                  guidelines={ANNOTATION_GUIDELINES}
                />
              </div>

              {/* Text Area */}
              {/* Text Area */}
              <div className="col-span-4 flex flex-col h-[calc(100vh-12rem)]">
                <div className="bg-white rounded-lg shadow-sm flex-1 flex flex-col overflow-hidden">
                  {/* Scrollable Text Content */}
                  <div 
                    ref={textContainerRef}
                    className="flex-1 p-12 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 transition-colors"
                    onMouseUp={handleTextSelect}
                    style={{
                      scrollBehavior: 'smooth',
                      overflowY: 'auto'
                    }}
                  >
                    <div className="prose max-w-none text-sm leading-relaxed">
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

                          const relations = getAnnotationRelations(ann.id);
                          const relationExists = relations.length > 0;

                          // Placeholder logic for determining dot color based on relation types
                          let dotColorClass = "text-red-500"; 
                          if (relationExists) {
                            // Example: if any relation type is "supports", change color.
                            if (relations.some(r => r.value === "supports")) {
                              dotColorClass = "text-green-500";
                            }
                            // Add more conditions for different colors as needed.
                          }

                          return (
                            <span 
                              key={index} 
                              className="relative group inline"  
                              title={`Annotator: ${ann.annotator}`}
                              onContextMenu={(e) => handleContextMenu(e, segment.annotations)}
                              style={{ backgroundColor: `${label.color}40` }}
                            >
                              <span className="px-1 rounded cursor-pointer">
                                {segment.text}
                                <div className="absolute hidden group-hover:flex space-x-2 -top-6 right-0">
                                  <button
                                    onClick={() => handleAddMetadata(ann.id)}
                                    className="p-1 rounded bg-black shadow-md hover:shadow-lg hover:bg-gray-800 transition-all duration-200"
                                    title="Add metadata"
                                  >
                                    <Plus className="h-4 w-4 text-white" />
                                  </button>
                                  <button
                                    onClick={() => handleSupportsRelation(ann.id)}
                                    className="p-1 rounded bg-black shadow-md hover:shadow-lg hover:bg-gray-800 transition-all duration-200"
                                    title="Add supports relation"
                                  >
                                    <Link2 className="h-4 w-4 text-green-400" />
                                  </button>
                                  <button
                                    onClick={() => handleLimitsRelation(ann.id)}
                                    className="p-1 rounded bg-black shadow-md hover:shadow-lg hover:bg-gray-800 transition-all duration-200"
                                    title="Add limits relation"
                                  >
                                    <Link2 className="h-4 w-4 text-red-400" />
                                  </button>
                                </div>
                              </span>

                              {/* Corner badge for relation indicator at top-right */}
                              {relationExists && (
                                <span 
                                  className={`absolute top-0 right-0 pointer-events-none text-[0.6em] ${dotColorClass}`}
                                  title={`${relations.length} relation(s)`}
                                >
                                  ●
                                </span>
                              )}
                            </span>
                          );
                        }

                        // Case 3: Multiple annotations
                        const colors = segment.annotations
                          .map(ann => {
                            const label = labels.find(l => l.id === ann.labelId);
                            return label ? `${label.color}40` : 'transparent';
                          })
                          .join(", ");

                        return (
                          <span 
                            key={index} 
                            className="relative group inline" 
                            onContextMenu={(e) => handleContextMenu(e, segment.annotations)}
                          >
                            <span
                              style={{ background: `linear-gradient(45deg, ${colors})` }}
                              className="px-1 rounded cursor-pointer"
                            >
                              {segment.text}
                              <div className="absolute hidden group-hover:flex space-x-2 -top-6 right-0">
                                <button
                                  onClick={() => handleAddMetadata(segment.annotations[0].id)}
                                  className="p-1 rounded bg-black shadow-md hover:shadow-lg hover:bg-gray-800 transition-all duration-200"
                                  title="Add metadata"
                                >
                                  <Plus className="h-4 w-4 text-white" />
                                </button>
                                <button
                                  onClick={() => handleSupportsRelation(segment.annotations[0].id)}
                                  className="p-1 rounded bg-black shadow-md hover:shadow-lg hover:bg-gray-800 transition-all duration-200"
                                  title="Add supports relation"
                                >
                                  <Link2 className="h-4 w-4 text-green-400" />
                                </button>
                                <button
                                  onClick={() => handleLimitsRelation(segment.annotations[0].id)}
                                  className="p-1 rounded bg-black shadow-md hover:shadow-lg hover:bg-gray-800 transition-all duration-200"
                                  title="Add limits relation"
                                >
                                  <Link2 className="h-4 w-4 text-red-400" />
                                </button>
                              </div>
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Sidebar - Labels and Tools */}
              <div className="col-span-2 flex flex-col">
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

                 {/* Relations Panel */}
                  <div className="border-t pt-6 mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium">Relations ({relations.length})</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllRelations(prev => !prev)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <ChevronDown 
                          className={`h-5 w-5 transform transition-transform ${showAllRelations ? 'rotate-180' : ''}`}
                        />
                      </Button>
                    </div>

                    {/* Active Relations List */}
                    <div className="space-y-3">
                      {(showAllRelations ? relations : relations.slice(-1)).map(relation => {
                        const sourceAnnotation = annotations.find(a => a.id === relation.sourceId);
                        const targetAnnotation = annotations.find(a => a.id === relation.targetId);
                        const sourceLabel = labels.find(l => l.id === sourceAnnotation?.labelId);
                        
                        return (
                          <div key={relation.id} className="flex flex-col space-y-2 group hover:bg-gray-50 p-2 rounded-lg">
                            {/* Source annotation */}
                            <div className="flex items-center space-x-2">
                              <div 
                                className="w-4 h-4 rounded-sm"
                                style={{ backgroundColor: sourceLabel?.color + '20', borderColor: sourceLabel?.color }}
                              >
                                <FileText className="h-3 w-3" style={{ color: sourceLabel?.color }} />
                              </div>
                              <span className="text-sm truncate flex-1">
                                {sourceAnnotation?.text.slice(0, 30)}
                              </span>
                            </div>

                            {/* Arrow and relation type */}
                            <div className="flex items-center pl-6 space-x-2">
                              <div className="h-6 w-px bg-gray-300"></div>
                              <span className="text-xs text-gray-500">{relation.type} → {relation.value}</span>
                            </div>

                            {/* Target annotation or value */}
                            <div className="flex items-center pl-6 space-x-2 justify-between">
                              <div className="flex items-center space-x-2 flex-1">
                                {relation.type === 'applicator' ? (
                                  <span className="text-sm text-gray-600">{relation.value}</span>
                                ) : (
                                  <>
                                    <div className="w-4 h-4 rounded-sm bg-gray-100 border border-gray-300">
                                      <FileText className="h-3 w-3 text-gray-400" />
                                    </div>
                                    <span className="text-sm truncate flex-1">
                                      {targetAnnotation?.text.slice(0, 30)}
                                    </span>
                                  </>
                                )}
                              </div>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveRelation(relation.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
                        // Extract case summary from text based on common patterns
                        const getCaseSummary = () => {
                          const ageMatcher = text.match(/(\d+)[-\s]year[-\s]old/);
                          const tumorSizeMatcher = text.match(/(\d+)[-\s]centimeter/);
                          
                          return {
                            patient_age: ageMatcher ? parseInt(ageMatcher[1]) : null,
                            tumor_size: tumorSizeMatcher ? `${tumorSizeMatcher[1]}cm` : null,
                            previous_treatment: text.includes("EBRT") ? "EBRT" : null,
                            response: text.includes("partial response") ? "partial" : null
                          };
                        };
                      
                        // Get surrounding context for a piece of text
                        const getContext = (annotation?: Annotation | null) => {
                          if (!annotation) return '';
                          const contextWindow = 100; // characters before and after
                          const start = Math.max(0, annotation.start - contextWindow);
                          const end = Math.min(text.length, annotation.end + contextWindow);
                          return text.slice(start, end).trim();
                        };
                      
                        // Build decision chains from annotations and relations
                        const buildDecisionChains = () => {
                          // Find all Decision type annotations
                          const decisions = annotations.filter(ann => 
                            labels.find(l => l.id === ann.labelId)?.name === "Decision"
                          );
                      
                          return decisions.map(decision => {
                            // Find all relations connected to this decision
                            const decisionRelations = relations.filter(r => 
                              r.sourceId === decision.id || r.targetId === decision.id
                            );
                      
                            // Find supporting and limiting factors
                            const supportingFactors = annotations.filter(ann => 
                              decisionRelations.some(r => 
                                (r.sourceId === ann.id || r.targetId === ann.id) && 
                                r.value === "supports"
                              )
                            );
                      
                            const limitingFactors = annotations.filter(ann => 
                              decisionRelations.some(r => 
                                (r.sourceId === ann.id || r.targetId === ann.id) && 
                                r.value === "limits"
                              )
                            );
                      
                            return {
                              decision_text: decision.text,
                              context: getContext(decision),
                              supporting_factors: supportingFactors.map(f => ({
                                text: f.text,
                                context: getContext(f),
                                type: labels.find(l => l.id === f.labelId)?.name
                              })),
                              limiting_factors: limitingFactors.map(f => ({
                                text: f.text,
                                context: getContext(f),
                                type: labels.find(l => l.id === f.labelId)?.name
                              })),
                              applicator_choices: relations
                                .filter(r => r.type === "applicator" && 
                                  (r.sourceId === decision.id || r.targetId === decision.id))
                                .map(r => ({
                                  type: r.type,
                                  value: r.value,
                                  rationale: getContext(decision)
                                }))
                            };
                          });
                        };
                      
                        const exportData = {
                          metadata: {
                            projectName,
                            annotator: annotatorInitials,
                            timestamp: new Date().toISOString()
                          },
                          annotations: annotations.map(ann => {
                            const annotationRelations = relations
                              .filter(r => r.sourceId === ann.id || r.targetId === ann.id)
                              .map(r => ({
                                type: r.type,
                                value: r.value,
                                // Only include explicitly connected annotations
                                connected_annotation: r.type !== 'applicator' ? {
                                  text: annotations.find(a => 
                                    a.id === (r.sourceId === ann.id ? r.targetId : r.sourceId)
                                  )?.text || '',
                                  type: labels.find(l => l.id === annotations.find(a => 
                                    a.id === (r.sourceId === ann.id ? r.targetId : r.sourceId)
                                  )?.labelId)?.name
                                } : null
                              }));
                        
                            return {
                              id: ann.id,
                              text: ann.text,
                              type: labels.find(l => l.id === ann.labelId)?.name,
                              relations: annotationRelations
                            };
                          })
                        };
                        
                        // Create and download the file
                        const blob = new Blob([JSON.stringify(exportData, null, 2)], 
                          { type: 'application/json' });
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
                setHistoryStack(prev => [...prev, { annotations, relations }]);
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
      <RelationModal />
    </div>
  );
};

export default TextAnnotator;