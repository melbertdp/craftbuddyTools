"use client";

import * as React from "react";
import {
  CalendarPlus,
  Circle,
  Eraser,
  Highlighter,
  Image as ImageIcon,
  Minus,
  MousePointer2,
  MoveUpRight,
  PenLine,
  PenTool,
  Square,
  Strikethrough,
  Type,
  Underline,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { createTextObject } from "@/pdf/core/editor/model";
import { useWorkspaceStore, type EditorTool } from "@/pdf/stores/workspace-store";
import type { ShapeObject } from "@/pdf/types";
import { cn } from "@/lib/utils";

interface EditorToolbarProps {
  mode: "edit" | "sign";
  onAddImage: () => void;
  onAddSignature: () => void;
}

interface ToolButton {
  id: EditorTool;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const EDIT_TOOLS: ToolButton[] = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "text", label: "Text", icon: Type },
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "draw", label: "Draw", icon: PenTool },
  { id: "eraser", label: "Eraser", icon: Eraser },
  { id: "highlight", label: "Highlight", icon: Highlighter },
  { id: "underline", label: "Underline", icon: Underline },
  { id: "strikethrough", label: "Strike-through", icon: Strikethrough },
  { id: "shape", label: "Shape", icon: Square },
];

const SIGN_TOOLS: ToolButton[] = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "signature", label: "Signature", icon: PenLine },
  { id: "text", label: "Text", icon: Type },
];

const SHAPE_TYPES: { value: ShapeObject["type"]; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "rectangle", label: "Rectangle", icon: Square },
  { value: "ellipse", label: "Ellipse", icon: Circle },
  { value: "line", label: "Line", icon: Minus },
  { value: "arrow", label: "Arrow", icon: MoveUpRight },
];

export function EditorToolbar({ mode, onAddImage, onAddSignature }: EditorToolbarProps) {
  const tool = useWorkspaceStore((state) => state.tool);
  const settings = useWorkspaceStore((state) => state.settings);
  const setTool = useWorkspaceStore((state) => state.setTool);
  const setSettings = useWorkspaceStore((state) => state.setSettings);
  const tools = mode === "sign" ? SIGN_TOOLS : EDIT_TOOLS;

  const handleTool = (id: EditorTool) => {
    if (id === "image") {
      onAddImage();
      return;
    }
    if (id === "signature") {
      onAddSignature();
      return;
    }
    setTool(id);
  };

  const addDate = () => {
    const state = useWorkspaceStore.getState();
    const pageId = state.activePageId;
    if (!pageId) return;
    const label = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date());
    const object = createTextObject(
      { pageId, x: 0.7, y: 0.85, width: 0.22, height: 0.03 },
      { ...state.settings.text, text: label, fontSize: 12, align: "center" },
    );
    state.addObject(object);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-card/70 px-2 py-1.5">
      {tools.map((entry) => {
        const Icon = entry.icon;
        const active = entry.id === "image" || entry.id === "signature" ? false : tool === entry.id;
        return (
          <Tooltip key={entry.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={entry.label}
                aria-pressed={active}
                onClick={() => handleTool(entry.id)}
                className={cn(
                  "grid size-8 place-items-center rounded-md transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{entry.label}</TooltipContent>
          </Tooltip>
        );
      })}

      {mode === "edit" && tool === "shape" && (
        <Select
          value={settings.shape.type}
          onValueChange={(value) =>
            setSettings({ shape: { ...settings.shape, type: value as ShapeObject["type"] } })
          }
        >
          <SelectTrigger className="ml-1 h-8 w-[130px]" aria-label="Shape type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SHAPE_TYPES.map((shape) => (
              <SelectItem key={shape.value} value={shape.value}>
                {shape.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {mode === "sign" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Add date"
              onClick={addDate}
              className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <CalendarPlus className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Add date</TooltipContent>
        </Tooltip>
      )}

      {mode === "edit" && (
        <div className="ml-1 flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Add signature"
                onClick={onAddSignature}
                className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <PenLine className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Add signature</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
