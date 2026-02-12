import React from "react";
import { useDrag } from "react-dnd";
import { BlockData } from "./BlockUtil";
import './Block.css';
import { blockConfig, BlockSlot, BlockType } from "./BlockConfig"; 
import { ValueEditor } from "./ValueEditor";
import { BlockSlotDisplay } from "./BlockSlot";

interface Props {
  block: BlockData | null;
  onUpdate: (newBlock: BlockData | null) => void;
  highlightedBlockId?: string | null;
  selectedBlockId?: string | null; 
  onSelectBlock: (id: string) => void;
}

const getDepthColor = (depth: number) => {
  const colors = ['#ff9999', '#99ff99', '#9999ff', '#ffff99', '#ff99ff', '#99ffff'];
  return colors[depth % colors.length];
};

/* 
A JSX element that represents a visual block element.
It is meant to be dragged into block slots.
Block is the BlockData of this block element.
onUpdate is a function that gets called when this block is modified
(meaning it is deleted, a value is modified, or an ancestor is modified)
and replaces the old block with the new block.
*/
export function Block({ block, onUpdate, highlightedBlockId, selectedBlockId, onSelectBlock }: Props) { 
  const [collapsed, setCollapsed] = React.useState(block?.collapsed);
  const [showInfo, setShowInfo] = React.useState(false);

  if (!block) {
    return <span className="empty-text"> Drop block here</span>;
  }

  const toggleCollapse = () => {
    setCollapsed(prev => !prev);
    block.collapsed = collapsed !== undefined ? !collapsed : true;
  };

  const [{ isDragging }, drag] = useDrag(() => ({
    type: "BLOCK",
    item: { type: block.type, id: block.id, block },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [block]);

  const dragRef = React.useRef<HTMLDivElement>(null);
  drag(dragRef);

  return (
    <div 
      className={`block-container
        ${highlightedBlockId === block.id ? "block-highlighted" : ""} 
        ${selectedBlockId === block.id ? "selected-block" : ""}`}
      ref={dragRef}
      style={{ 
        opacity: isDragging ? 0.5 : 1, 
        backgroundColor: getDepthColor(block.depth || 0),
        borderLeft: `5px solid ${getDepthColor(block.depth || 0)}`
      }}

      onClick={(e) => {
        // Stop propagation first to prevent parent blocks from handling this
        e.stopPropagation();
        if (onSelectBlock && block) {
          onSelectBlock(block.id);
        }
      }}
    >
      <div className="block-header" style={{ gap: "0.25rem" }}>
        <button 
          className="breakpoint-button"
          onClick={() => {
            onUpdate({ ...block, hasBreakpoint: !block.hasBreakpoint });
          }}
          title="Toggle Breakpoint"
          style={{ color: block.hasBreakpoint ? "red" : "#ccc", border: "none", background: "none", cursor: "pointer", fontSize: "1.2em", padding: "0 0.2rem" }}
        >
          {block.hasBreakpoint ? "\u25CF" : "\u25CB"}
        </button>
        <div className="block-type">{block.name || block.type.toUpperCase()}</div>
        <div className="block-error-list">
          {block.errors.map((error, index) => (
            <div key={index} className="block-error">
              {error}
            </div>
          ))}
        </div>
        <div>
          {blockConfig[block.type]?.description && (
            <button
              className="info-button"
              title={"Show description"}
              onClick={() => setShowInfo(prev => !prev)}
            >
              i
            </button>
          )}
          {block.children.length > 0 && (
            <button
              className="collapse-button"
              onClick={toggleCollapse}
            >
              {collapsed ? "V" : ">"}
            </button>
          )}
          {!block.immutable && (
            <button
              className="remove-button"
              onClick={() => onUpdate(null)}
            >
              X
            </button>
          )}
        </div>
      </div>

      {showInfo && blockConfig[block.type]?.description && (
        <div className="block-description">
          {blockConfig[block.type]?.description ?? "No description available for this block."}
        </div>
      )}

      <div className="slots-container">
        {block.children.map((slot) => (
          <div key={`${block.id}-${slot.name}`}><BlockSlotDisplay parentBlock={block} slot={slot} onUpdate={onUpdate} highlightedBlockId={highlightedBlockId} selectedBlockId={selectedBlockId} onSelectBlock={onSelectBlock} /></div>
        ))}
      </div>

      <ValueEditor block={block} onUpdate={onUpdate} />
    </div>
  );
}

export function getDefaultChildren(type: BlockType, depth: number = 0): Array<BlockSlot> {
  const blockDef = blockConfig[type];
  return blockDef ? blockDef.children.map(child => ({
    ...child,
    block: child.block ? { 
      ...child.block, 
      depth: depth + 1 
    } : null
  })) : [];
}

export function getDefaultValues(type: BlockType): Array<{ name: string; value: number }> {
  const blockDef = blockConfig[type];
  if (blockDef?.num_values) {
    return blockDef.num_values.map(v => ({ ...v })); // return a copy
  }
  return [];
}