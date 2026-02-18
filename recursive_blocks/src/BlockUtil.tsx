import { blockConfig, BlockType, BlockEvaluator, BlockSlot } from "./BlockConfig";

/* A custom data type that contains all the data for a block placed into the block tree. */
export interface BlockData {
  id: string;
  name?: string; // For custom blocks
  type: BlockType;
  children: Array<BlockSlot>; // e.g., { condition: Block, then: Block }
  collapsed: boolean;
  immutable: boolean;
  hasBreakpoint?: boolean;
  num_values?: Array<{ name: string; value: number }>; // e.g., { name: "n", value: 5 }
  inputCount: number;
  depth: number;
  errors: string[];
  latestInput?: number[]; // Latest execution input/output for visualization
  latestOutput?: number;
}

// Currently unused.
// Meant to be involved with moving blocks around.
export function removeBlockById(block: BlockData, targetId: string): BlockData {
  return {
    ...block,
    children: block.children.map((slot) => ({
      ...slot,
      block: slot.block?.id === targetId
        ? null
        : slot.block
          ? removeBlockById(slot.block, targetId)
          : null,
    })),
  };
}

// Recursively checks if the parent has a descendant with id of childId
export function isDescendant(parent: BlockData, childId: string): boolean {
  for (const slot of parent.children) {
    if (!slot.block) continue;
    if (slot.block.id === childId) return true;
    if (isDescendant(slot.block, childId)) return true;
  }
  return false;
}

// Calls evaluate on the given block, starting with given inputs.
// Each block type has an evaluate function, 
// which takes in the blockdata, the inputs to evaluate on, 
// and this evaluation function (to allow calling this function recursively)
export async function evaluateBlock(
  block: BlockData,
  inputs: number[]
): Promise<number> {
  const config = blockConfig[block.type];
  const ev = await config.evaluate(block, inputs, evaluateBlock);
  // console.log(`Evaluating block ${block.type} with inputs ${inputs} => Result: ${ev}`);
  return ev;
}

// Step through block evaluation with optional callback for visualization
export async function stepBlock(
  block: BlockData,
  inputs: number[],
  onStepCallback?: (block: BlockData, result: number) => Promise<void>
): Promise<number> {
  const evaluateWithCallback: BlockEvaluator = async (b, i, _eval, callback) => {
    return await stepBlock(b, i, callback);
  };
  
  const config = blockConfig[block.type];
  const ev = await config.evaluate(block, inputs, evaluateWithCallback, onStepCallback);
  if (onStepCallback) {
    await onStepCallback(block, ev);
  }
  return ev;
}

// Takes in a defaultCount, and modifies it using the slot's input modifiers to get the actual input count the slot wants.
export function getInputCountOfSlot(
  slot: BlockSlot,
  defaultCount: number = 0
): number {
  if (slot.input_set !== undefined) {
    return slot.input_set;
  }
  if (slot.input_mod !== undefined) {
    return defaultCount + slot.input_mod;
  }
  return defaultCount;
}

// Recursively sets the input counts of blocks starting with setting the input block to have count inputs.
export function setInputCountOfBlock(
  block: BlockData,
  count: number
) {
  block.inputCount = count;
  for (const slot of block.children) {
    if (slot.block) {
      setInputCountOfBlock(slot.block, getInputCountOfSlot(slot, count));
    }
  }
}

// Recursively checks for errors in the block and its children.
// Adds error messages to the block's errors array and returns it.
export function checkForErrors(block: BlockData) : string[] {
  block.errors = [];
  for (const slot of block.children) {
    if (slot.block) {
      const errs = checkForErrors(slot.block);
      if (errs.length > 0) {
        block.errors.push(`Error(s) in children`);
      }
    } else {
      const err = `Missing ${slot.name}.`;
      block.errors.push(err);
    }
  }
  const config = blockConfig[block.type];
  const blockErrors = config.checkForErrors(block);
  block.errors.push(...blockErrors);
  return block.errors;
}

// Return a new BlockData where the child in slot `slotName` is replaced with `newChild`.
// Performs a deep clone to avoid shared references that can cause subtle mutation bugs.
export function replaceSlotBlock(parent: BlockData, slotName: string, newChild: BlockData | null): BlockData {
  const copy = structuredClone(parent);
  if (!copy.children) return copy;
  for (const slot of copy.children) {
    if (slot.name === slotName) {
      slot.block = newChild ? newChild : null;
      break;
    }
  }
  return copy;
}