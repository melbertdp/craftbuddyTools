"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { FONT_FAMILIES } from "./fabric-bridge";
import { useWorkspaceStore } from "@/pdf/stores/workspace-store";
import type { EditorObject, ShapeObject, TextObject } from "@/pdf/types";
import { cn } from "@/lib/utils";

const EMPTY_OBJECTS: EditorObject[] = [];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value === "transparent" ? "#ffffff" : value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-10 cursor-pointer rounded-md border border-border bg-transparent p-1"
          aria-label={label}
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 flex-1 font-mono text-xs"
        />
      </div>
    </Field>
  );
}

function OpacityField({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <Field label={`Opacity ${Math.round(value * 100)}%`}>
      <Slider value={[value * 100]} min={0} max={100} step={1} onValueChange={([next]) => onChange(next / 100)} />
    </Field>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid h-8 min-w-8 place-items-center rounded-md border px-2 text-xs font-semibold transition-colors",
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

export function EditorProperties({ mode }: { mode: "edit" | "sign" }) {
  const objectsByPage = useWorkspaceStore((state) => state.objects);
  const activePageId = useWorkspaceStore((state) => state.activePageId);
  const selectedObjectIds = useWorkspaceStore((state) => state.selectedObjectIds);
  const store = useWorkspaceStore;

  const objects = activePageId ? objectsByPage[activePageId] ?? EMPTY_OBJECTS : EMPTY_OBJECTS;
  const selected = objects.filter((object) => selectedObjectIds.includes(object.id));
  const patchSelected = (patch: Partial<EditorObject>) => store.getState().updateSelectedObjects(patch);

  if (selected.length === 0) {
    return (
      <div className="space-y-4 p-4">
        <p className="text-xs text-muted-foreground">
          Select an object to edit its properties. Nothing selected — these are the defaults for new objects.
        </p>
        <DefaultSettings mode={mode} />
      </div>
    );
  }

  const first = selected[0];
  const multi = selected.length > 1;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {multi ? `${selected.length} selected` : first.type}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Move forward"
            onClick={() => selected.forEach((object) => store.getState().reorderObject(object.id, "forward"))}
          >
            <ArrowUp className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Move backward"
            onClick={() => selected.forEach((object) => store.getState().reorderObject(object.id, "backward"))}
          >
            <ArrowDown className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Duplicate"
            onClick={() => store.getState().duplicateSelectedObjects()}
          >
            <Copy className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Delete"
            className="text-destructive"
            onClick={() => store.getState().deleteSelectedObjects()}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      {!multi && first.type === "text" && (
        <TextProperties object={first as TextObject} patch={patchSelected} />
      )}
      {!multi && (first.type === "image" || first.type === "signature") && (
        <div className="space-y-4">
          <OpacityField value={first.opacity} onChange={(value) => patchSelected({ opacity: value })} />
          <Field label="Rotation">
            <Input
              type="number"
              value={Math.round(first.rotation)}
              onChange={(event) => patchSelected({ rotation: Number(event.target.value) || 0 })}
              className="h-9"
            />
          </Field>
        </div>
      )}
      {!multi && first.type === "drawing" && (
        <div className="space-y-4">
          <ColorField label="Color" value={first.color} onChange={(value) => patchSelected({ color: value })} />
          <Field label={`Thickness ${Math.round(first.thickness)} pt`}>
            <Slider
              value={[first.thickness]}
              min={1}
              max={40}
              step={1}
              onValueChange={([value]) => patchSelected({ thickness: value })}
            />
          </Field>
          <OpacityField value={first.opacity} onChange={(value) => patchSelected({ opacity: value })} />
        </div>
      )}
      {!multi &&
        (first.type === "highlight" || first.type === "underline" || first.type === "strikethrough") && (
          <div className="space-y-4">
            <ColorField label="Color" value={first.color} onChange={(value) => patchSelected({ color: value })} />
            <OpacityField value={first.opacity} onChange={(value) => patchSelected({ opacity: value })} />
          </div>
        )}
      {!multi &&
        (first.type === "rectangle" ||
          first.type === "ellipse" ||
          first.type === "line" ||
          first.type === "arrow") && (
          <ShapeProperties object={first as ShapeObject} patch={patchSelected} />
        )}

      {multi && (
        <div className="space-y-4">
          <OpacityField value={first.opacity} onChange={(value) => patchSelected({ opacity: value })} />
        </div>
      )}

      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Position &amp; size</summary>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["x", "y", "width", "height"] as const).map((key) => (
            <Field key={key} label={key === "x" ? "X (%)" : key === "y" ? "Y (%)" : key === "width" ? "Width (%)" : "Height (%)"}>
              <Input
                type="number"
                value={Number((first[key] * 100).toFixed(2))}
                onChange={(event) => patchSelected({ [key]: (Number(event.target.value) || 0) / 100 })}
                className="h-8 text-xs"
              />
            </Field>
          ))}
        </div>
      </details>
    </div>
  );
}

function TextProperties({
  object,
  patch,
}: {
  object: TextObject;
  patch: (patch: Partial<EditorObject>) => void;
}) {
  return (
    <div className="space-y-4">
      <Field label="Text">
        <textarea
          value={object.text}
          onChange={(event) => patch({ text: event.target.value } as Partial<EditorObject>)}
          rows={3}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        />
      </Field>
      <Field label="Font">
        <Select
          value={object.fontFamily}
          onValueChange={(value) => patch({ fontFamily: value } as Partial<EditorObject>)}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                {font.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Size (pt)">
          <Input
            type="number"
            value={object.fontSize}
            min={4}
            onChange={(event) => patch({ fontSize: Number(event.target.value) || 4 } as Partial<EditorObject>)}
            className="h-9"
          />
        </Field>
        <Field label="Line height">
          <Input
            type="number"
            step={0.1}
            value={object.lineHeight}
            onChange={(event) => patch({ lineHeight: Number(event.target.value) || 1 } as Partial<EditorObject>)}
            className="h-9"
          />
        </Field>
      </div>
      <div className="flex items-center gap-1.5">
        <ToggleChip active={object.bold} label="Bold" onClick={() => patch({ bold: !object.bold } as Partial<EditorObject>)}>
          B
        </ToggleChip>
        <ToggleChip active={object.italic} label="Italic" onClick={() => patch({ italic: !object.italic } as Partial<EditorObject>)}>
          <span className="italic">I</span>
        </ToggleChip>
        <ToggleChip
          active={object.underline}
          label="Underline"
          onClick={() => patch({ underline: !object.underline } as Partial<EditorObject>)}
        >
          <span className="underline">U</span>
        </ToggleChip>
        <div className="mx-1 h-5 w-px bg-border" aria-hidden />
        {(["left", "center", "right"] as const).map((align) => (
          <ToggleChip
            key={align}
            active={object.align === align}
            label={`Align ${align}`}
            onClick={() => patch({ align } as Partial<EditorObject>)}
          >
            {align === "left" ? "L" : align === "center" ? "C" : "R"}
          </ToggleChip>
        ))}
      </div>
      <ColorField label="Color" value={object.color} onChange={(value) => patch({ color: value } as Partial<EditorObject>)} />
      <ColorField
        label="Background"
        value={object.backgroundColor ?? "transparent"}
        onChange={(value) => patch({ backgroundColor: value } as Partial<EditorObject>)}
      />
      <OpacityField value={object.opacity} onChange={(value) => patch({ opacity: value })} />
    </div>
  );
}

function ShapeProperties({
  object,
  patch,
}: {
  object: ShapeObject;
  patch: (patch: Partial<EditorObject>) => void;
}) {
  return (
    <div className="space-y-4">
      <ColorField label="Border color" value={object.stroke} onChange={(value) => patch({ stroke: value })} />
      <ColorField label="Fill" value={object.fill} onChange={(value) => patch({ fill: value })} />
      <Field label={`Thickness ${Math.round(object.thickness)} pt`}>
        <Slider
          value={[object.thickness]}
          min={0}
          max={24}
          step={0.5}
          onValueChange={([value]) => patch({ thickness: value })}
        />
      </Field>
      <OpacityField value={object.opacity} onChange={(value) => patch({ opacity: value })} />
    </div>
  );
}

function DefaultSettings({ mode }: { mode: "edit" | "sign" }) {
  const settings = useWorkspaceStore((state) => state.settings);
  const tool = useWorkspaceStore((state) => state.tool);
  const setSettings = useWorkspaceStore((state) => state.setSettings);

  return (
    <div className="space-y-4">
      <Field label="Text size (pt)">
        <Input
          type="number"
          value={settings.text.fontSize}
          min={4}
          onChange={(event) =>
            setSettings({ text: { ...settings.text, fontSize: Number(event.target.value) || 4 } })
          }
          className="h-9"
        />
      </Field>
      <ColorField
        label="Text color"
        value={settings.text.color}
        onChange={(value) => setSettings({ text: { ...settings.text, color: value } })}
      />
      <ColorField
        label="Drawing color"
        value={settings.draw.color}
        onChange={(value) => setSettings({ draw: { ...settings.draw, color: value } })}
      />
      <Field label={`Brush thickness ${Math.round(settings.draw.thickness)} pt`}>
        <Slider
          value={[settings.draw.thickness]}
          min={1}
          max={40}
          step={1}
          onValueChange={([value]) => setSettings({ draw: { ...settings.draw, thickness: value } })}
        />
      </Field>
      <ColorField
        label="Shape border"
        value={settings.shape.stroke}
        onChange={(value) => setSettings({ shape: { ...settings.shape, stroke: value } })}
      />
      <ColorField
        label="Highlight color"
        value={settings.markup.color}
        onChange={(value) => setSettings({ markup: { ...settings.markup, color: value } })}
      />
      {mode === "sign" && (
        <p className="text-xs text-muted-foreground">
          Use the signature tool to draw, type, or upload a signature. This adds a visual signature, not a
          certificate-based digital signature.
        </p>
      )}
      {activePageIdHint(tool)}
    </div>
  );
}

function activePageIdHint(tool: string) {
  if (tool === "select") return null;
  return <p className="text-xs text-muted-foreground">Active tool: {tool}. Drag on the page to add.</p>;
}

export function useActivePageId(): string | undefined {
  return useWorkspaceStore((state) => state.activePageId);
}
