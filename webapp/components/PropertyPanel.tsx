"use client";

import React, { useState } from "react";
import type { WidgetSpec, BindingsSchema } from "@/lib/types";
import { getWidgetDef } from "@/lib/widgetRegistry";
import { getBindingNode, getPathsByType } from "@/components/BindingsTree";
import type { BindingType } from "@/lib/types";
import { useTextures } from "@/lib/TextureContext";
import TexturePickerModal from "@/components/TexturePickerModal";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { useLocale } from "@/lib/i18n";

const BINDING_TARGETS: Record<string, string[]> = {
  button:        ["text", "enabled", "visible"],
  toggle_button: ["text", "enabled", "visible"],
  checkbox:      ["enabled", "visible"],
  input:         ["text", "enabled", "visible"],
  slider:        ["enabled", "visible"],
  label:         ["text", "visible"],
  panel:         ["visible"],
  progress:      ["value", "visible"],
  requirement:   ["satisfied", "visible"],
};

const BINDING_TARGET_TYPES: Record<string, BindingType> = {
  text:      "string",
  enabled:   "boolean",
  visible:   "boolean",
  value:     "number",
  satisfied: "boolean",
};

function argbIntToHex(val: number): string {
  return "#" + (val & 0xffffff).toString(16).padStart(6, "0");
}

function hexToArgbInt(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

interface Props {
  widget: WidgetSpec | null;
  onUpdate: (w: WidgetSpec) => void;
  bindingsSchema: BindingsSchema;
  actions: string[];
  onCreateAction?: (name: string) => void;
  inventoryAreaIds?: string[];
}

export default function PropertyPanel({ widget, onUpdate, bindingsSchema, actions, onCreateAction, inventoryAreaIds = [] }: Props) {
  const { t } = useLocale();
  const { packTextures } = useTextures();
  const [texPickerOpen, setTexPickerOpen] = useState(false);
  if (!widget) {
    return (
      <div className="flex flex-col gap-2 p-3 text-xs text-muted-foreground italic">
        {t("Select a widget to edit its properties.")}
      </div>
    );
  }

  const def = getWidgetDef(widget.type);

  const set = (patch: Partial<WidgetSpec>) => onUpdate({ ...widget, ...patch });
  const setProp = (key: string, value: string) => onUpdate({ ...widget, props: { ...widget.props, [key]: value } });

  const bindings = widget.bindings ?? {};
  const setBinding = (target: string, providerId: string) =>
    onUpdate({ ...widget, bindings: { ...bindings, [target]: providerId } });
  const removeBinding = (target: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [target]: _removed, ...rest } = bindings;
    onUpdate({ ...widget, bindings: Object.keys(rest).length ? rest : undefined });
  };

  const changeBindingTarget = (oldTarget: string, newTarget: string) => {
    const value = bindings[oldTarget];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [oldTarget]: _removed, ...rest } = bindings;
    onUpdate({ ...widget, bindings: { ...rest, [newTarget]: value } });
  };

  const availableTargets = BINDING_TARGETS[widget.type] ?? [];
  const unusedTargets = availableTargets.filter((t) => !(t in bindings));

  const propSchema = def?.propSchema ?? [];

  // Collect indices of min/max pairs to render them side by side
  const minIdx = propSchema.findIndex((f) => f.key === "min");
  const maxIdx = propSchema.findIndex((f) => f.key === "max");
  const pairedMinMax = minIdx !== -1 && maxIdx === minIdx + 1;

  return (
    <div className="flex flex-col gap-1 p-2 text-xs overflow-y-auto">
      <div className="font-bold text-foreground mb-1 uppercase tracking-wide">{t(def?.label ?? widget.type)}</div>

      <Field label="ID">
        <Input
          className="h-6 text-xs px-1.5"
          value={widget.id}
          onChange={(e) => set({ id: e.target.value })}
        />
      </Field>

      {widget.type !== "group" && widget.type !== "tab" && (
        <div className="grid grid-cols-2 gap-1">
          <Field label="X"><NumInput value={widget.x} onChange={(v) => set({ x: v })} /></Field>
          <Field label="Y"><NumInput value={widget.y} onChange={(v) => set({ y: v })} /></Field>
          {!(widget.type === "scrollbar" && (widget.props.axis ?? "y") === "y") && (
            <Field label="W"><NumInput value={widget.w} onChange={(v) => set({ w: v })} /></Field>
          )}
          {!(widget.type === "scrollbar" && widget.props.axis === "x") && (
            <Field label="H"><NumInput value={widget.h} onChange={(v) => set({ h: v })} /></Field>
          )}
        </div>
      )}

      {widget.type !== "group" && widget.type !== "checkbox" && (
        <Field label={t("Text")}>
          <Input
            className={`h-6 text-xs px-1.5 ${bindings.text ? "text-blue-500 italic" : ""}`}
            value={bindings.text ? bindings.text : (widget.text ?? "")}
            disabled={!!bindings.text}
            onChange={(e) => set({ text: e.target.value })}
          />
        </Field>
      )}

      {widget.type === "requirement" && (
        <Field label={t("Icon")}>
          {Object.keys(packTextures).length === 0 ? (
            <p className="text-xs text-muted-foreground italic">{t("Extract a resource pack first")}</p>
          ) : (
            <div className="flex flex-col gap-1">
              <button
                title={t("Change icon")}
                onClick={() => setTexPickerOpen(true)}
                className="w-full rounded border border-input hover:border-ring overflow-hidden transition-colors cursor-pointer"
                style={{ background: "#555", aspectRatio: widget.icon && packTextures[widget.icon] ? undefined : "16/9" }}
              >
                {widget.icon && packTextures[widget.icon] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={packTextures[widget.icon]}
                    alt=""
                    draggable={false}
                    style={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated", display: "block" }}
                  />
                ) : (
                  <span className="flex items-center justify-center py-4 text-xs text-muted-foreground">{t("Pick icon…")}</span>
                )}
              </button>
              {widget.icon && <p className="text-[10px] text-muted-foreground truncate">{widget.icon}</p>}
              <TexturePickerModal
                open={texPickerOpen}
                packTextures={packTextures}
                current={widget.icon ?? ""}
                onSelect={(k) => { set({ icon: k }); setTexPickerOpen(false); }}
                onClose={() => setTexPickerOpen(false)}
              />
            </div>
          )}
        </Field>
      )}

      {propSchema.length > 0 && (
        <>
          <div className="font-semibold text-muted-foreground mt-1">{t("Widget Props")}</div>
          {(() => {
            const rendered = new Set<number>();
            return propSchema.map((field, i) => {
              if (rendered.has(i)) return null;
              const currentValue = widget.props[field.key] ?? field.defaultValue ?? "";

              // Scrollbar axis — special swap logic
              if (widget.type === "scrollbar" && field.key === "axis") {
                return (
                  <Field key={field.key} label={t(field.label)}>
                    <PropSelect
                      value={currentValue}
                      options={field.options ?? []}
                      onChange={(newAxis) => {
                        if (newAxis !== currentValue) {
                          const newW = widget.h, newH = widget.w;
                          const [newX, newY] = newAxis === "x"
                            ? [widget.x - newW, widget.y + widget.h]
                            : [widget.x + widget.w, widget.y - newH];
                          onUpdate({ ...widget, x: newX, y: newY, w: newW, h: newH, props: { ...widget.props, axis: newAxis } });
                        }
                      }}
                    />
                  </Field>
                );
              }

              // Scrollbar target — inventory area picker
              if (widget.type === "scrollbar" && field.key === "target") {
                const opts = inventoryAreaIds.map((id) => ({ value: id, label: id }));
                const hasOrphan = !!currentValue && !inventoryAreaIds.includes(currentValue);
                return (
                  <Field key={field.key} label={t(field.label)}>
                    <PropSelect
                      value={currentValue}
                      options={["", ...inventoryAreaIds]}
                      labels={{ "": "(none)", ...(hasOrphan ? { [currentValue]: `${currentValue} ⚠` } : {}) }}
                      onChange={(v) => setProp(field.key, v)}
                      extraOptions={hasOrphan ? [currentValue] : []}
                    />
                  </Field>
                );
              }

              // Sprite texture picker
              if (widget.type === "sprite" && field.key === "src") {
                const hasPackTextures = Object.keys(packTextures).length > 0;
                return (
                  <Field key={field.key} label={t(field.label)}>
                    {!hasPackTextures ? (
                      <p className="text-xs text-muted-foreground italic">{t("Extract a resource pack first")}</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <button
                          title={t("Change texture")}
                          onClick={() => setTexPickerOpen(true)}
                          className="w-full rounded border border-input hover:border-ring overflow-hidden transition-colors cursor-pointer"
                          style={{ background: "#555", aspectRatio: currentValue && packTextures[currentValue] ? undefined : "16/9" }}
                        >
                          {currentValue && packTextures[currentValue] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={packTextures[currentValue]}
                              alt=""
                              draggable={false}
                              style={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated", display: "block" }}
                            />
                          ) : (
                            <span className="flex items-center justify-center py-4 text-xs text-muted-foreground">{t("Pick texture…")}</span>
                          )}
                        </button>
                        {currentValue && (
                          <p className="text-[10px] text-muted-foreground truncate">{currentValue}</p>
                        )}
                        <TexturePickerModal
                          open={texPickerOpen}
                          packTextures={packTextures}
                          current={currentValue}
                          onSelect={(k) => {
                            const url = packTextures[k];
                            if (url) {
                              const img = new Image();
                              img.onload = () => onUpdate({
                                ...widget,
                                props: { ...widget.props, [field.key]: k },
                                w: img.naturalWidth,
                                h: img.naturalHeight,
                              });
                              img.src = url;
                            } else {
                              setProp(field.key, k);
                            }
                          }}
                          onClose={() => setTexPickerOpen(false)}
                        />
                      </div>
                    )}
                  </Field>
                );
              }

              // Color picker
              if (field.key === "color" || field.key === "color_met" || field.key === "color_unmet") {
                const colorInt = parseInt(currentValue, 10) || 0;
                return (
                  <Field key={field.key} label={t(field.label)}>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={argbIntToHex(colorInt)}
                        onChange={(e) => setProp(field.key, String(hexToArgbInt(e.target.value)))}
                        className="h-6 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
                      />
                      <span className="text-[10px] text-muted-foreground">{argbIntToHex(colorInt)}</span>
                    </div>
                  </Field>
                );
              }

              // Boolean toggle
              if (field.type === "boolean" || (field.type === "select" && field.options?.join(",") === "true,false")) {
                const checked = currentValue === "true";
                return (
                  <div key={field.key} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t(field.label)}</span>
                    <Toggle checked={checked} onChange={(v) => setProp(field.key, String(v))} />
                  </div>
                );
              }

              // Alignment icon buttons
              if (field.key === "align") {
                return (
                  <Field key={field.key} label={t(field.label)}>
                    <div className="flex gap-1">
                      {(["left", "center", "right"] as const).map((opt) => (
                        <button
                          key={opt}
                          title={opt}
                          onClick={() => setProp(field.key, opt)}
                          className={`flex items-center justify-center rounded p-1 border transition-colors ${
                            currentValue === opt
                              ? "bg-accent border-ring text-accent-foreground"
                              : "border-input text-muted-foreground hover:border-ring hover:text-foreground"
                          }`}
                        >
                          {opt === "left" && <AlignLeft className="h-3 w-3" />}
                          {opt === "center" && <AlignCenter className="h-3 w-3" />}
                          {opt === "right" && <AlignRight className="h-3 w-3" />}
                        </button>
                      ))}
                    </div>
                  </Field>
                );
              }

              // Min + Max side by side
              if (pairedMinMax && field.key === "min") {
                const maxField = propSchema[maxIdx];
                const maxValue = widget.props[maxField.key] ?? maxField.defaultValue ?? "";
                rendered.add(maxIdx);
                return (
                  <div key="min-max" className="grid grid-cols-2 gap-1">
                    <Field label={t("Min")}><NumInput value={parseInt(currentValue, 10) || 0} onChange={(v) => setProp(field.key, String(v))} /></Field>
                    <Field label={t("Max")}><NumInput value={parseInt(maxValue, 10) || 0} onChange={(v) => setProp(maxField.key, String(v))} /></Field>
                  </div>
                );
              }

              // Select
              if (field.type === "select") {
                return (
                    <Field key={field.key} label={t(field.label)}>
                    <PropSelect
                      value={currentValue}
                      options={field.options ?? []}
                      onChange={(v) => setProp(field.key, v)}
                    />
                  </Field>
                );
              }

              // Number or text
              return (
                <Field key={field.key} label={t(field.label)}>
                  <Input
                    className="h-6 text-xs px-1.5"
                    type={field.type === "number" ? "number" : "text"}
                    value={currentValue}
                    onChange={(e) => setProp(field.key, e.target.value)}
                  />
                </Field>
              );
            });
          })()}
        </>
      )}

      {widget.type !== "group" && (
        <Field label={t("Action")}>
          <ActionSelect
            value={widget.action ?? ""}
            actions={actions}
            onChange={(v) => set({ action: v || undefined })}
            onCreateAction={onCreateAction}
          />
        </Field>
      )}

      {availableTargets.length > 0 && (
        <>
          <div className="font-semibold text-muted-foreground mt-1">{t("Bindings")}</div>
          {Object.entries(bindings).map(([target, path]) => {
            const expectedType = BINDING_TARGET_TYPES[target] ?? "string";
            const paths = getPathsByType(bindingsSchema, expectedType);
            const currentNode = getBindingNode(bindingsSchema, path);
            const currentCompatible = !path || (currentNode?.type ?? "string") === expectedType;
            return (
              <div key={target} className="flex gap-1 items-center">
                <select
                  className="shrink-0 rounded border border-input bg-background px-1 py-0.5 text-xs text-foreground focus:outline-none"
                  value={target}
                  onChange={(e) => changeBindingTarget(target, e.target.value)}
                >
                  {availableTargets
                    .filter((t) => t === target || !(t in bindings))
                    .map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select
                  className={`w-full rounded border px-1 py-0.5 text-xs bg-background text-foreground focus:outline-none ${!currentCompatible ? "border-orange-400" : "border-input"}`}
                  value={path}
                  onChange={(e) => setBinding(target, e.target.value)}
                >
                  {paths.length === 0 && (
                    <option value="" disabled>{t(`No ${expectedType} bindings defined`)}</option>
                  )}
                  {!paths.includes(path) && path && (
                    <option value={path}>{path} ⚠ wrong type</option>
                  )}
                  {paths.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <button
                  className="shrink-0 text-muted-foreground hover:text-destructive px-1"
                  onClick={() => removeBinding(target)}
                >✕</button>
              </div>
            );
          })}
          {unusedTargets.length > 0 && (() => {
            const firstTarget = unusedTargets[0];
            const expectedType = BINDING_TARGET_TYPES[firstTarget] ?? "string";
            const paths = getPathsByType(bindingsSchema, expectedType);
            return (
              <button
                className="w-full rounded border border-dashed border-input py-0.5 text-muted-foreground hover:border-foreground/40 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={paths.length === 0}
                onClick={() => setBinding(firstTarget, paths[0])}
              >
                {paths.length === 0 ? `Define a ${expectedType} binding first` : "+ Add binding"}
              </button>
            );
          })()}
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Input
      className="h-6 text-xs px-1.5"
      type="number"
      value={value}
      onChange={(e) => {
        const v = parseInt(e.target.value, 10);
        if (!isNaN(v)) onChange(v);
      }}
    />
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-4 w-7 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        checked ? "bg-primary" : "bg-input"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-3" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function ActionSelect({
  value,
  actions,
  onChange,
  onCreateAction,
}: {
  value: string;
  actions: string[];
  onChange: (v: string) => void;
  onCreateAction?: (name: string) => void;
}) {
  const { t } = useLocale();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");

  if (creating) {
    const confirm = () => {
      const name = draft.trim();
      if (name) onCreateAction?.(name);
      setCreating(false);
      setDraft("");
    };
    return (
      <div className="flex gap-1">
        <Input
          autoFocus
          className="h-6 text-xs px-1.5 flex-1"
          placeholder={t("action name")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirm();
            if (e.key === "Escape") { setCreating(false); setDraft(""); }
          }}
        />
        <button
          className="shrink-0 text-xs px-1.5 rounded border border-input bg-background hover:bg-accent"
          onClick={confirm}
        >
          {t("Add")}
        </button>
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={(v) => {
      if (v === "__create__") { setCreating(true); }
      else onChange(v ?? "");
    }}>
      <SelectTrigger size="sm" className="w-full h-6 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="" className="text-xs py-0.5">
          <span className="text-muted-foreground">{t("(none)")}</span>
        </SelectItem>
        {actions.map((a) => (
          <SelectItem key={a} value={a} className="text-xs py-0.5">{a}</SelectItem>
        ))}
        {onCreateAction && (
          <SelectItem value="__create__" className="text-xs py-0.5 text-muted-foreground italic">
            + {t("Create new action…")}
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}

function PropSelect({
  value,
  options,
  labels = {},
  onChange,
  extraOptions = [],
}: {
  value: string;
  options: string[];
  labels?: Record<string, string>;
  onChange: (v: string) => void;
  extraOptions?: string[];
}) {
  const { t } = useLocale();
  const allOptions = [...new Set([...options, ...extraOptions])];
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
      <SelectTrigger size="sm" className="w-full h-6 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allOptions.map((opt) => (
          <SelectItem key={opt} value={opt} className="text-xs py-0.5">
            {(labels[opt] ?? t(opt)) || <span className="text-muted-foreground">{t("(none)")}</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
