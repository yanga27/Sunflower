import React, { useState, useCallback, useEffect, useRef  } from "react";
import { BlockData, checkForErrors, evaluateBlock, setInputCountOfBlock, stepBlock } from "./BlockUtil";
import './Block.css';
import { Toolbar } from "./Toolbar";
import { BlockSave, deserializeBlock, serializeBlock } from "./BlockSave";
import { useBlockEditor } from "./BlockEditorContext";
import { BlockSlotDisplay } from "./BlockSlot";
import { BlockPalette } from "./BlockPalette";
import { removeBlockById } from "./BlockUtil";


export interface EditorSaveState {
  fileType: string;
  rootBlock?: BlockSave;
  inputs: number[];
  inputCount: number;
  customBlocks: Record<string, BlockSave>;
}

export const CURRENT_FILETYPE_VERSION = "BRAM_EDITOR_STATE_V2";

export const DEFAULT_INPUT_COUNT = 2;

export const customBlocks: Record<string, BlockSave> = {};

// JSX element that represents the editor, containing a root block and the header.
export function BlockEditor() {
  const { inputCount, setInputCount, rootBlock, setRootBlock, customBlockCount: _customBlockCount, setCustomBlockCount } = useBlockEditor();
  const [inputs, setInputs] = useState<number[]>(new Array(inputCount > 0 ? inputCount : 0).fill(0));
  const [highlightedBlockId, setHighlightedBlockId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const [currentResult, setCurrentResult] = useState<number | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationSpeed, setEvaluationSpeed] = useState<number>(2);
  const [paused, setPaused] = useState(false);
  const loadInputRef = useRef<HTMLInputElement>(null);
  const pauseResolver = useRef<((value: void | PromiseLike<void>) => void) | null>(null);
  const isHaltedRef = useRef(false);
  const pauseAtNextStepRef = useRef(false);
  const breakpointsRef = useRef<Set<string>>(new Set());
  const ignoreBreakpointsRef = useRef(false);

  // Every time the root block changes, rebuild the set of breakpoints (this keeps it dynamic)
  useEffect(() => {
    const newBreakpoints = new Set<string>();
    const traverse = (b: BlockData) => {
      if (b.hasBreakpoint) {
        newBreakpoints.add(b.id);
      }
      for (const slot of b.children) {
        if (slot.block) {
          traverse(slot.block);
        }
      }
    };
    if (rootBlock) {
      traverse(rootBlock);
    }
    breakpointsRef.current = newBreakpoints;
  }, [rootBlock]);

  React.useEffect(() => {//This updates the root block when the number of inputs changes
    if (!rootBlock) return;
    if (isNaN(inputCount)) return;
    // Avoid mutating the existing rootBlock in-place; clone then update so React sees the change.
    if (rootBlock.inputCount === inputCount) return; // no-op if already up-to-date

    const clone = (typeof structuredClone === 'function')
      ? structuredClone(rootBlock)
      : JSON.parse(JSON.stringify(rootBlock));

    setInputCountOfBlock(clone, inputCount > 0 ? inputCount : 0);
    checkForErrors(clone);
    setRootBlock(clone);
  }, [rootBlock, inputCount, setRootBlock]);

  useEffect(() => {
    setInputs((prevInputs) => {
      const newInputs = Array.from({ length: inputCount > 0 ? inputCount : 0 }, (_, i) => prevInputs[i] ?? 0);
      return newInputs;
    });

    // If rootBlock exists, keep it updated too
    if (rootBlock) {
      setInputCountOfBlock(rootBlock, inputCount > 0 ? inputCount : 0);
    }
  }, [inputCount, rootBlock]);

  const handleInputCountChange = (count: number) => {
    const clamped = Math.max(0, count);
    setInputCount(clamped);
  };

  const handleInputChange = (index: number, value: number) => {
    const updated = [...inputs];
    updated[index] = value;
    setInputs(updated);
  };

  const handleSave = useCallback(() => {
    createSaveFile(rootBlock ? serializeBlock(rootBlock) : undefined, inputs, inputCount > 0 ? inputCount : 0);
  }, [rootBlock, inputs, inputCount]);

  const handleDeleteSelectedBlock = useCallback(() => {
    if (!rootBlock || !selectedBlockId) return;

    if (rootBlock.id === selectedBlockId) {
      setRootBlock(null);
      setSelectedBlockId(null);
      setHighlightedBlockId(null);
      return;
    }

    const newRoot = removeBlockById(rootBlock, selectedBlockId);
    checkForErrors(newRoot);
    setRootBlock(newRoot);
    setSelectedBlockId(null);
    setHighlightedBlockId(null);
  }, [rootBlock, selectedBlockId]);


  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const ctrl = isMac ? e.metaKey : e.ctrlKey;

      // Ignore typing in inputs
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) return;

      // Delete block --> Backspace or Delete
      if ((e.key === "Backspace" || e.key === "Delete") && selectedBlockId) {
        e.preventDefault();
        handleDeleteSelectedBlock();
      }

      // Save --> Ctrl+Shift+S
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }

      // Load --> Ctrl+O
      if (ctrl && e.key.toLowerCase() === "o") {
        e.preventDefault();
        loadInputRef.current?.click();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, selectedBlockId, handleDeleteSelectedBlock]); 

  function createSaveFile(rootBlock: BlockSave | undefined, inputs: number[], inputCount: number) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}${month}${day}-${hours}${minutes}${seconds}`;
    const filename = `${timestamp}.bramflower`;

    const stateToSave: EditorSaveState = {
      fileType: CURRENT_FILETYPE_VERSION,
      rootBlock,
      inputs,
      inputCount,
      customBlocks
    };

    try {
      const stateString = JSON.stringify(stateToSave, null, 2);
      const blob = new Blob([stateString], { type: 'application/octet-stream' });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(link.href);
      console.log("State saved successfully as:", filename);
    } catch (error) {
      console.error("Failed to save state:", error);
      alert(`Error saving file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const handleLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        try {
          const loadedState: EditorSaveState = JSON.parse(content);
          if (typeof loadedState !== 'object' || loadedState === null ||
              loadedState.fileType !== CURRENT_FILETYPE_VERSION || 
              !Array.isArray(loadedState.inputs) ||
              typeof loadedState.inputCount !== 'number') {
             throw new Error("Invalid or incompatible .bramflower file.");
          }

          setRootBlock(loadedState.rootBlock ? deserializeBlock(loadedState.rootBlock) : null);
          setInputs(loadedState.inputs);
          setInputCount(loadedState.inputCount);

          setCustomBlockCount(Object.keys(customBlocks).length);
          for (const [name, customBlock] of Object.entries(loadedState.customBlocks)) {
            customBlocks[customBlock.name ?? name] = customBlock;
          }

          console.log("State loaded successfully.");
        } catch (error) {
          console.error("Failed to load or parse state file:", error);
          alert(`Error loading file: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    };

    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      alert("Error reading file.");
    };

    reader.readAsText(file);
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleHalt = () => {
    isHaltedRef.current = true;
    pauseAtNextStepRef.current = false;
    
    // resolve any pending pause so execution can proceed to throw "halted"
    if (pauseResolver.current) {
      pauseResolver.current();
      pauseResolver.current = null;
    }
    setPaused(false);
  };
  
  const handleResume = () => {
    if (pauseResolver.current) {
      pauseResolver.current();
      pauseResolver.current = null;
      setPaused(false);
    }
  };
  
  const handleStep = async () => {
    if (isEvaluating) {
        if (paused) {
            pauseAtNextStepRef.current = true;
            handleResume();
        } else {
             // already running, so pause?
             pauseAtNextStepRef.current = true; 
        }
    } else {
        // start new session
        pauseAtNextStepRef.current = true;
        handleRun();
    }
  };

  const handleRun = async (ignoreBreakpoints: boolean = false) => {
    // if paused, handle the "Run (Ignore Breakpoints)" case
    if (paused && ignoreBreakpoints) {
      ignoreBreakpointsRef.current = true;
      handleResume();
      return;
    }

    // if not paused, continue as usual
    if (isEvaluating) return;
    setIsEvaluating(true);
    isHaltedRef.current = false;
    setCurrentResult(null);
    ignoreBreakpointsRef.current = ignoreBreakpoints;

    if (!rootBlock) {
      alert("No root block to evaluate.");
      setIsEvaluating(false);
      return;
    }

    try {
      const speedMap: Record<number, number> = {
        0: 500,
        1: 100,
        2: 0,
      };
      const delay = speedMap[evaluationSpeed];

      // the callback function to be run after evaluation
      const onStepCallback = async (block: BlockData, result: number) => {
        if (isHaltedRef.current) throw new Error("Halted");

        // update UI
        setHighlightedBlockId(block.id);
        setCurrentResult(result);

        // control flow: pause execution if there is a breakpoint or we are stepping
        const shouldPause = (breakpointsRef.current.has(block.id) && !ignoreBreakpointsRef.current) || pauseAtNextStepRef.current;
        if (shouldPause) {
          setPaused(true);
          pauseAtNextStepRef.current = false;
          await new Promise<void>(resolve => {
            pauseResolver.current = resolve;
          });
          setPaused(false);
        }

        // wait to simulate execution speed 
        if (delay > 0) await sleep(delay);
      };
      // stepBlock will run evaluation, then handle the callback
      await stepBlock(rootBlock, inputs, onStepCallback);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message !== "Halted") {
          alert(`Error: ${error.message}`);
        }
      }
    } finally {
      setHighlightedBlockId(null);
      setIsEvaluating(false);
      setPaused(false);
      ignoreBreakpointsRef.current = false;
    }
  };

  const speedToText = (speed: number) => {
    if (speed === 0) return "Slow";
    if (speed === 1) return "Fast";
    return "Instant";
  };
  
  return (
    <>
      <Toolbar 
        onSave={handleSave}
        onLoad={handleLoad}

        loadInputRef={loadInputRef}

        onRun={() => handleRun(false)}
        onRunIgnoreBreakpoints={() => handleRun(true)}
        onResume={handleResume}
        paused={paused}
        onHalt={handleHalt}
        onStep={handleStep}
        inputCount={inputCount}
        onInputCountChange={handleInputCountChange}
        inputs={inputs}
        onInputChange={handleInputChange}
        evaluationSpeed={evaluationSpeed}
        onEvaluationSpeedChange={setEvaluationSpeed}
        speedToText={speedToText}
        currentResult={currentResult}
      />

      <div className = "flexcont">

        <BlockPalette />

        <div className="editor-content">
          <BlockSlotDisplay 
            parentBlock={null} 
            slot={{ name: "Root", block: rootBlock, input_descriptor_index: 0 }} 
            onUpdate={(block) => {
              if (block) {
                checkForErrors(block);
              }
              setRootBlock(block);
            }}
            highlightedBlockId={highlightedBlockId}
            selectedBlockId={selectedBlockId}
            onSelectBlock={(id) => setSelectedBlockId(id)}
          />
        </div>
      </div>

      <hr className="my-6" />
    </>
  );
}