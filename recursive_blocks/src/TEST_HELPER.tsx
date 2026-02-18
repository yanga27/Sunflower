// TEST_HELPER.tsx
// This file shows how to add garbage test data to blocks for testing the In/Out display
import { BlockData } from "./BlockUtil";

// Adds random garbage input/output values to a block and all its children for testing the visualization
export function addGarbageTestData(block: BlockData): void {

  // Generate random garbage data
  const inputCount = block.inputCount || 2;
  const garbageInput = Array.from({ length: inputCount }, () => Math.floor(Math.random() * 10));
  const garbageOutput = Math.floor(Math.random() * 20);
  
  // Add to this block
  block.latestInput = garbageInput;
  block.latestOutput = garbageOutput;
  
  // Recursively add to children
  for (const slot of block.children) {
    if (slot.block) {
      addGarbageTestData(slot.block);
    }
  }
}

// Clears all input/output data from a block and its children
export function clearExecutionData(block: BlockData): void {
  block.latestInput = undefined;
  block.latestOutput = undefined;
  
  for (const slot of block.children) {
    if (slot.block) {
      clearExecutionData(slot.block);
    }
  }
}