import React from "react";
import { v4 as uuidv4 } from 'uuid';
import { BlockSlot, BlockType } from "./BlockConfig";
import { BlockData, getInputCountOfSlot, isDescendant, setInputCountOfBlock } from "./BlockUtil";
import { blockConfig } from "./BlockConfig";
import { Block, getDefaultChildren, getDefaultValues } from "./Block";
import { replaceSlotBlock } from "./BlockUtil";
import { useDrop } from "react-dnd";
import { customBlocks } from "./BlockEditor";
import { deserializeBlock } from "./BlockSave";

/*
A JSX element that represents a block slot.
parentBlock is the block this slot exists on. (if null, this is the root slot).
slot is the slot data type (slot name, block inside, input descriptor, and input modifiers).
onUpdate is a function that is called when the block inside the slot is modified, it replaces the block inside with the new block.
highlightedBlockId is the optional ID of the block that should be highlighted (for stepping through evaluation).
*/

export function BlockSlotDisplay({parentBlock, slot, onUpdate, highlightedBlockId, selectedBlockId, onSelectBlock}: {
  parentBlock: BlockData | null, 
  slot: BlockSlot, 
  onUpdate: (newBlock: BlockData | null) => void, 
  highlightedBlockId?: string | null, 
  selectedBlockId?: string | null,
  onSelectBlock: (id: string) => void 
}) { 
	const { name, block: child } = slot;

    React.useEffect(() => {
      if (!child) return;
      const childBlockData = child as BlockData;
      const childConfig = blockConfig[childBlockData.type];
      
      if (childConfig.dynamicChildren) {
        const nextChildren = childConfig.dynamicChildren(childBlockData);
        const prevChildren = childBlockData.children;

        const changed = 
          prevChildren.length !== nextChildren.length ||
          prevChildren.some((c, i) => c.name !== nextChildren[i]?.name);

        if (changed) {
          const updatedChild = {
            ...childBlockData,
            id: uuidv4(),
            children: nextChildren,
            depth: childBlockData.depth
          };

		  if (parentBlock === null) {
			onUpdate(updatedChild);
			return;
		  }

          const newBlock = {
            ...parentBlock,
            children: parentBlock.children.map((slot) =>
              slot.name === name ? { ...slot, block: updatedChild } : slot
            ),
          };
          onUpdate(newBlock);
        }
      }
    }, [JSON.stringify(child?.num_values)]);

    const dropRef = React.useRef<HTMLDivElement>(null);

	// if (parentBlock) {
		const [, drop] = useDrop(() => ({
		accept: "BLOCK",
		drop: (item: { type: BlockType; id?: string; block?: BlockData, custom_block_name?: string }) => {
			if (child || parentBlock?.immutable || parentBlock?.type === "Custom") return;//Can't add descendants to custom blocks
			if (item.block && parentBlock && (item.block.id === parentBlock.id || isDescendant(item.block, parentBlock.id))) {
				return;
			}
			
			let newChild: BlockData;
			const newDepth = (parentBlock == null ? -1 : parentBlock.depth) + 1;

			if (item.block) {
				// newChild = {
				// 	...item.block, 
				// 	depth: newDepth
				// };
				// const updatedBlock = removeBlockById(parentBlock, item.block.id);

				// const newBlock = {
				// 	...updatedBlock,
				// 	children: updatedBlock.children.map((slot) =>
				// 	slot.name === name ? { ...slot, block: newChild } : slot
				// 	),
				// };
				// onUpdate(newBlock);
				console.error("Moving existing blocks not yet supported.");
			} else {
				if (item.custom_block_name !== undefined) {
					const customBlock = customBlocks[item.custom_block_name];
					if (customBlock) {
						newChild = deserializeBlock(customBlock, newDepth);
						setInputCountOfBlock(newChild, getInputCountOfSlot(slot, parentBlock ? parentBlock.inputCount : 0));
					} else {
						console.error("Invalid custom block name:", item.custom_block_name);
						return;
					}

					// console.log("Dropping custom block:", newChild);
				} else {

					newChild = {
						id: uuidv4(),
						type: item.type,
						children: getDefaultChildren(item.type, newDepth),
						collapsed: item.type === "Custom",
						immutable: false,
						num_values: getDefaultValues(item.type),
						inputCount: getInputCountOfSlot(slot, parentBlock ? parentBlock.inputCount : 0),
						depth: newDepth,
						errors: []
					};
				}

				if (parentBlock === null) {
					onUpdate(newChild);
					return;
				}

				const newBlock = replaceSlotBlock(parentBlock, name, newChild);
				onUpdate(newBlock);
			}
		},
		}), [child, parentBlock, name]);

		React.useEffect(() => {
		if (dropRef.current) {
			drop(dropRef.current);
		}
		}, [drop]);
	// }
	
	if (parentBlock) {

		if (slot.input_descriptor_index === undefined) {
			slot.input_descriptor_index = 0;
		}

		if (parentBlock.collapsed) {
			return (
				<div ref={dropRef}>
				{/* <strong>{name} ({slot.input_descriptor(getInputCountOfSlot(slot, block.inputCount))}):</strong> */}
				</div>
			);
		}
	}
    
    return (
		<div
			ref={dropRef}
			className={`block-slot ${slot.block ? "filled" : "empty"} ${highlightedBlockId === slot.block?.id ? "block-highlighted" : ""}`} 
			>
			<Block 
				key={slot.block?.id ?? `empty-${parentBlock ? parentBlock.id : "root"}-${slot.name}`}
				block={slot.block}
				onUpdate={(newChild) => {
				if (parentBlock === null) {
					onUpdate(newChild);
					return;
				}
				const updated = replaceSlotBlock(parentBlock, slot.name, newChild === null ? null : newChild);
				onUpdate(updated);
				}}
				highlightedBlockId={highlightedBlockId}
				selectedBlockId={selectedBlockId} 
				onSelectBlock={onSelectBlock} // pass down selection
			/>
		</div>
  	);
  };