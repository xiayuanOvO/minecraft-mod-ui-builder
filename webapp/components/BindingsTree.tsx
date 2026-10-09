"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import type { BindingNode, BindingType, BindingsSchema } from "@/lib/types";
import { useLocale } from "@/lib/i18n";

interface Props {
  schema: BindingsSchema;
  onChange: (schema: BindingsSchema) => void;
}

export function getBindingPaths(schema: BindingsSchema, prefix = ""): string[] {
  return Object.entries(schema).flatMap(([key, node]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const childPaths = node.children ? getBindingPaths(node.children, path) : [];
    return [path, ...childPaths];
  });
}

export function getBindingNode(schema: BindingsSchema, path: string): BindingNode | undefined {
  const parts = path.split(".");
  let node: BindingNode | undefined = { children: schema };
  for (const part of parts) {
    node = node?.children?.[part];
  }
  return node;
}

export function getPathsByType(schema: BindingsSchema, type: BindingType): string[] {
  return getBindingPaths(schema).filter(path => {
    const node = getBindingNode(schema, path);
    return (node?.type ?? "string") === type;
  });
}

// ── Shared add-property form ─────────────────────────────────────────────────

interface AddFormProps {
  indent?: number;
  nameRef?: React.RefObject<HTMLInputElement | null>;
  name: string; onName: (v: string) => void;
  type: BindingType; onType: (v: BindingType) => void;
  preview: string; onPreview: (v: string) => void;
  onAdd: () => void;
  onCancel?: () => void;
}

function AddPropertyForm({ indent = 0, nameRef, name, onName, type, onType, preview, onPreview, onAdd, onCancel }: AddFormProps) {
  const { t } = useLocale();
  const inputCls = "rounded border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground placeholder-sidebar-foreground/30 focus:border-sidebar-ring focus:outline-none";

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onAdd();
    if (e.key === "Escape") onCancel?.();
  };

  return (
    <div className="mt-2 flex flex-col gap-1.5" style={indent ? { paddingLeft: indent } : undefined}>
      <div className="flex gap-1.5">
        <input
          ref={nameRef}
          className={inputCls + " flex-1 min-w-0"}
          placeholder={t("name")}
          value={name}
          onChange={e => onName(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <select
          className={inputCls + " shrink-0"}
          value={type}
          onChange={e => { onType(e.target.value as BindingType); onPreview(""); }}
        >
          <option value="string">string</option>
          <option value="number">number</option>
          <option value="boolean">boolean</option>
        </select>
      </div>
      <div className="flex gap-1.5">
        {type === "boolean" ? (
          <label className={"flex items-center gap-1.5 " + inputCls + " flex-1"}>
            <input
              type="checkbox"
              checked={preview === "true"}
              onChange={e => onPreview(e.target.checked ? "true" : "false")}
            />
            <span className="text-sidebar-foreground/50">{t("preview value")}</span>
          </label>
        ) : (
          <input
            type={type === "number" ? "number" : "text"}
            className={inputCls + " flex-1 min-w-0"}
            placeholder={t("preview value (optional)")}
            value={preview}
            onChange={e => onPreview(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        )}
        <button
          className="shrink-0 rounded border border-sidebar-border px-2 py-1 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground disabled:opacity-30"
          onClick={onAdd}
          disabled={!name.trim()}
        >
          {t("Add")}
        </button>
      </div>
    </div>
  );
}

// ── Tree node ────────────────────────────────────────────────────────────────

interface NodeProps {
  name: string;
  node: BindingNode;
  siblings: BindingsSchema;
  onChangeSiblings: (s: BindingsSchema) => void;
  depth: number;
}

function NodeRow({ name, node, siblings, onChangeSiblings, depth }: NodeProps) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(name);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName) nameRef.current?.focus();
  }, [editingName]);

  const children = node.children ?? {};
  const hasChildren = Object.keys(children).length > 0;

  const selfUpdate = (updated: BindingNode) =>
    onChangeSiblings({ ...siblings, [name]: updated });

  const commitRename = () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== name) {
      // rebuild siblings preserving key order
      const next: BindingsSchema = {};
      for (const [k, v] of Object.entries(siblings)) {
        next[k === name ? trimmed : k] = v;
      }
      onChangeSiblings(next);
    } else {
      setNameValue(name);
    }
    setEditingName(false);
  };

  const deleteself = () => {
    const { [name]: _, ...rest } = siblings;
    onChangeSiblings(rest);
  };

  const [addingChild, setAddingChild] = useState(false);
  const [childDraft, setChildDraft] = useState("");
  const [childType, setChildType] = useState<BindingType>("string");
  const [childPreview, setChildPreview] = useState("");
  const childInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingChild) childInputRef.current?.focus();
  }, [addingChild]);

  const addChild = () => {
    setChildDraft(""); setChildType("string"); setChildPreview("");
    setAddingChild(true);
    setExpanded(true);
  };

  const commitAddChild = () => {
    const key = childDraft.trim();
    if (key && !(key in children)) {
      const newNode: BindingNode = { type: childType };
      if (childPreview.trim()) {
        newNode.previewValue = childType === "number" ? Number(childPreview) : childPreview;
      }
      selfUpdate({ ...node, children: { ...children, [key]: newNode } });
    }
    setAddingChild(false);
    setChildDraft(""); setChildType("string"); setChildPreview("");
  };

  const nodeType = node.type ?? "string";

  return (
    <div>
      {/* ── name row ── */}
      <div
        className="group flex items-center gap-1.5 py-1 hover:bg-sidebar-accent rounded"
        style={{ paddingLeft: depth * 12 + 4 }}
      >
        <button
          className="flex h-4 w-4 shrink-0 items-center justify-center text-sidebar-foreground/40"
          onClick={() => hasChildren && setExpanded(v => !v)}
        >
          {hasChildren ? (
            expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />
          ) : null}
        </button>

        {editingName ? (
          <input
            ref={nameRef}
            className="min-w-0 flex-1 rounded border border-ring px-1 py-0 text-xs bg-background text-foreground focus:outline-none"
            value={nameValue}
            onChange={e => setNameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") { setNameValue(name); setEditingName(false); }
            }}
          />
        ) : (
          <span
            className="min-w-0 flex-1 truncate text-xs text-sidebar-foreground cursor-pointer"
            onDoubleClick={() => { setNameValue(name); setEditingName(true); }}
            title={t("Double-click to rename")}
          >
            {name}
          </span>
        )}

        <button
          className="hidden shrink-0 text-sidebar-foreground/40 hover:text-sidebar-foreground group-hover:flex"
          title={t("Add child property")}
          onClick={addChild}
        >
          <Plus size={12} />
        </button>
        <button
          className="hidden shrink-0 text-sidebar-foreground/40 hover:text-destructive group-hover:flex"
          title={t("Delete")}
          onClick={deleteself}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* ── type + preview row ── */}
      <div
        className="flex items-center gap-1.5 pb-1.5"
        style={{ paddingLeft: depth * 12 + 4 + 22 }}
      >
        <select
          className="shrink-0 rounded border border-sidebar-border bg-sidebar px-1 py-0 text-xs text-sidebar-foreground/50 focus:outline-none"
          value={nodeType}
          onChange={e => {
            const t = e.target.value as BindingType;
            const defaultVal = t === "boolean" ? false : t === "number" ? 0 : "";
            selfUpdate({ ...node, type: t, previewValue: defaultVal });
          }}
        >
          <option value="string">string</option>
          <option value="number">number</option>
          <option value="boolean">boolean</option>
        </select>

        {nodeType === "boolean" ? (
          <label className="flex items-center gap-1 text-xs text-sidebar-foreground/50">
            <input
              type="checkbox"
              className="cursor-pointer accent-sidebar-foreground"
              checked={node.previewValue === true}
              onChange={e => selfUpdate({ ...node, previewValue: e.target.checked })}
            />
            {t("preview")}
          </label>
        ) : (
          <input
            type={nodeType === "number" ? "number" : "text"}
            className="min-w-0 flex-1 rounded border border-sidebar-border bg-sidebar px-1 py-0 text-xs text-sidebar-foreground/60 placeholder-sidebar-foreground/30 focus:border-sidebar-ring focus:outline-none"
            placeholder={t("preview value")}
            value={node.previewValue as string ?? ""}
            onChange={e => {
              const raw = e.target.value;
              const val = nodeType === "number" ? (raw === "" ? undefined : Number(raw)) : raw || undefined;
              selfUpdate({ ...node, previewValue: val });
            }}
          />
        )}
      </div>

      {expanded && hasChildren && (
        Object.entries(children).map(([childName, childNode]) => (
          <NodeRow
            key={childName}
            name={childName}
            node={childNode}
            siblings={children}
            onChangeSiblings={newChildren =>
              selfUpdate({ ...node, children: Object.keys(newChildren).length ? newChildren : undefined })
            }
            depth={depth + 1}
          />
        ))
      )}
      {expanded && addingChild && (
        <AddPropertyForm
          indent={(depth + 1) * 12 + 4}
          nameRef={childInputRef}
          name={childDraft} onName={setChildDraft}
          type={childType} onType={setChildType}
          preview={childPreview} onPreview={setChildPreview}
          onAdd={commitAddChild}
          onCancel={() => { setAddingChild(false); setChildDraft(""); setChildType("string"); setChildPreview(""); }}
        />
      )}
    </div>
  );
}

export default function BindingsTree({ schema, onChange }: Props) {
  const [draft, setDraft] = useState("");
  const [draftType, setDraftType] = useState<BindingType>("string");
  const [draftPreview, setDraftPreview] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const add = () => {
    const key = draft.trim();
    if (!key || key in schema) return;
    const node: BindingNode = { type: draftType };
    if (draftPreview.trim()) {
      node.previewValue = draftType === "number" ? Number(draftPreview) : draftType === "boolean" ? draftPreview === "true" : draftPreview;
    }
    onChange({ ...schema, [key]: node });
    setDraft(""); setDraftType("string"); setDraftPreview("");
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-0">
      {Object.entries(schema).map(([name, node]) => (
        <NodeRow
          key={name}
          name={name}
          node={node}
          siblings={schema}
          onChangeSiblings={onChange}
          depth={0}
        />
      ))}
      <AddPropertyForm
        nameRef={inputRef}
        name={draft} onName={setDraft}
        type={draftType} onType={t => { setDraftType(t); setDraftPreview(""); }}
        preview={draftPreview} onPreview={setDraftPreview}
        onAdd={add}
      />
    </div>
  );
}
