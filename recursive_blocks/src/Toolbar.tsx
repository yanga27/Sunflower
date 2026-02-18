import React, { } from "react";
import './Toolbar.css';

interface ToolbarProps {
  onSave: () => void;
  onLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
  loadInputRef: React.RefObject<HTMLInputElement | null>;
  onRun: () => void;
  onHalt: () => void;
  onStep: () => void;
  inputCount: number;
  onInputCountChange: (count: number) => void;
  inputs: number[];
  onInputChange: (index: number, value: number) => void;
  evaluationSpeed: number;
  onEvaluationSpeedChange: (speed: number) => void;
  speedToText: (speed: number) => string;
  currentResult: number | null;
  // TEMP: Test data handlers
  onAddTestData?: () => void;
  onClearTestData?: () => void;
}

// JSX element to represent the toolbar, with functions to save, load, and evaluate.
export function Toolbar({ 
  onSave, 
  onLoad,
  loadInputRef, 
  onRun, 
  onHalt, 
  onStep,
  inputCount,
  onInputCountChange,
  inputs,
  onInputChange,
  evaluationSpeed,
  onEvaluationSpeedChange,
  speedToText,
  currentResult,
  // TEMP: Test data handlers
  onAddTestData,
  onClearTestData
}: ToolbarProps) {
  
  return (
    <>
      <div className="toolbar-container">
        <input
          ref={loadInputRef}
          id="load-input"
          type="file"
          accept=".bramflower,application/octet-stream"
          onChange={onLoad}
          className="hidden"
        />

        <img src="src/assets/logo.svg" alt="Sunflower" className="logo"/>
        
        {/* File operation buttons */}
        <div className="toolbar-section">
          <button onClick={onSave} className="toolbar-button" title="Save (Ctrl+Shift+S)">
            Save
          </button>
          <button
            className="toolbar-button"
            onClick={() => loadInputRef.current?.click()}
            title="Load (Ctrl+O)" 
          >
            Load
          </button>
        </div>

        {/* Divider between button groups */}
        <div className="toolbar-divider"></div>

        {/* Program operation buttons */}
        <div className="toolbar-section">
          <button onClick={onRun} className="toolbar-button run-button" title="Run program">
            ▶️ Run
          </button>
          <button onClick={onStep} className="toolbar-button step-button" title="Step through program">
            ⏩ Step
          </button>
          <button onClick={onHalt} className="toolbar-button halt-button" title="Halt execution">
            ⏹️ Halt
          </button>
        </div>

        <div className="toolbar-divider"></div>

        {/* TEMP: Test data buttons */}
        <div className="toolbar-section">
          <button 
            onClick={onAddTestData} 
            className="toolbar-button test-button"
            title="Add random test data to all blocks"
          >
            🎲 Test Data
          </button>
          <button 
            onClick={onClearTestData} 
            className="toolbar-button clear-button"
            title="Clear all test data from blocks"
          >
            🗑️ Clear
          </button>
        </div>

        <div className="toolbar-divider"></div>

        {/* Inline settings controls */}
        <div className="toolbar-section">
          <label className="toolbar-label">Inputs:</label>
          <input
            type="number"
            min="0"
            max="20"
            step="1"
            value={inputCount.toString()}
            onChange={(e) => onInputCountChange(parseInt(e.target.value))}
            className="toolbar-input"
          />
        </div>

        <div className="toolbar-section">
          <label className="toolbar-label">Speed:</label>
          <input
            type="range"
            min="0"
            max="2"
            step="1"
            value={evaluationSpeed}
            onChange={(e) => onEvaluationSpeedChange(parseInt(e.target.value))}
            className="toolbar-slider"
          />
          <span className="toolbar-value">{speedToText(evaluationSpeed)}</span>
        </div>

        {/* Result display at the end of toolbar */}
        <div className="toolbar-section result-section">
          <label className="toolbar-label">Result:</label>
          <span className="result-value">{currentResult ?? '—'}</span>
        </div>


      </div>

      {/* Settings panel */}
      <div className="settings-panel">
          <div className="settings-content">
            
            {/* Input values grid */}
            <div className="settings-group">
              <label className="settings-label">Input Values:</label>
              <div className="inputs-grid">
                {inputs.map((val, i) => (
                  <div key={i} className="input-item">
                    <label>x{i + 1}:</label>
                    <input
                      type="number"
                      value={val}
                      min="0"
                      step="1"
                      onChange={(e) => onInputChange(i, parseFloat(e.target.value))}
                      placeholder={`x${i + 1}`}
                      className="settings-input"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
    </>
  );
}