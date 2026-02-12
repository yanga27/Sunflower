import { BlockData } from "./BlockUtil";

// Custom enum type to represent all the block types (each type has their own config)
export type BlockType = "Zero" | "Successor" | "Projection" | "Composition" | "Primitive Recursion" | "Minimization" | "Custom";

// Function signature for an evaluation function. 
// It takes in the block to evaluate, the inputs, and the evaluateBlock function, and returns an output number.
// onStepCallback is optional and used for stepping through evaluation.
export type BlockEvaluator = (block: BlockData, inputs: number[], evaluate: BlockEvaluator, onStepCallback?: (block: BlockData, result: number) => Promise<void>) => number | Promise<number>;

// Function signature for a function that takes in a number, and returns a string to be displayed in a blockslot wanting that many inputs.
export type InputDescriptorGenerator = (inputCount: number) => string;

//The BlockSlot represents a slot in a block that can hold a child block
//The name is a unique identifier for the slot
//The blockData is the child block that occupies the slot, or null if empty
//Input Descriptor Index is the index of a function that takes in the input count and returns a string describing the inputs, in the INPUT_DESCRIPTORS array below
//Input Set and Input Mod are an optional modifiers that adjust the displayed input count for the child block
export type BlockSlot = { name: string; block: BlockData | null; input_descriptor_index: number; input_set?: number; input_mod?: number};

const DEFAULT_INPUT_DESCRIPTOR: InputDescriptorGenerator = (inputCount) => {
  let output = "";
  for (let i = 1; i <= inputCount; i++) {
    output += `x${i}, `;
  }
  return output.slice(0, -2); // Remove trailing comma and space
};

const INPUT_DESCRIPTOR_G: InputDescriptorGenerator = (inputCount) => {
  let output = "";
  for (let i = 1; i <= inputCount; i++) {
    output += `g${i}, `;
  }
  return output.slice(0, -2);
};

const INPUT_DESCRIPTOR_N: InputDescriptorGenerator = (inputCount) => {
  let output = "";
  for (let i = 1; i < inputCount; i++) {
    output += `x${i}, `;
  }
  return output + `n`;
}

const INPUT_DESCRIPTOR_RECUR_YZ: InputDescriptorGenerator = (inputCount) => {
  let output = "";
  for (let i = 1; i < inputCount-1; i++) {
    output += `x${i}, `;
  }
  return output + `y, z`;
}

export const INPUT_DESCRIPTORS: InputDescriptorGenerator[] = [
  DEFAULT_INPUT_DESCRIPTOR,
  INPUT_DESCRIPTOR_G,
  INPUT_DESCRIPTOR_N,
  INPUT_DESCRIPTOR_RECUR_YZ
];

// Configuration for each block type
// type is the block type identifier (string)
// children is an array of BlockSlot defining the slots for child blocks (BlockSlot is defined above)
// dynamicChildren is an optional function that takes in the current block and returns an updated array of BlockSlot
// num_values is an optional array of named numeric parameters for the block
// evaluate is a function that takes in the block, input values, and an evaluator function, and returns the computed output value
export const blockConfig: Record<BlockType, {
  type: BlockType;
  children: BlockSlot[];
  dynamicChildren?: (block: BlockData) => BlockSlot[];
  num_values?: { name: string; value: number; min: number }[];
  evaluate: BlockEvaluator;
  checkForErrors: (block: BlockData) => string[];
  description?: string;
}> = {
  "Zero": {
    type: "Zero" as BlockType,
    children: [],
    evaluate: (_block, _inputs, _evaluate, onStepCallback) => {
      // Zero block always returns 0
      const result = 0;
      return result;
    },
    checkForErrors: (_block) => {
      // if (_block.inputCount > 0) {
      //   return [`Warning: Zero block should not have any inputs.`];
      // }
      return [];
    },
    description: "Ignores inputs. Returns 0."
  },
  "Successor": {
    type: "Successor" as BlockType,
    children: [],
    evaluate: (_block, inputs, _evaluate, onStepCallback) => {
      // Successor block returns the input incremented by 1
      if (inputs.length !== 1) {
        throw new Error("Successor block requires exactly one input.");
      }
      const result = inputs[0] + 1;
      return result;
    },
    checkForErrors: (block) => {
      if (block.inputCount !== 1) {
        return [`Successor block requires exactly one input, but has ${block.inputCount}.`];
      }
      return [];
    },
    description: "1 input. Returns the input incremented by 1."
  },
  "Projection": {
    type: "Projection" as BlockType,
    children: [],
    num_values: [
      { name: "i", value: 1, min: 1 }
    ],
    evaluate: (block, inputs, _evaluate, onStepCallback) => {
      // Projection block returns the i-th input
      if (inputs.length <= 0) {
        throw new Error("Projection block requires at least one input.");
      }
      if (!block.num_values || block.num_values.length === 0) {
        throw new Error("Projection block requires num_values to specify 'i'.");
      }
      const i = block.num_values[0].value ?? 0;
      const result = inputs[i-1];
      return result;
    },
    checkForErrors: (block) => {
      if (block.inputCount <= 0) {
        return [`Projection block requires at least one input.`];
      }
      const errors: string[] = [];
      const iValue = block.num_values?.find(v => v.name === "i")?.value;
      if (iValue === undefined) {
        errors.push(`Projection block requires 'i' value.`);
      } else if (iValue < 1 || iValue > block.inputCount) {
        errors.push(`Projection block 'i' value must be between 1 and ${block.inputCount}, but is ${iValue}.`);
      }
      return errors;
    },
    description: "n > 0 inputs. Returns the i-th input, where i is a parameter of the block and 1 <= i <= n."
  },
  "Composition": {
    type: "Composition" as BlockType,
    children: [], // Children are dynamically generated based on the "m" value
    num_values: [
      { name: "m", value: 1, min: 0 }
    ],
    evaluate: async (block, inputs, evaluate, onStepCallback) => {
      if (!block.num_values || block.num_values.length === 0) {
        throw new Error("Composition block requires num_values to specify 'm'.");
      }
      const m = block.num_values[0].value ?? 1;
      const g_results = [];
      for (let i = 0; i < m; i++) {
        const g_block = block.children.find(c => c.name === `g${i + 1}`)?.block;
        if (!g_block) {
          throw new Error(`g${i + 1} block is missing in Composition.`);
        }
        g_results.push(await evaluate(g_block, inputs, evaluate, onStepCallback));
      }
      const result = await evaluate(block.children[0].block!, g_results, evaluate, onStepCallback);
      return result;
    },
    dynamicChildren: (block: BlockData) => {
      const m = block!.num_values!.find(v => v.name === "m")?.value ?? 1;
      return [
        { name: "f", block: block.children.find(c => c.name === "f")?.block ?? null, input_descriptor_index: 1, input_set: m },
        ...Array.from({ length: m }, (_, i) => {
          const name = `g${i + 1}`;
          return {
            name,
            block: block.children.find(c => c.name === name)?.block ?? null,
            input_descriptor_index: 0,
          };
        })
      ];
    },
    checkForErrors: (block) => {
      const errors: string[] = [];
      const mValue = block.num_values?.find(v => v.name === "m")?.value;
      if (mValue === undefined) {
        errors.push(`Composition block requires 'm' value.`);
      }
      return errors;
    },
    description: "n inputs. Contains m blocks g1 ... gm. Runs g1 ... gm on the n inputs. Then returns f evaluated on the results of g1 ... gm."
  },
  "Primitive Recursion": {
    type: "Primitive Recursion" as BlockType,
    children: [
      { name: "Base Case", block: null, input_descriptor_index: 0, input_mod: -1 },
      { name: "Recursive Case", block: null, input_descriptor_index: 3, input_mod: 1 },
    ],
    evaluate: async (block, inputs, evaluate, onStepCallback) => {
      // Primitive Recursion block evaluates based on the base case and recursive case
      if (inputs.length < 1) {
        throw new Error("Primitive Recursion block requires at least one inputs.");
      }
      if (inputs[inputs.length - 1] <= 0) {
        // Base case: if the last input is 0, evaluate the base case block
        const result = await evaluate(block.children[0].block!, inputs.slice(0, -1), evaluate, onStepCallback);
        return result;
      } else {
        // Recursive case: evaluate the recursive case block with the inputs
        const inputs_decremented = inputs.slice(0, -1).concat(inputs[inputs.length - 1] - 1);
        // console.log("Inputs for recursive case:", inputs_decremented);
        const intermediateResult = await evaluate(block, inputs_decremented, evaluate, onStepCallback);
        const inputs_combined_with_previous = inputs_decremented.concat(intermediateResult);
        const result = await evaluate(block.children[1].block!, inputs_combined_with_previous, evaluate, onStepCallback);
        return result;
      }
    },
    checkForErrors: (block) => {
      const errors: string[] = [];
      if (block.inputCount < 1) {
        errors.push(`Primitive Recursion block requires at least one input.`);
      }
      return errors;
    },
    description: `n >= 1 inputs. 
    If rightmost input is 0, returns the base case. 
    Otherwise, returns the recursive case evaluated where y = (rightmost input - 1), and z is the result of the previous recursive step (this block, evaluated with rightmost input decremented).`
  },
  "Minimization": {
    type: "Minimization" as BlockType,
    children: [
      { name: "f", block: null, input_descriptor_index: 2, input_mod: 1 },
    ],
    evaluate: async (block, inputs, evaluate, onStepCallback) => {
      // Minimization block finds the smallest n such that f(..., n) = 0
      const f_block = block.children[0].block;
      if (!f_block) {
        throw new Error("Minimization block requires a function f.");
      }
      let n = 0;
      let depth = 0;
      const MAX_DEPTH = 100; // Prevent infinite loops
      while (depth < MAX_DEPTH) {
        const result = await evaluate(f_block, inputs.concat(n), evaluate, onStepCallback);
        if (result === 0) {
          return n;
        }
        n++;
        depth++;
      }
      throw new Error("Minimization did not converge within "+MAX_DEPTH+" iterations.");
    },
    checkForErrors: (_block) => {
      const errors: string[] = [];
      return errors;
    },
    description: "Any number of inputs. Finds the smallest non-negative integer n such that f evaluated on the inputs and n returns 0."
  },
  "Custom": {
    type: "Custom" as BlockType,
    children: [//This custom block slot is for internal use and should not be rendered
      { name: "Custom Function", block: null, input_descriptor_index: 0 },
    ],
    evaluate: async (block, inputs, evaluate, onStepCallback) => {
      // Custom block evaluation logic
      if (block.children[0].block) {
        const result = await evaluate(block.children[0].block, inputs, evaluate, onStepCallback);
        return result;
      }
      throw new Error("Custom block is empty.");
    },
    checkForErrors: (_block) => {
      const errors: string[] = [];
      return errors;
    }
  }
};